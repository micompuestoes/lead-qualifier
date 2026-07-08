"""
Capa de base de datos con SQLAlchemy.
- Si DATABASE_URL está definida → PostgreSQL (producción)
- Si no → SQLite local (desarrollo)

Multi-tenant: cada lead tiene un tenant_id que corresponde
al userId de Clerk. Las queries siempre filtran por ese ID.
"""

import json
import logging
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Configuración del engine
# ─────────────────────────────────────────────

def _crear_engine():
    database_url = os.getenv("DATABASE_URL")

    if database_url:
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        logger.info("BD: PostgreSQL (produccion)")
        return create_engine(database_url)

    db_path = Path(__file__).parent / "leads.db"
    logger.info("BD: SQLite local en %s", db_path)
    return create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


engine = _crear_engine()


# ─────────────────────────────────────────────
# Inicialización del esquema
# ─────────────────────────────────────────────

def init_db() -> None:
    """Crea las tablas y columnas que falten. Seguro de llamar varias veces."""
    logger.info("Inicializando base de datos...")

    # Tabla de tenants (una fila por empresa/usuario registrado)
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tenants (
                id              TEXT PRIMARY KEY,
                email           TEXT NOT NULL,
                name            TEXT,
                plan            TEXT NOT NULL DEFAULT 'free',
                status          TEXT NOT NULL DEFAULT 'active',
                cancelled_at    TEXT,
                api_key         TEXT UNIQUE,
                notify_email    TEXT,
                created_at      TEXT NOT NULL
            )
        """))

    # Tabla de leads con tenant_id para el aislamiento multi-tenant
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS leads (
                id                  TEXT PRIMARY KEY,
                tenant_id           TEXT NOT NULL DEFAULT 'legacy',
                name                TEXT NOT NULL,
                email               TEXT NOT NULL,
                phone               TEXT,
                message             TEXT NOT NULL,
                classification      TEXT,
                score               INTEGER,
                reasoning           TEXT,
                generated_email     TEXT,
                recommended_actions TEXT,
                intent_analysis     TEXT,
                company_info        TEXT,
                status              TEXT NOT NULL DEFAULT 'PENDIENTE',
                created_at          TEXT NOT NULL,
                processed_at        TEXT
            )
        """))

    # Migraciones seguras — fallan silenciosamente si la columna ya existe
    for migration_sql in [
        "ALTER TABLE leads ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDIENTE'",
        "ALTER TABLE leads ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'legacy'",
        "ALTER TABLE tenants ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
        "ALTER TABLE tenants ADD COLUMN cancelled_at TEXT",
        "ALTER TABLE tenants ADD COLUMN api_key TEXT",
        "ALTER TABLE tenants ADD COLUMN notify_email TEXT",
        # Stripe billing
        "ALTER TABLE tenants ADD COLUMN stripe_customer_id TEXT",
        "ALTER TABLE tenants ADD COLUMN stripe_subscription_id TEXT",
        # IMAP email-to-lead
        "ALTER TABLE tenants ADD COLUMN imap_host TEXT",
        "ALTER TABLE tenants ADD COLUMN imap_port INTEGER DEFAULT 993",
        "ALTER TABLE tenants ADD COLUMN imap_user TEXT",
        "ALTER TABLE tenants ADD COLUMN imap_password_enc TEXT",
        "ALTER TABLE tenants ADD COLUMN imap_enabled INTEGER DEFAULT 0",
        "ALTER TABLE tenants ADD COLUMN imap_last_sync TEXT",
        # Avisos por WhatsApp al agente
        "ALTER TABLE tenants ADD COLUMN whatsapp_number TEXT",
        "ALTER TABLE tenants ADD COLUMN whatsapp_enabled INTEGER DEFAULT 0",
        # Reparto de leads entre agentes
        "ALTER TABLE leads ADD COLUMN assigned_to TEXT",
        "ALTER TABLE team_members ADD COLUMN member_name TEXT",
        # Contacto del agente para avisarle directamente de sus leads
        "ALTER TABLE team_members ADD COLUMN member_email TEXT",
        "ALTER TABLE team_members ADD COLUMN member_whatsapp TEXT",
        # Respuestas con IA: envío automático o revisión previa + voz de marca
        "ALTER TABLE tenants ADD COLUMN auto_send_email INTEGER DEFAULT 1",
        "ALTER TABLE tenants ADD COLUMN brand_voice TEXT",
        # Estado del email al lead (NULL = legado/enviado, 0 = borrador, 1 = enviado)
        "ALTER TABLE leads ADD COLUMN email_sent INTEGER",
        # Feedback del agente sobre la clasificación (1 = acierto, -1 = fallo)
        "ALTER TABLE leads ADD COLUMN score_feedback INTEGER",
    ]:
        try:
            with engine.begin() as conn:
                conn.execute(text(migration_sql))
            logger.info("Migración aplicada: %s", migration_sql[:60])
        except Exception:
            pass  # Ya existe — ignorar

    # Tabla de miembros del equipo (plan agencia — múltiples usuarios)
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS team_members (
                owner_id        TEXT NOT NULL,
                member_id       TEXT NOT NULL,
                member_name     TEXT,
                member_email    TEXT,
                member_whatsapp TEXT,
                added_at        TEXT NOT NULL,
                PRIMARY KEY (owner_id, member_id)
            )
        """))

    # Tabla de notificaciones de sistema (pagos, cambios de plan, etc.)
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id          TEXT PRIMARY KEY,
                tenant_id   TEXT NOT NULL,
                type        TEXT NOT NULL,
                title       TEXT NOT NULL,
                body        TEXT,
                read        INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL
            )
        """))

    # Índices para rendimiento
    with engine.begin() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leads_email     ON leads (email)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leads_created   ON leads (created_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leads_tenant    ON leads (tenant_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tenants_email   ON tenants (email)"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_api_key ON tenants (api_key)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_team_owner  ON team_members (owner_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_team_member ON team_members (member_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_notif_tenant ON notifications (tenant_id, created_at)"))

    logger.info("Base de datos lista")


