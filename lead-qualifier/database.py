"""
Capa de base de datos con SQLAlchemy.
- Si DATABASE_URL está definida → PostgreSQL (producción en Railway)
- Si no → SQLite local (desarrollo)

Cambiar de base de datos no requiere tocar nada más que la variable de entorno.
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
# Configuración del engine según el entorno
# ─────────────────────────────────────────────

def _crear_engine():
    database_url = os.getenv("DATABASE_URL")

    if database_url:
        # Railway provee la URL con el prefijo antiguo "postgres://", pero
        # SQLAlchemy 1.4+ requiere "postgresql://"
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)

        logger.info("BD: PostgreSQL (produccion)")
        return create_engine(database_url)

    # Modo local: SQLite
    db_path = Path(__file__).parent / "leads.db"
    logger.info("BD: SQLite local en %s", db_path)
    return create_engine(
        f"sqlite:///{db_path}",
        # check_same_thread=False necesario para SQLite con múltiples workers
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

    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS leads (
                id                  TEXT PRIMARY KEY,
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

        # Migración segura: añadir status si la tabla ya existía sin esa columna
        try:
            conn.execute(text(
                "ALTER TABLE leads ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDIENTE'"
            ))
            logger.info("Columna 'status' añadida (migracion)")
        except Exception:
            pass  # Ya existe — ignorar

        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at)"
        ))

    logger.info("Base de datos lista")


# ─────────────────────────────────────────────
# Operaciones CRUD
# ─────────────────────────────────────────────

def save_lead(
    lead_id: str,
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
                    id, name, email, phone, message,
                    classification, score, reasoning,
                    generated_email, recommended_actions,
                    intent_analysis, company_info,
                    status, created_at, processed_at
                ) VALUES (
                    :id, :name, :email, :phone, :message,
                    :classification, :score, :reasoning,
                    :generated_email, :recommended_actions,
                    :intent_analysis, :company_info,
                    'PENDIENTE', :created_at, :processed_at
                )
            """),
            {
                "id": lead_id,
                "name": name,
                "email": email,
                "phone": phone,
                "message": message,
                "classification": classification,
                "score": score,
                "reasoning": reasoning,
                "generated_email": generated_email,
                "recommended_actions": json.dumps(recommended_actions, ensure_ascii=False),
                "intent_analysis": json.dumps(intent_analysis, ensure_ascii=False),
                "company_info": json.dumps(company_info, ensure_ascii=False),
                "created_at": now,
                "processed_at": now,
            },
        )

    logger.info("Lead %s guardado (clasificacion: %s)", lead_id, classification)


def get_lead_by_id(lead_id: str) -> Optional[dict]:
    """Recupera un lead por su ID."""
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM leads WHERE id = :id"),
            {"id": lead_id},
        ).fetchone()

    if row is None:
        return None

    return _row_a_dict(row)


def get_leads_by_email(email: str) -> list:
    """Recupera todos los leads de un mismo email (historial)."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT * FROM leads WHERE email = :email ORDER BY created_at DESC"),
            {"email": email},
        ).fetchall()

    return [_row_a_dict(r) for r in rows]


def get_recent_leads(limit: int = 100) -> list:
    """Devuelve los últimos N leads procesados con todos sus campos."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT * FROM leads ORDER BY created_at DESC LIMIT :limit"),
            {"limit": limit},
        ).fetchall()

    return [_row_a_dict(r) for r in rows]


def update_lead_status(lead_id: str, status: str) -> None:
    """Actualiza el estado de un lead."""
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE leads SET status = :status WHERE id = :id"),
            {"status": status, "id": lead_id},
        )
    logger.info("Lead %s → estado %s", lead_id, status)


def delete_lead(lead_id: str) -> None:
    """Elimina un lead de la base de datos."""
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM leads WHERE id = :id"),
            {"id": lead_id},
        )
    logger.info("Lead %s eliminado", lead_id)


# ─────────────────────────────────────────────
# Helper interno
# ─────────────────────────────────────────────

def _row_a_dict(row) -> dict:
    """Convierte una fila de SQLAlchemy a dict y desserializa campos JSON."""
    data = dict(row._mapping)

    for campo in ("recommended_actions", "intent_analysis", "company_info"):
        valor = data.get(campo)
        if isinstance(valor, str):
            try:
                data[campo] = json.loads(valor)
            except Exception:
                pass  # dejar el valor como string si no se puede parsear

    return data
