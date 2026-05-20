"""
FastAPI app principal.
Expone el endpoint POST /qualify-lead y endpoints de gestión de leads para el dashboard.
"""

import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from database import init_db, get_lead_by_id, get_recent_leads, get_leads_by_email
from database import update_lead_status, delete_lead
from email_sender import send_lead_response_email
from models import LeadInput, LeadOutput
from agent import qualify_lead, _make_anthropic_client

# ─────────────────────────────────────────────
# Configuración de logging
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Cargar .env usando ruta absoluta para evitar problemas en Windows
load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)


# ─────────────────────────────────────────────
# Modelo para actualizar estado
# ─────────────────────────────────────────────
EstadoLiteral = Literal["PENDIENTE", "CONTACTADO", "CERRADO", "DESCARTADO"]

class ActualizarEstadoInput(BaseModel):
    status: EstadoLiteral


# ─────────────────────────────────────────────
# Lifecycle: inicializar BD al arrancar
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Arrancando Lead Qualifier API")
    init_db()

    if not os.getenv("ANTHROPIC_API_KEY"):
        logger.error("ANTHROPIC_API_KEY no definida en .env")
        raise RuntimeError("ANTHROPIC_API_KEY es obligatoria")

    logger.info("API key de Anthropic detectada")
    yield
    logger.info("Cerrando Lead Qualifier API")


# ─────────────────────────────────────────────
# Instancia de FastAPI
# ─────────────────────────────────────────────
app = FastAPI(
    title="Lead Qualifier API",
    description="Agente de IA para cualificación automática de leads con Claude",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — permite todos los orígenes en producción para evitar problemas con dominios de Vercel/Railway
# En una versión posterior se puede restringir a dominios específicos
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_anthropic_client() -> anthropic.Anthropic:
    """Crea el cliente de Anthropic con SSL correcto para Windows."""
    return _make_anthropic_client(os.getenv("ANTHROPIC_API_KEY"))


def _serializar_lead(lead: dict) -> dict:
    """
    Normaliza un lead de la BD para enviarlo al dashboard:
    - Añade status por defecto si falta
    - Parsea recommended_actions si es string JSON
    """
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
async def qualify_lead_endpoint(lead: LeadInput):
    """Procesa un lead entrante con el agente de IA."""
    logger.info("POST /qualify-lead — %s <%s>", lead.name, lead.email)

    try:
        client = get_anthropic_client()
        result = qualify_lead(
            name=lead.name,
            email=lead.email,
            phone=lead.phone,
            message=lead.message,
            anthropic_client=client,
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
async def list_leads(limit: int = 100):
    """Lista todos los leads, ordenados por fecha descendente."""
    if limit > 500:
        limit = 500
    leads = get_recent_leads(limit)
    return {"leads": [_serializar_lead(l) for l in leads], "total": len(leads)}


@app.get("/leads/{lead_id}")
async def get_lead(lead_id: str):
    """Recupera un lead completo por su ID."""
    lead = get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")
    return _serializar_lead(lead)


@app.patch("/leads/{lead_id}/status")
async def patch_lead_status(lead_id: str, body: ActualizarEstadoInput):
    """Actualiza el estado de un lead: PENDIENTE → CONTACTADO → CERRADO / DESCARTADO."""
    lead = get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")

    update_lead_status(lead_id, body.status)
    logger.info("Lead %s → estado %s", lead_id, body.status)

    actualizado = get_lead_by_id(lead_id)
    return _serializar_lead(actualizado)


@app.delete("/leads/{lead_id}", status_code=204)
async def delete_lead_endpoint(lead_id: str):
    """Elimina un lead de la base de datos."""
    lead = get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")

    delete_lead(lead_id)
    logger.info("Lead %s eliminado", lead_id)
    # 204 No Content — no devuelve body


@app.get("/leads/by-email/{email}")
async def leads_by_email(email: str):
    """Historial de leads de un email concreto."""
    leads = get_leads_by_email(email)
    return {"email": email, "total": len(leads), "leads": [_serializar_lead(l) for l in leads]}


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "lead-qualifier"}


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