# ─────────────────────────────────────────────
# Operaciones de Tenants
# ─────────────────────────────────────────────

def _generar_api_key() -> str:
    """Genera una API key única con prefijo lq_ (lead-qualifier)."""
    return "lq_" + secrets.token_urlsafe(32)


def ensure_tenant(tenant_id: str, email: str = "", name: str = "") -> None:
    """Crea el tenant si no existe. Seguro de llamar en cada request."""
    with engine.begin() as conn:
        existing = conn.execute(
            text("SELECT id FROM tenants WHERE id = :id"),
            {"id": tenant_id},
        ).fetchone()

        if not existing:
            api_key = _generar_api_key()
            conn.execute(
                text("""
                    INSERT INTO tenants (id, email, name, plan, api_key, notify_email, created_at)
                    VALUES (:id, :email, :name, 'free', :api_key, :notify_email, :created_at)
                """),
                {
                    "id": tenant_id,
                    "email": email,
                    "name": name or email.split("@")[0],
                    "api_key": api_key,
                    "notify_email": email,   # por defecto, notificar al email de registro
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            logger.info("Tenant creado: %s (%s) api_key=%s...", tenant_id, email, api_key[:12])


def get_tenant(tenant_id: str) -> Optional[dict]:
    """Devuelve los datos del tenant o None si no existe."""
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM tenants WHERE id = :id"),
            {"id": tenant_id},
        ).fetchone()
    return dict(row._mapping) if row else None


def get_tenant_by_api_key(api_key: str) -> Optional[dict]:
    """Busca un tenant por su API key pública. Usado en el endpoint de intake."""
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM tenants WHERE api_key = :key"),
            {"key": api_key},
        ).fetchone()
    return dict(row._mapping) if row else None


def set_tenant_status(tenant_id: str, status: str) -> None:
    """
    Cambia el estado de un tenant.
    status: 'active' | 'cancelled'

    Al cancelar se registra la fecha. Al reactivar se limpia.
    Los leads del tenant NO se borran — permanecen en la BD.
    """
    now = datetime.now(timezone.utc).isoformat()
    cancelled_at = now if status == "cancelled" else None

    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE tenants
                SET status = :status, cancelled_at = :cancelled_at
                WHERE id = :id
            """),
            {"status": status, "cancelled_at": cancelled_at, "id": tenant_id},
        )
    logger.info("Tenant %s → estado %s", tenant_id, status)


def update_tenant_profile(tenant_id: str, name: str, notify_email: str) -> None:
    """Actualiza el nombre comercial y el email de notificaciones del tenant."""
    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE tenants
                SET name = :name, notify_email = :notify_email
                WHERE id = :id
            """),
            {"name": name, "notify_email": notify_email, "id": tenant_id},
        )
    logger.info("Perfil actualizado para tenant %s: name=%s, notify=%s", tenant_id, name, notify_email)


