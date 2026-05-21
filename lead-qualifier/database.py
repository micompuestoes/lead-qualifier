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
                id         TEXT PRIMARY KEY,
                email      TEXT NOT NULL,
                name       TEXT,
                plan       TEXT NOT NULL DEFAULT 'free',
                created_at TEXT NOT NULL
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
    ]:
        try:
            with engine.begin() as conn:
                conn.execute(text(migration_sql))
            logger.info("Migración aplicada: %s", migration_sql[:50])
        except Exception:
            pass  # Ya existe — ignorar

    # Índices para rendimiento
    with engine.begin() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leads_email     ON leads (email)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leads_created   ON leads (created_at)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leads_tenant    ON leads (tenant_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tenants_email   ON tenants (email)"))

    logger.info("Base de datos lista")


# ─────────────────────────────────────────────
# Operaciones de Tenants
# ─────────────────────────────────────────────

def ensure_tenant(tenant_id: str, email: str = "", name: str = "") -> None:
    """Crea el tenant si no existe. Seguro de llamar en cada request."""
    with engine.begin() as conn:
        existing = conn.execute(
            text("SELECT id FROM tenants WHERE id = :id"),
            {"id": tenant_id},
        ).fetchone()

        if not existing:
            conn.execute(
                text("""
                    INSERT INTO tenants (id, email, name, plan, created_at)
                    VALUES (:id, :email, :name, 'free', :created_at)
                """),
                {
                    "id": tenant_id,
                    "email": email,
                    "name": name or email.split("@")[0],
                    "created_at": datetime.utcnow().isoformat(),
                },
            )
            logger.info("Tenant creado: %s (%s)", tenant_id, email)


def get_tenant(tenant_id: str) -> Optional[dict]:
    """Devuelve los datos del tenant o None si no existe."""
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM tenants WHERE id = :id"),
            {"id": tenant_id},
        ).fetchone()
    return dict(row._mapping) if row else None


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
