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
                owner_id   TEXT NOT NULL,
                member_id  TEXT NOT NULL,
                added_at   TEXT NOT NULL,
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


def add_team_member(owner_id: str, member_id: str) -> None:
    """Añade un usuario de Clerk como miembro del equipo del tenant owner."""
    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO team_members (owner_id, member_id, added_at)
                VALUES (:owner, :member, :ts)
                ON CONFLICT DO NOTHING
            """),
            {"owner": owner_id, "member": member_id, "ts": datetime.now(timezone.utc).isoformat()},
        )


def remove_team_member(owner_id: str, member_id: str) -> None:
    """Elimina un miembro del equipo."""
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM team_members WHERE owner_id=:owner AND member_id=:member"),
            {"owner": owner_id, "member": member_id},
        )


def get_team_members(owner_id: str) -> list:
    """Devuelve los IDs de Clerk de los miembros del equipo del tenant."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT member_id, added_at FROM team_members WHERE owner_id=:owner ORDER BY added_at"),
            {"owner": owner_id},
        ).fetchall()
    return [{"member_id": r[0], "added_at": r[1]} for r in rows]


def get_owner_for_member(member_id: str) -> Optional[str]:
    """Si el user_id es miembro de un equipo, devuelve el owner_id (tenant real)."""
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT owner_id FROM team_members WHERE member_id=:member LIMIT 1"),
            {"member": member_id},
        ).fetchone()
    return row[0] if row else None


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


def count_leads_for_tenant(tenant_id: str) -> int:
    """Cuenta los leads totales de un tenant (para el panel de admin)."""
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT COUNT(*) FROM leads WHERE tenant_id = :tid"),
            {"tid": tenant_id},
        ).scalar()
    return result or 0


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
                    status, created_at, processed_at
                ) VALUES (
                    :id, :tenant_id, :name, :email, :phone, :message,
                    :classification, :score, :reasoning,
                    :generated_email, :recommended_actions,
                    :intent_analysis, :company_info,
                    'PENDIENTE', :created_at, :processed_at
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
                "created_at":   now,
                "processed_at": now,
            },
        )

    logger.info("Lead %s guardado (tenant: %s, clasificacion: %s)", lead_id, tenant_id, classification)


def get_lead_by_id(lead_id: str, tenant_id: str) -> Optional[dict]:
    """Recupera un lead por ID, restringido al tenant."""
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM leads WHERE id = :id AND tenant_id = :tid"),
            {"id": lead_id, "tid": tenant_id},
        ).fetchone()
    return _row_a_dict(row) if row else None


def get_leads_by_email(email: str, tenant_id: str) -> list:
    """Recupera todos los leads de un email para este tenant."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT * FROM leads WHERE email = :email AND tenant_id = :tid ORDER BY created_at DESC"),
            {"email": email, "tid": tenant_id},
        ).fetchall()
    return [_row_a_dict(r) for r in rows]


def get_recent_leads(limit: int = 100, tenant_id: str = "legacy", offset: int = 0) -> list:
    """Devuelve los leads del tenant ordenados por fecha desc, con paginación (limit/offset)."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT * FROM leads WHERE tenant_id = :tid ORDER BY created_at DESC LIMIT :limit OFFSET :offset"),
            {"limit": limit, "tid": tenant_id, "offset": offset},
        ).fetchall()
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