def update_ai_settings(tenant_id: str, auto_send: bool, brand_voice: str) -> None:
    """Guarda si el email al lead se envía solo o queda en borrador, y la voz de marca."""
    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE tenants
                SET auto_send_email = :auto, brand_voice = :voz
                WHERE id = :id
            """),
            {"auto": 1 if auto_send else 0, "voz": brand_voice or None, "id": tenant_id},
        )
    logger.info("Ajustes de IA actualizados para tenant %s (auto_send=%s)", tenant_id, auto_send)


def update_whatsapp_config(tenant_id: str, number: Optional[str], enabled: bool) -> None:
    """Guarda el número de WhatsApp del agente y si quiere recibir avisos de leads."""
    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE tenants
                SET whatsapp_number = :number, whatsapp_enabled = :enabled
                WHERE id = :id
            """),
            {"number": number or None, "enabled": 1 if enabled else 0, "id": tenant_id},
        )
    logger.info("WhatsApp actualizado para tenant %s: enabled=%s", tenant_id, enabled)


def set_tenant_plan(
    tenant_id: str,
    plan: str,
    subscription_id: Optional[str] = None,
    customer_id: Optional[str] = None,
) -> None:
    """Actualiza el plan y los IDs de Stripe del tenant."""
    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE tenants
                SET plan=:plan,
                    stripe_subscription_id=:sub,
                    stripe_customer_id=COALESCE(:cid, stripe_customer_id)
                WHERE id=:id
            """),
            {"plan": plan, "sub": subscription_id, "cid": customer_id, "id": tenant_id},
        )
    logger.info("Plan actualizado: tenant %s → %s", tenant_id, plan)


def get_tenant_by_stripe_customer(customer_id: str) -> Optional[dict]:
    """Busca un tenant por su Stripe customer_id. Usado en webhooks."""
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM tenants WHERE stripe_customer_id=:cid"),
            {"cid": customer_id},
        ).fetchone()
    return dict(row._mapping) if row else None


def get_lead_count_this_month(tenant_id: str) -> int:
    """Cuenta los leads creados este mes por el tenant (para límite del plan free)."""
    from datetime import datetime, timezone
    inicio_mes = datetime.now(timezone.utc).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    with engine.connect() as conn:
        count = conn.execute(
            text("SELECT COUNT(*) FROM leads WHERE tenant_id=:tid AND created_at >= :start"),
            {"tid": tenant_id, "start": inicio_mes},
        ).scalar()
    return count or 0


def save_imap_config(tenant_id: str, host: str, port: int, user: str, password_enc: str) -> None:
    """Guarda la configuración IMAP del tenant (contraseña ya cifrada)."""
    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE tenants
                SET imap_host=:host, imap_port=:port, imap_user=:user,
                    imap_password_enc=:pwd, imap_enabled=1
                WHERE id=:id
            """),
            {"host": host, "port": port, "user": user, "pwd": password_enc, "id": tenant_id},
        )
    logger.info("IMAP configurado para tenant %s → %s:%s", tenant_id, host, port)


def get_imap_config(tenant_id: str) -> Optional[dict]:
    """Devuelve la config IMAP del tenant, o None si no está configurada."""
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT imap_host, imap_port, imap_user, imap_password_enc,
                       imap_enabled, imap_last_sync
                FROM tenants WHERE id=:id
            """),
            {"id": tenant_id},
        ).fetchone()
    if not row or not row[0]:
        return None
    return {
        "host": row[0], "port": row[1], "user": row[2],
        "password_enc": row[3], "enabled": bool(row[4]), "last_sync": row[5],
    }


def get_tenants_with_imap() -> list:
    """Devuelve todos los tenants activos con IMAP habilitado (para el scheduler)."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT id, imap_host, imap_port, imap_user, imap_password_enc,
                       notify_email, name
                FROM tenants
                WHERE imap_enabled=1 AND imap_host IS NOT NULL AND status='active'
            """),
        ).fetchall()
    return [
        {
            "id": r[0], "host": r[1], "port": r[2],
            "user": r[3], "password_enc": r[4],
            "notify_email": r[5], "name": r[6],
        }
        for r in rows
    ]


def update_imap_last_sync(tenant_id: str) -> None:
    """Actualiza la marca de tiempo de la última sincronización IMAP."""
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE tenants SET imap_last_sync=:ts WHERE id=:id"),
            {"ts": datetime.now(timezone.utc).isoformat(), "id": tenant_id},
        )


def disable_imap(tenant_id: str) -> None:
    """Desconecta el IMAP del tenant y borra sus credenciales."""
    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE tenants
                SET imap_host=NULL, imap_port=993, imap_user=NULL,
                    imap_password_enc=NULL, imap_enabled=0, imap_last_sync=NULL
                WHERE id=:id
            """),
            {"id": tenant_id},
        )
    logger.info("IMAP desconectado para tenant %s", tenant_id)


