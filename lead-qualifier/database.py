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
from datetime import datetime
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
    ]:
        try:
            with engine.begin() as conn:
                conn.execute(text(migration_sql))
            logger.info("Migración aplicada: %s", migration_sql[:60])
        except Exception:
            pass  # Ya existe — ignorar

    # Índices para rendimiento
    with engine.begin() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leads_email     ON leads (email)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leads_created   ON leads (created_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leads_tenant    ON leads (tenant_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tenants_email   ON tenants (email)"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_api_key ON tenants (api_key)"))

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
                    "created_at": datetime.utcnow().isoformat(),
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
    now = datetime.utcnow().isoformat()
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
    classification: str,
    score: int,
    reasoning: str,
    generated_email: str,
    recommended_actions: list,
    intent_analysis: dict,
    company_info: dict,
) -> None:
    """Guarda un lead procesado completo."""
    now = datetime.utcnow().isoformat()

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


def get_recent_leads(limit: int = 100, tenant_id: str = "legacy") -> list:
    """Devuelve los últimos N leads del tenant."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT * FROM leads WHERE tenant_id = :tid ORDER BY created_at DESC LIMIT :limit"),
            {"limit": limit, "tid": tenant_id},
        ).fetchall()
    return [_row_a_dict(r) for r in rows]


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
