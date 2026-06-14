"""
FastAPI app principal — multi-tenant con autenticación via JWT de Clerk.

Ensambla la aplicación: middleware, ciclo de vida (lifespan), scheduler de
jobs en segundo plano y los routers. La lógica de cada área vive en su módulo:

  config.py         → constantes de negocio (límites, rate limits)
  runtime.py        → cliente de Anthropic compartido
  security.py       → cifrado Fernet, JWKS de Clerk, rate limiting
  deps.py           → dependencias FastAPI (auth multi-tenant, guards de plan/admin)
  notifications.py  → aviso por email a la agencia
  jobs.py           → jobs del scheduler (IMAP, resumen semanal, leads sin contactar)
  routers/          → endpoints agrupados por área

Variables de entorno necesarias:
  ANTHROPIC_API_KEY   → clave de la API de Anthropic
  CLERK_JWKS_URL      → URL del JWKS de Clerk para verificar tokens
                        Ejemplo: https://tu-instancia.clerk.accounts.dev/.well-known/jwks.json
  DATABASE_URL        → (opcional) PostgreSQL en producción. Sin ella usa SQLite local.
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import stripe
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import jobs
import runtime
from core.agent import _make_anthropic_client
from core.database import init_db
from routers import (
    admin, ads, billing, health, imap, intake, leads, profile, stats, team,
)

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

# ─────────────────────────────────────────────
# Monitorización de errores (Sentry) — opcional
# Solo se activa si SENTRY_DSN está definida. Sin la variable, no hace nada.
# ─────────────────────────────────────────────
_sentry_dsn = os.getenv("SENTRY_DSN", "").strip()
if _sentry_dsn:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=_sentry_dsn,
            environment=os.getenv("SENTRY_ENV", "production"),
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            send_default_pii=False,
        )
        logger.info("Sentry activado (monitorización de errores)")
    except Exception as exc:  # pragma: no cover
        logger.warning("No se pudo iniciar Sentry: %s", exc)


# ─────────────────────────────────────────────
# Scheduler de jobs en segundo plano
# ─────────────────────────────────────────────
_scheduler = AsyncIOScheduler(timezone="UTC")


# ─────────────────────────────────────────────
# Ciclo de vida: inicializar BD, cliente IA y scheduler al arrancar
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Arrancando Lead Qualifier API (multi-tenant)")
    init_db()

    if not os.getenv("ANTHROPIC_API_KEY"):
        logger.error("ANTHROPIC_API_KEY no definida en .env")
        raise RuntimeError("ANTHROPIC_API_KEY es obligatoria")

    # Crear el cliente de Anthropic una sola vez y reutilizarlo en todos los requests/jobs
    runtime.anthropic_client = _make_anthropic_client(os.getenv("ANTHROPIC_API_KEY"))
    logger.info("Cliente de Anthropic inicializado")

    if not os.getenv("CLERK_JWKS_URL"):
        logger.warning("CLERK_JWKS_URL no definida — modo dev sin autenticación")
    else:
        logger.info("Auth: Clerk JWT activo")

    # Stripe
    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    if stripe_key:
        stripe.api_key = stripe_key
        logger.info("Stripe configurado")
    else:
        logger.warning("STRIPE_SECRET_KEY no definida — pagos desactivados")

    # Arrancar scheduler IMAP (cada 10 minutos)
    _scheduler.add_job(jobs.sync_imap_todos, "interval", minutes=10, id="imap_sync")
    # Resumen semanal — lunes a las 08:00 UTC
    _scheduler.add_job(jobs.enviar_resumenes_semanales, "cron", day_of_week="mon", hour=8, id="resumen_semanal")
    # Aviso de leads sin contactar — cada día a las 09:00 UTC
    _scheduler.add_job(jobs.avisar_leads_sin_contactar, "cron", hour=9, id="leads_sin_contactar")
    _scheduler.start()
    logger.info("Scheduler arrancado (IMAP 10 min · resumen semanal · avisos diarios)")

    yield

    _scheduler.shutdown(wait=False)
    logger.info("Cerrando Lead Qualifier API")


# ─────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────
app = FastAPI(
    title="Lead Qualifier API",
    description="Agente de IA multi-tenant para cualificación de leads",
    version="2.0.0",
    lifespan=lifespan,
)


def _allowed_origins() -> list[str]:
    """
    Orígenes permitidos para CORS. Se construye desde variables de entorno
    para no exponer la API a cualquier web (evita CSRF/abuso desde terceros).

    - ALLOWED_ORIGINS: lista separada por comas (tiene prioridad).
    - DASHBOARD_URL / FRONTEND_URL: la URL del dashboard en producción.
    - localhost:3000 siempre permitido para desarrollo.
    """
    origins: list[str] = []
    raw = os.getenv("ALLOWED_ORIGINS", "")
    origins.extend(o.strip().rstrip("/") for o in raw.split(",") if o.strip())
    for var in ("DASHBOARD_URL", "FRONTEND_URL"):
        v = os.getenv(var, "").strip().rstrip("/")
        if v:
            origins.append(v)
    for dev in ("http://localhost:3000", "http://127.0.0.1:3000"):
        origins.append(dev)
    # Sin duplicados, preservando orden
    return list(dict.fromkeys(origins))


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    # Permite cualquier despliegue en Vercel (producción y previews) sin tener que
    # configurar la URL exacta. El dominio propio se añade vía DASHBOARD_URL.
    allow_origin_regex=r"https://([a-z0-9-]+\.)*vercel\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Admin-Key"],
)


# ─────────────────────────────────────────────
# Routers
# ─────────────────────────────────────────────
app.include_router(health.router)
app.include_router(leads.router)
app.include_router(profile.router)
app.include_router(imap.router)
app.include_router(team.router)
app.include_router(intake.router)
app.include_router(billing.router)
app.include_router(stats.router)
app.include_router(ads.router)
app.include_router(admin.router)


# ─────────────────────────────────────────────
# Manejador global de errores
# ─────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Error en %s: %s", request.url, str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor"},
    )