def add_team_member(owner_id: str, member_id: str, member_name: str = "",
                    member_email: str = "", member_whatsapp: str = "") -> None:
    """Añade un usuario de Clerk como miembro del equipo del tenant owner."""
    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO team_members (owner_id, member_id, member_name, member_email, member_whatsapp, added_at)
                VALUES (:owner, :member, :name, :email, :wa, :ts)
                ON CONFLICT (owner_id, member_id) DO UPDATE SET
                    member_name     = excluded.member_name,
                    member_email    = excluded.member_email,
                    member_whatsapp = excluded.member_whatsapp
            """),
            {"owner": owner_id, "member": member_id, "name": member_name or None,
             "email": member_email or None, "wa": member_whatsapp or None,
             "ts": datetime.now(timezone.utc).isoformat()},
        )


def remove_team_member(owner_id: str, member_id: str) -> None:
    """Elimina un miembro del equipo."""
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM team_members WHERE owner_id=:owner AND member_id=:member"),
            {"owner": owner_id, "member": member_id},
        )


def get_team_members(owner_id: str) -> list:
    """Devuelve los miembros del equipo del tenant (id, nombre y contacto)."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT member_id, member_name, member_email, member_whatsapp, added_at
                FROM team_members WHERE owner_id=:owner ORDER BY added_at
            """),
            {"owner": owner_id},
        ).fetchall()
    return [{
        "member_id": r[0], "member_name": r[1] or "",
        "member_email": r[2] or "", "member_whatsapp": r[3] or "",
        "added_at": r[4],
    } for r in rows]


def get_agent_contact(tenant_id: str, agent_id: Optional[str]) -> dict:
    """
    Devuelve el contacto al que avisar de un lead asignado a `agent_id`:
    el del propio agente si es un miembro con datos, o el del dueño como respaldo.
    Claves: name, email, whatsapp.
    """
    owner = get_tenant(tenant_id) or {}
    contacto_owner = {
        "name":     owner.get("name", ""),
        "email":    owner.get("notify_email") or owner.get("email", ""),
        "whatsapp": owner.get("whatsapp_number", "") if owner.get("whatsapp_enabled") else "",
    }

    # Sin agente, o el agente es el propio dueño → contacto del dueño
    if not agent_id or agent_id == tenant_id:
        return contacto_owner

    for m in get_team_members(tenant_id):
        if m["member_id"] == agent_id:
            return {
                "name":     m["member_name"] or contacto_owner["name"],
                "email":    m["member_email"] or contacto_owner["email"],
                "whatsapp": m["member_whatsapp"],  # del miembro; si no tiene, no se le avisa por WA
            }
    return contacto_owner


def get_owner_for_member(member_id: str) -> Optional[str]:
    """Si el user_id es miembro de un equipo, devuelve el owner_id (tenant real)."""
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT owner_id FROM team_members WHERE member_id=:member LIMIT 1"),
            {"member": member_id},
        ).fetchone()
    return row[0] if row else None


# ─────────────────────────────────────────────
# Reparto de leads entre agentes (plan agencia)
# ─────────────────────────────────────────────

def _agentes_con_nombre(tenant_id: str) -> list:
    """Lista de (agent_id, nombre) del equipo: el dueño primero, luego los miembros."""
    owner = get_tenant(tenant_id)
    nombre_owner = (owner.get("name") if owner else "") or "Cuenta principal"
    agentes = [(tenant_id, nombre_owner)]
    for m in get_team_members(tenant_id):
        agentes.append((m["member_id"], m["member_name"] or m["member_id"][:12]))
    return agentes


def get_agent_ids(tenant_id: str) -> list:
    """IDs de los agentes del tenant (dueño + miembros), en orden estable."""
    return [aid for aid, _ in _agentes_con_nombre(tenant_id)]


def pick_next_agent(tenant_id: str) -> Optional[str]:
    """
    Elige el siguiente agente para un lead nuevo (round-robin balanceado por carga).
    Devuelve None si el tenant no tiene equipo (no hay a quién repartir).
    """
    from core.assignment import choose_next_agent

    agentes = get_agent_ids(tenant_id)
    if len(agentes) <= 1:
        return None  # cuenta individual: sin equipo no se reparte

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT assigned_to, COUNT(*) FROM leads
                WHERE tenant_id = :tid AND assigned_to IS NOT NULL
                GROUP BY assigned_to
            """),
            {"tid": tenant_id},
        ).fetchall()
    counts = {r[0]: r[1] for r in rows}
    return choose_next_agent(agentes, counts)


