"""
Demo pública de cualificación — sin registro, sin autenticación, sin persistencia.

Un visitante de la landing pega un mensaje de ejemplo y ve al instante la
puntuación, clasificación y email que generaría Inmuebia — antes de crear
ninguna cuenta. Es la misma lógica de extracción+puntuación que usa el
producto real (core/agent.py + core/tools.py), pero:
  - NO guarda nada en la base de datos (no es un lead real de ningún tenant).
  - NO envía ningún email.
  - NO reparte a ningún agente.

Al no haber tenant ni api_key que limiten el coste, el filtro de abuso es más
estricto que en el resto de endpoints públicos: límite por IP + un techo
GLOBAL diario (bucket compartido por todos los visitantes) — ver config.py.
"""

import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from config import (
    RATE_DEMO_GLOBAL_PER_DAY, RATE_DEMO_GLOBAL_PER_HOUR, RATE_DEMO_GLOBAL_PER_MIN,
    RATE_DEMO_IP_PER_HOUR, RATE_DEMO_IP_PER_MIN,
)
from core.agent import _email_fallback, _extraer_y_redactar
from core.tools import analyze_intent, lookup_company, score_lead
from deps import get_anthropic_client
from security import client_ip, rate_limited

logger = logging.getLogger(__name__)

router = APIRouter(tags=["demo"])


class DemoInput(BaseModel):
    message: str = Field(..., min_length=10, max_length=600)
    name: str = Field("", max_length=80)
    # Campo trampa invisible para humanos (CSS en el frontend) — si llega
    # relleno, es un bot rellenando todos los campos del formulario.
    website: str = Field("", max_length=200)


@router.post("/demo/qualify")
def demo_qualify(data: DemoInput, request: Request):
    """Cualifica un mensaje de ejemplo sin guardar nada ni requerir cuenta."""
    if data.website:
        logger.warning("Demo rechazada por honeypot")
        raise HTTPException(status_code=400, detail="Solicitud inválida")

    ip = client_ip(request)
    if rate_limited(f"demoip:{ip}", RATE_DEMO_IP_PER_MIN, RATE_DEMO_IP_PER_HOUR):
        raise HTTPException(
            status_code=429,
            detail="Has probado la demo demasiadas veces seguidas. Inténtalo en unos minutos.",
        )
    if rate_limited(
        "demo:global", RATE_DEMO_GLOBAL_PER_MIN, RATE_DEMO_GLOBAL_PER_HOUR,
        per_day=RATE_DEMO_GLOBAL_PER_DAY,
    ):
        logger.warning("Demo pública saturada (límite global) — ip %s", ip)
        raise HTTPException(
            status_code=429,
            detail="La demo está muy solicitada ahora mismo. Vuelve a intentarlo más tarde.",
        )

    message = data.message.strip()
    name = data.name.strip() or "un cliente"
    primer_nombre = name.split()[0] if name.split() else "cliente"
    firma = "Tu agencia"
    email_ficticio = "demo@ejemplo.com"

    client = get_anthropic_client()
    resultado_ia = _extraer_y_redactar(client, name, primer_nombre, firma, email_ficticio, message)

    if resultado_ia is not None:
        intent = resultado_ia["intent"]
        generated_email = resultado_ia["email_text"]
    else:
        intent = analyze_intent(message, name)
        generated_email = None

    company = lookup_company(email_ficticio)
    scoring = score_lead(intent, company)

    if generated_email is None:
        generated_email = _email_fallback(
            primer_nombre, firma, scoring["classification"], intent.get("operation", "INFORMACION"),
        )

    logger.info("Demo pública cualificada — %s/10 %s (ip: %s)", scoring["score"], scoring["classification"], ip)

    return {
        "classification": scoring["classification"],
        "score": scoring["score"],
        "reasoning": scoring["reasoning"],
        "generated_email": generated_email,
    }
