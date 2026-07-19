"""
Entorno de los tests — el módulo se ejecuta ANTES de importar la app.

Aislamiento en dos fases porque main.py hace load_dotenv(override=True):
  1) Al arrancar pytest: limpiar env y borrar la SQLite local (base determinista).
     El engine se crea al importar core.database, ANTES del load_dotenv de main,
     así que siempre usa SQLite en tests.
  2) En el fixture `client`: tras importar main (que recarga el .env local del
     desarrollador), volver a neutralizar las claves peligrosas ANTES de arrancar
     la app. Así los tests jamás llaman a Anthropic/SMTP/Stripe reales.
"""

import os
from pathlib import Path

import pytest

_VARS_PELIGROSAS = (
    "DATABASE_URL", "CLERK_JWKS_URL", "STRIPE_WEBHOOK_SECRET", "STRIPE_SECRET_KEY",
    "SENDGRID_API_KEY", "SMTP_HOST", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID",
)


def _aislar_entorno() -> None:
    os.environ["ANTHROPIC_API_KEY"] = "test-dummy"   # la IA cae al fallback determinista
    for var in _VARS_PELIGROSAS:
        os.environ.pop(var, None)


# Fase 1: antes de que ningún test importe nada
_aislar_entorno()
_db = Path(__file__).parent.parent / "core" / "leads.db"
if _db.exists():
    _db.unlink()


@pytest.fixture(scope="session")
def client():
    """App real con TestClient (lifespan incluido), compartida por toda la sesión."""
    import main                       # su load_dotenv puede recargar el .env local…
    _aislar_entorno()                 # …fase 2: re-aislar antes de arrancar la app
    from fastapi.testclient import TestClient
    from core.database import ensure_tenant

    with TestClient(main.app) as c:
        ensure_tenant("dev-tenant", "owner@test.com", "Agencia Test")
        yield c