def assign_lead(lead_id: str, tenant_id: str, agent_id: Optional[str]) -> None:
    """Asigna (o reasigna) un lead a un agente del tenant. agent_id=None lo deja sin asignar."""
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE leads SET assigned_to = :aid WHERE id = :id AND tenant_id = :tid"),
            {"aid": agent_id, "id": lead_id, "tid": tenant_id},
        )
    logger.info("Lead %s asignado a %s (tenant: %s)", lead_id, agent_id, tenant_id)


def get_agent_leaderboard(tenant_id: str) -> dict:
    """
    Ranking de rendimiento por agente: total de leads, calientes, cerrados,
    pendientes y score medio. Ordenado por operaciones cerradas.
    """
    agentes = _agentes_con_nombre(tenant_id)

    with engine.connect() as conn:
        filas = conn.execute(
            text("""
                SELECT assigned_to,
                       COUNT(*)                                            AS total,
                       SUM(CASE WHEN score >= 8     THEN 1 ELSE 0 END)     AS calientes,
                       SUM(CASE WHEN status = 'CERRADO' THEN 1 ELSE 0 END) AS cerrados,
                       SUM(CASE WHEN status = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
                       AVG(score)                                          AS score_avg
                FROM leads
                WHERE tenant_id = :tid AND assigned_to IS NOT NULL
                GROUP BY assigned_to
            """),
            {"tid": tenant_id},
        ).fetchall()
        sin_asignar = conn.execute(
            text("SELECT COUNT(*) FROM leads WHERE tenant_id = :tid AND assigned_to IS NULL"),
            {"tid": tenant_id},
        ).scalar() or 0

    por_agente = {r[0]: r for r in filas}
    ranking = []
    for aid, nombre in agentes:
        r = por_agente.get(aid)
        ranking.append({
            "agent_id":   aid,
            "name":       nombre,
            "total":      r[1] if r else 0,
            "calientes":  r[2] if r else 0,
            "cerrados":   r[3] if r else 0,
            "pendientes": r[4] if r else 0,
            "score_avg":  round(float(r[5]), 1) if r and r[5] is not None else 0,
        })

    ranking.sort(key=lambda a: (-a["cerrados"], -a["total"], a["name"]))
    return {"agents": ranking, "sin_asignar": sin_asignar}


