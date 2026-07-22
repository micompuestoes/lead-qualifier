"""
Endpoint público de captación de leads (sin autenticación JWT).

Usa la api_key del tenant como identificador. La inmobiliaria pone en su web:
    POST https://tu-api.render.com/intake/lq_xxxxxxxxxxxx

Protegido con honeypot anti-bots y rate limiting por IP y por api_key:
cada lead procesado consume créditos de IA, así que se filtra el abuso antes.
"""

import logging
import uuid
from typing import Optional

import anthropic
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from config import (
    FREE_LEAD_LIMIT, RATE_IP_PER_HOUR, RATE_IP_PER_MIN,
    RATE_KEY_PER_HOUR, RATE_KEY_PER_MIN,
)
from core.agent import qualify_lead
from core.database import get_lead_count_this_month, get_tenant_by_api_key, save_lead
from deps import get_anthropic_client
from models import LeadInput
from notifications import notificar_tenant
from security import client_ip, rate_limited
from services.email_sender import send_and_mark_lead_email

logger = logging.getLogger(__name__)

router = APIRouter(tags=["intake"])


class PublicLeadInput(LeadInput):
    """Lead entrante desde el formulario público. Incluye honeypot anti-bots."""
    # Campo trampa: invisible para humanos. Si llega relleno, es un bot.
    website: Optional[str] = None


@router.post("/intake/{api_key}", status_code=200)
def public_intake(api_key: str, lead: PublicLeadInput, request: Request, background_tasks: BackgroundTasks):
    """
    Recibe un lead desde un formulario externo identificado por api_key.

    Endpoint síncrono (def) a propósito: la llamada a Claude y el SMTP son
    bloqueantes, y en un `async def` congelarían el event loop entero mientras
    duran. Como `def`, FastAPI lo ejecuta en el threadpool y la API sigue
    atendiendo al resto de peticiones.
    """
    # ── Honeypot: si el campo trampa viene relleno, es un bot ──
    if lead.website:
        logger.warning("Intake rechazado por honeypot (api_key %s)", api_key[:8])
        # Devolvemos OK falso para no dar pistas al bot
        return {"ok": True, "message": "Tu consulta ha sido recibida."}

    # ── Rate limiting (no consumir IA en ataques) ──
    ip = client_ip(request)
    if rate_limited(f"ip:{ip}", RATE_IP_PER_MIN, RATE_IP_PER_HOUR):
        logger.warning("Intake rate-limited por IP %s", ip)
        raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Espera unos minutos.")
    if rate_limited(f"key:{api_key}", RATE_KEY_PER_MIN, RATE_KEY_PER_HOUR):
        logger.warning("Intake rate-limited por api_key %s", api_key[:8])
        raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Inténtalo más tarde.")

    tenant = get_tenant_by_api_key(api_key)
    if not tenant:
        raise HTTPException(status_code=404, detail="API key no válida")

    if tenant.get("status") == "cancelled":
        raise HTTPException(status_code=403, detail="Cuenta desactivada")

    tenant_id = tenant["id"]
    logger.info("Intake público — %s <%s> (tenant: %s, ip: %s)", lead.name, lead.email, tenant_id, ip)

    # ── Límite del plan gratuito ──
    # Si el tenant está en free y ha superado su cuota mensual, NO perdemos el lead:
    # lo guardamos sin cualificar (sin gastar IA) para que mejore su plan y lo desbloquee.
    if tenant.get("plan", "free") == "free" and get_lead_count_this_month(tenant_id) >= FREE_LEAD_LIMIT:
        save_lead(
            lead_id=str(uuid.uuid4()), tenant_id=tenant_id,
            name=lead.name, email=lead.email, phone=lead.phone, message=lead.message,
            classification=None, score=None,
            reasoning="Sin cualificar: has alcanzado el límite de leads del plan gratuito este mes. Mejora tu plan para desbloquear la cualificación con IA.",
            generated_email=None, recommended_actions=[], intent_analysis={}, company_info={},
            email_sent=0,
        )
        logger.info("Intake free sobre límite — lead capturado sin IA (tenant %s)", tenant_id)
        return {
            "ok": True,
            "message": "Tu consulta ha sido recibida. En breve nos pondremos en contacto contigo.",
        }

    # Ajustes de respuesta del tenant: envío automático (o borrador) y voz de marca
    av = tenant.get("auto_send_email")
    auto_send = True if av is None else bool(av)

    try:
        client = get_anthropic_client()
        result = qualify_lead(
            name=lead.name,
            email=lead.email,
            phone=lead.phone,
            message=lead.message,
            anthropic_client=client,
            tenant_id=tenant_id,
            agency_name=tenant.get("name"),
            brand_voice=tenant.get("brand_voice") or None,
            auto_send=auto_send,
        )

        # Envío y avisos en segundo plano: el visitante no espera al SMTP.
        # El lead se guarda como borrador y solo se marca enviado si el SMTP confirma.
        if auto_send:
            background_tasks.add_task(
                send_and_mark_lead_email,
                lead_id=result["lead_id"],
                tenant_id=tenant_id,
                lead_email=lead.email,
                lead_name=lead.name,
                generated_email_body=result["generated_email"],
                reply_to=tenant.get("notify_email") or tenant.get("email"),
                from_name=tenant.get("name"),
            )
        background_tasks.add_task(notificar_tenant, tenant_id, lead, result)

        # OJO: no devolver score/clasificación — es un endpoint público y la
        # cualificación es información interna de la agencia.
        return {
            "ok": True,
            "message": "Tu consulta ha sido recibida. En breve nos pondremos en contacto contigo.",
        }

    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Servicio temporalmente saturado. Inténtalo en unos segundos.")
    except Exception as e:
        logger.exception("Error en intake público: %s", str(e))
        raise HTTPException(status_code=500, detail="Error interno")
