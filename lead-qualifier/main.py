"""
FastAPI app principal — multi-tenant con autenticación via JWT de Clerk.

Variables de entorno necesarias:
  ANTHROPIC_API_KEY   → clave de la API de Anthropic
  CLERK_JWKS_URL      → URL del JWKS de Clerk para verificar tokens
                        Ejemplo: https://tu-instancia.clerk.accounts.dev/.well-known/jwks.json
  DATABASE_URL        → (opcional) PostgreSQL en producción. Sin ella usa SQLite local.
"""

import json
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal, Optional

import anthropic
import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from pydantic import BaseModel

from database import (
    delete_lead, ensure_tenant, get_lead_by_id,
    get_leads_by_email, get_recent_leads, init_db,
    update_lead_status,
)
from email_sender import send_lead_response_email
from models import LeadInput, LeadOutput
from agent import qualify_lead, _make_anthropic_client

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
# Modelos Pydantic
# ─────────────────────────────────────────────
EstadoLiteral = Literal["PENDIENTE", "CONTACTADO", "CERRADO", "DESCARTADO"]

class ActualizarEstadoInput(BaseModel):
    status: EstadoLiteral


# ─────────────────────────────────────────────
# Verificación JWT de Clerk (multi-tenant)
# ─────────────────────────────────────────────

# Caché del JWKS — se refresca cada hora para no hacer fetch en cada petición
_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}


async def _obtener_jwks() -> dict:
    """Obtiene y cachea el JWKS de Clerk (1h de TTL)."""
    global _jwks_cache
    ahora = time.time()
    if _jwks_cache["keys"] and ahora - _jwks_cache["fetched_at"] < 3600:
        return _jwks_cache["keys"]

    jwks_url = os.getenv("CLERK_JWKS_URL")
    if not jwks_url:
        raise RuntimeError("CLERK_JWKS_URL no está definida en las variables de entorno")

    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url, timeout=10)
        resp.raise_for_status()

    _jwks_cache = {"keys": resp.json(), "fetched_at": ahora}
    logger.info("JWKS de Clerk actualizado")
    return _jwks_cache["keys"]


async def get_tenant_id(request: Request) -> str:
    """
    Dependency de FastAPI que extrae el tenant_id del JWT de Clerk.

    Si CLERK_JWKS_URL no está configurada (entorno local sin auth),
    devuelve 'dev-tenant' para no bloquear el desarrollo.
    """
    if not os.getenv("CLERK_JWKS_URL"):
        return "dev-tenant"  # modo desarrollo sin auth

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token de autenticación requerido")

    token = auth_header[7:]
    try:
        jwks = await _obtener_jwks()
        # options: no verificar audiencia (Clerk no siempre la incluye en tokens de sesión)
        payload = jwt.decode(
            token, jwks,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        tenant_id: str = payload.get("sub", "")
        if not tenant_id:
            raise HTTPException(status_code=401, detail="Token sin subject (sub)")
        return tenant_id

    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token inválido: {str(e)}")


# ─────────────────────────────────────────────
# Lifecycle: inicializar BD al arrancar
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Arrancando Lead Qualifier API (multi-tenant)")
    init_db()

    if not os.getenv("ANTHROPIC_API_KEY"):
        logger.error("ANTHROPIC_API_KEY no definida en .env")
        raise RuntimeError("ANTHROPIC_API_KEY es obligatoria")

    if not os.getenv("CLERK_JWKS_URL"):
        logger.warning("CLERK_JWKS_URL no definida — modo dev sin autenticación")
    else:
        logger.info("Auth: Clerk JWT activo")

    logger.info("API key de Anthropic detectada")
    yield
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_anthropic_client() -> anthropic.Anthropic:
    return _make_anthropic_client(os.getenv("ANTHROPIC_API_KEY"))


def _serializar_lead(lead: dict) -> dict:
    """Normaliza un lead para enviarlo al dashboard."""
    lead = dict(lead)
    lead.setdefault("status", "PENDIENTE")
    acciones = lead.get("recommended_actions")
    if isinstance(acciones, str):
        try:
            lead["recommended_actions"] = json.loads(acciones)
        except Exception:
            lead["recommended_actions"] = [acciones]
    return lead


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.post("/qualify-lead", response_model=LeadOutput, status_code=200)
async def qualify_lead_endpoint(
    lead: LeadInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """Procesa un lead entrante con el agente de IA."""
    logger.info("POST /qualify-lead — %s <%s> (tenant: %s)", lead.name, lead.email, tenant_id)

    # Garantizar que el tenant existe en la BD
    ensure_tenant(tenant_id)

    try:
        client = get_anthropic_client()
        result = qualify_lead(
            name=lead.name,
            email=lead.email,
            phone=lead.phone,
            message=lead.message,
            anthropic_client=client,
            tenant_id=tenant_id,
        )

        email_sent = send_lead_response_email(
            lead_email=lead.email,
            lead_name=lead.name,
            generated_email_body=result["generated_email"],
        )
        if email_sent:
            logger.info("Email enviado a %s", lead.email)

        return LeadOutput(**result)

    except anthropic.AuthenticationError:
        raise HTTPException(status_code=500, detail="API key de Anthropic inválida")
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Rate limit alcanzado. Intenta en unos segundos.")
    except Exception as e:
        logger.exception("Error al procesar lead: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@app.get("/leads")
async def list_leads(
    limit: int = 100,
    tenant_id: str = Depends(get_tenant_id),
):
    """Lista los leads del tenant, ordenados por fecha descendente."""
    ensure_tenant(tenant_id)
    if limit > 500:
        limit = 500
    leads = get_recent_leads(limit, tenant_id=tenant_id)
    return {"leads": [_serializar_lead(l) for l in leads], "total": len(leads)}


@app.get("/leads/{lead_id}")
async def get_lead(
    lead_id: str,
    tenant_id: str = Depends(get_tenant_id),
):
    """Recupera un lead completo por ID (solo si pertenece al tenant)."""
    lead = get_lead_by_id(lead_id, tenant_id=tenant_id)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")
    return _serializar_lead(lead)


@app.patch("/leads/{lead_id}/status")
async def patch_lead_status(
    lead_id: str,
    body: ActualizarEstadoInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """Actualiza el estado de un lead del tenant."""
    lead = get_lead_by_id(lead_id, tenant_id=tenant_id)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")

    update_lead_status(lead_id, body.status, tenant_id=tenant_id)
    logger.info("Lead %s → estado %s (tenant: %s)", lead_id, body.status, tenant_id)

    actualizado = get_lead_by_id(lead_id, tenant_id=tenant_id)
    return _serializar_lead(actualizado)


@app.delete("/leads/{lead_id}", status_code=204)
async def delete_lead_endpoint(
    lead_id: str,
    tenant_id: str = Depends(get_tenant_id),
):
    """Elimina un lead del tenant."""
    lead = get_lead_by_id(lead_id, tenant_id=tenant_id)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")

    delete_lead(lead_id, tenant_id=tenant_id)
    logger.info("Lead %s eliminado (tenant: %s)", lead_id, tenant_id)


@app.get("/leads/by-email/{email}")
async def leads_by_email(
    email: str,
    tenant_id: str = Depends(get_tenant_id),
):
    """Historial de leads de un email concreto para el tenant."""
    leads = get_leads_by_email(email, tenant_id=tenant_id)
    return {"email": email, "total": len(leads), "leads": [_serializar_lead(l) for l in leads]}


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "lead-qualifier", "version": "2.0.0"}


# ─────────────────────────────────────────────
# Manejador global de errores
# ─────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Error en %s: %s", request.url, str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor", "error": str(exc)},
    )