def get_stats(tenant_id: str) -> dict:
    """Estadísticas avanzadas de leads para el tenant."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    inicio_mes = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    # Mes anterior
    if now.month == 1:
        mes_ant = now.replace(year=now.year - 1, month=12, day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    else:
        mes_ant = now.replace(month=now.month - 1, day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    with engine.connect() as conn:
        total = conn.execute(
            text("SELECT COUNT(*) FROM leads WHERE tenant_id=:tid"),
            {"tid": tenant_id},
        ).scalar() or 0

        este_mes = conn.execute(
            text("SELECT COUNT(*) FROM leads WHERE tenant_id=:tid AND created_at >= :start"),
            {"tid": tenant_id, "start": inicio_mes},
        ).scalar() or 0

        mes_anterior = conn.execute(
            text("SELECT COUNT(*) FROM leads WHERE tenant_id=:tid AND created_at >= :start AND created_at < :end"),
            {"tid": tenant_id, "start": mes_ant, "end": inicio_mes},
        ).scalar() or 0

        # Por estado
        por_estado_rows = conn.execute(
            text("SELECT status, COUNT(*) FROM leads WHERE tenant_id=:tid GROUP BY status"),
            {"tid": tenant_id},
        ).fetchall()
        por_estado = {r[0]: r[1] for r in por_estado_rows}

        # Score promedio
        score_avg = conn.execute(
            text("SELECT AVG(score) FROM leads WHERE tenant_id=:tid AND score IS NOT NULL"),
            {"tid": tenant_id},
        ).scalar()

        # Distribución por rango de score
        calientes = conn.execute(
            text("SELECT COUNT(*) FROM leads WHERE tenant_id=:tid AND score >= 8"),
            {"tid": tenant_id},
        ).scalar() or 0
        tibios = conn.execute(
            text("SELECT COUNT(*) FROM leads WHERE tenant_id=:tid AND score >= 5 AND score < 8"),
            {"tid": tenant_id},
        ).scalar() or 0
        frios = conn.execute(
            text("SELECT COUNT(*) FROM leads WHERE tenant_id=:tid AND score < 5 AND score IS NOT NULL"),
            {"tid": tenant_id},
        ).scalar() or 0

        # Últimos 6 meses (año-mes, count)
        ultimos_6 = conn.execute(
            text("""
                SELECT substr(created_at, 1, 7) AS mes, COUNT(*) AS total
                FROM leads WHERE tenant_id=:tid
                GROUP BY mes
                ORDER BY mes DESC
                LIMIT 6
            """),
            {"tid": tenant_id},
        ).fetchall()

    return {
        "total":        total,
        "este_mes":     este_mes,
        "mes_anterior": mes_anterior,
        "por_estado":   por_estado,
        "score_avg":    round(float(score_avg), 1) if score_avg else 0,
        "calientes":    calientes,
        "tibios":       tibios,
        "frios":        frios,
        "por_mes":      [{"mes": r[0], "total": r[1]} for r in ultimos_6],
    }


def get_all_tenants() -> list:
    """Devuelve todos los tenants. Solo para uso del panel de administración."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT * FROM tenants ORDER BY created_at DESC")
        ).fetchall()
    return [dict(r._mapping) for r in rows]


def count_leads_for_tenant(tenant_id: str, agent_id: Optional[str] = None) -> int:
    """Cuenta los leads del tenant. Con agent_id, solo los asignados a ese agente."""
    sql = "SELECT COUNT(*) FROM leads WHERE tenant_id = :tid"
    params = {"tid": tenant_id}
    if agent_id is not None:
        sql += " AND assigned_to = :aid"
        params["aid"] = agent_id
    with engine.connect() as conn:
        result = conn.execute(text(sql), params).scalar()
    return result or 0


def get_lead_counts(tenant_id: str, agent_id: Optional[str] = None) -> dict:
    """
    Conteo total y por temperatura (mismos cortes que las estadísticas:
    CALIENTE >= 8, TIBIO 5-7, FRÍO < 5). Respeta la visibilidad por agente.
    Sirve para que el dashboard muestre cifras REALES, no solo lo paginado.
    """
    where = "FROM leads WHERE tenant_id = :tid"
    params = {"tid": tenant_id}
    if agent_id is not None:
        where += " AND assigned_to = :aid"
        params["aid"] = agent_id
    with engine.connect() as conn:
        total = conn.execute(text(f"SELECT COUNT(*) {where}"), params).scalar() or 0
        cal = conn.execute(text(f"SELECT COUNT(*) {where} AND score >= 8"), params).scalar() or 0
        tib = conn.execute(text(f"SELECT COUNT(*) {where} AND score >= 5 AND score < 8"), params).scalar() or 0
        fri = conn.execute(text(f"SELECT COUNT(*) {where} AND score < 5 AND score IS NOT NULL"), params).scalar() or 0
    return {"total": total, "calientes": cal, "tibios": tib, "frios": fri}


# ─────────────────────────────────────────────
# Operaciones CRUD de Leads
# ─────────────────────────────────────────────

def save_lead(
    lead_id: str,
    tenant_id: str,
    name: str,
    email: str,
    phone: Optional[str],
    message: str,
    classification: Optional[str],
    score: Optional[int],
    reasoning: str,
    generated_email: Optional[str],
    recommended_actions: list,
    intent_analysis: dict,
    company_info: dict,
    assigned_to: Optional[str] = None,
    email_sent: Optional[int] = None,
) -> None:
    """Guarda un lead procesado completo."""
    now = datetime.now(timezone.utc).isoformat()

    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO leads (
                    id, tenant_id, name, email, phone, message,
                    classification, score, reasoning,
                    generated_email, recommended_actions,
                    intent_analysis, company_info,
                    status, assigned_to, email_sent, created_at, processed_at
                ) VALUES (
                    :id, :tenant_id, :name, :email, :phone, :message,
                    :classification, :score, :reasoning,
                    :generated_email, :recommended_actions,
                    :intent_analysis, :company_info,
                    'PENDIENTE', :assigned_to, :email_sent, :created_at, :processed_at
                )
            """),
            {
                "id": lead_id,
                "tenant_id": tenant_id,
                "name": name,
                "email": email,
                "phone": phone,
                "message": message,
                "classification": classification,
                "score": score,
                "reasoning": reasoning,
                "generated_email": generated_email,
                "recommended_actions": json.dumps(recommended_actions, ensure_ascii=False),
                "intent_analysis":    json.dumps(intent_analysis,    ensure_ascii=False),
                "company_info":       json.dumps(company_info,       ensure_ascii=False),
                "assigned_to":  assigned_to,
                "email_sent":   email_sent,
                "created_at":   now,
                "processed_at": now,
            },
        )

    logger.info("Lead %s guardado (tenant: %s, clasificacion: %s)", lead_id, tenant_id, classification)


def get_lead_by_id(lead_id: str, tenant_id: str, agent_id: Optional[str] = None) -> Optional[dict]:
    """Recupera un lead por ID, restringido al tenant. Con agent_id, solo si es suyo."""
    sql = "SELECT * FROM leads WHERE id = :id AND tenant_id = :tid"
    params = {"id": lead_id, "tid": tenant_id}
    if agent_id is not None:
        sql += " AND assigned_to = :aid"
        params["aid"] = agent_id
    with engine.connect() as conn:
        row = conn.execute(text(sql), params).fetchone()
    return _row_a_dict(row) if row else None


def get_leads_by_email(email: str, tenant_id: str, agent_id: Optional[str] = None) -> list:
    """Recupera los leads de un email para este tenant. Con agent_id, solo los suyos."""
    sql = "SELECT * FROM leads WHERE email = :email AND tenant_id = :tid"
    params = {"email": email, "tid": tenant_id}
    if agent_id is not None:
        sql += " AND assigned_to = :aid"
        params["aid"] = agent_id
    sql += " ORDER BY created_at DESC"
    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).fetchall()
    return [_row_a_dict(r) for r in rows]


def get_recent_leads(limit: int = 100, tenant_id: str = "legacy", offset: int = 0,
                     agent_id: Optional[str] = None) -> list:
    """
    Leads del tenant por fecha desc, con paginación. Con agent_id, solo los
    asignados a ese agente ("mis leads").
    """
    sql = "SELECT * FROM leads WHERE tenant_id = :tid"
    params = {"limit": limit, "tid": tenant_id, "offset": offset}
    if agent_id is not None:
        sql += " AND assigned_to = :aid"
        params["aid"] = agent_id
    sql += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).fetchall()
    return [_row_a_dict(r) for r in rows]


# ─────────────────────────────────────────────
# Notificaciones de sistema
# ─────────────────────────────────────────────

def add_notification(tenant_id: str, tipo: str, title: str, body: str = "") -> None:
    """Crea una notificación de sistema para un tenant (pago, cambio de plan…)."""
    import uuid
    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO notifications (id, tenant_id, type, title, body, read, created_at)
                VALUES (:id, :t, :ty, :ti, :b, 0, :c)
            """),
            {
                "id": str(uuid.uuid4()), "t": tenant_id, "ty": tipo,
                "ti": title, "b": body, "c": datetime.now(timezone.utc).isoformat(),
            },
        )


def get_notifications(tenant_id: str, limit: int = 20) -> list:
    """Últimas notificaciones de sistema del tenant."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT * FROM notifications WHERE tenant_id = :t ORDER BY created_at DESC LIMIT :l"),
            {"t": tenant_id, "l": limit},
        ).fetchall()
    return [dict(r._mapping) for r in rows]


def count_unread_notifications(tenant_id: str) -> int:
    """Número de notificaciones de sistema sin leer."""
    with engine.connect() as conn:
        n = conn.execute(
            text("SELECT COUNT(*) FROM notifications WHERE tenant_id = :t AND read = 0"),
            {"t": tenant_id},
        ).scalar()
    return n or 0


def mark_notifications_read(tenant_id: str) -> None:
    """Marca como leídas todas las notificaciones del tenant."""
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE notifications SET read = 1 WHERE tenant_id = :t"),
            {"t": tenant_id},
        )


def get_digest_counts(tenant_id: str, since_iso: str) -> dict:
    """Conteos para el resumen semanal: nuevos en el periodo, calientes y pendientes."""
    with engine.connect() as conn:
        nuevos = conn.execute(
            text("SELECT COUNT(*) FROM leads WHERE tenant_id=:t AND created_at >= :since"),
            {"t": tenant_id, "since": since_iso},
        ).scalar() or 0
        calientes = conn.execute(
            text("SELECT COUNT(*) FROM leads WHERE tenant_id=:t AND created_at >= :since AND score >= 8"),
            {"t": tenant_id, "since": since_iso},
        ).scalar() or 0
        pendientes = conn.execute(
            text("SELECT COUNT(*) FROM leads WHERE tenant_id=:t AND status='PENDIENTE'"),
            {"t": tenant_id},
        ).scalar() or 0
    return {"nuevos": nuevos, "calientes": calientes, "pendientes": pendientes}


def get_stale_pending_leads(tenant_id: str, dias: int = 2, min_score: int = 5) -> list:
    """Leads buenos (score >= min_score) en estado PENDIENTE desde hace más de `dias` días."""
    from datetime import datetime, timezone, timedelta
    limite = (datetime.now(timezone.utc) - timedelta(days=dias)).isoformat()
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT name, email, score, created_at FROM leads
                WHERE tenant_id = :t AND status = 'PENDIENTE'
                  AND score >= :ms AND created_at <= :lim
                ORDER BY score DESC, created_at ASC
                LIMIT 20
            """),
            {"t": tenant_id, "ms": min_score, "lim": limite},
        ).fetchall()
    return [dict(r._mapping) for r in rows]


def mark_lead_email_sent(lead_id: str, tenant_id: str, body: Optional[str] = None) -> None:
    """
    Marca el email del lead como enviado. Si `body` viene informado, guarda esa
    versión (posiblemente editada por el agente) como el email definitivo.
    """
    sql = "UPDATE leads SET email_sent = 1"
    params: dict = {"id": lead_id, "tid": tenant_id}
    if body is not None:
        sql += ", generated_email = :body"
        params["body"] = body
    sql += " WHERE id = :id AND tenant_id = :tid"
    with engine.begin() as conn:
        conn.execute(text(sql), params)
    logger.info("Email del lead %s marcado como enviado (tenant: %s)", lead_id, tenant_id)


def set_lead_feedback(lead_id: str, tenant_id: str, feedback: Optional[int]) -> None:
    """Guarda el feedback del agente sobre la clasificación (1 acierto, -1 fallo, None borra)."""
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE leads SET score_feedback = :fb WHERE id = :id AND tenant_id = :tid"),
            {"fb": feedback, "id": lead_id, "tid": tenant_id},
        )


def update_lead_status(lead_id: str, status: str, tenant_id: str) -> None:
    """Actualiza el estado de un lead, verificando que pertenece al tenant."""
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE leads SET status = :status WHERE id = :id AND tenant_id = :tid"),
            {"status": status, "id": lead_id, "tid": tenant_id},
        )
    logger.info("Lead %s → estado %s (tenant: %s)", lead_id, status, tenant_id)


def delete_lead(lead_id: str, tenant_id: str) -> None:
    """Elimina un lead, verificando que pertenece al tenant."""
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM leads WHERE id = :id AND tenant_id = :tid"),
            {"id": lead_id, "tid": tenant_id},
        )
    logger.info("Lead %s eliminado (tenant: %s)", lead_id, tenant_id)


# ─────────────────────────────────────────────
# Helper interno
# ─────────────────────────────────────────────

def _row_a_dict(row) -> dict:
    """Convierte una fila de SQLAlchemy a dict y deserializa campos JSON."""
    data = dict(row._mapping)
    for campo in ("recommended_actions", "intent_analysis", "company_info"):
        valor = data.get(campo)
        if isinstance(valor, str):
            try:
                data[campo] = json.loads(valor)
            except Exception:
                pass
    return data
