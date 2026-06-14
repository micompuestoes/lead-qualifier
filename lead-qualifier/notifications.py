"""
Aviso por email a la agencia cuando entra un lead que merece la pena.

Solo se notifica a partir de NOTIFY_MIN_SCORE: los leads FRÍO quedan en el
dashboard pero no generan correo, para no saturar a la agencia.
"""

import logging
import os

from config import NOTIFY_MIN_SCORE, WHATSAPP_MIN_SCORE
from core.database import get_tenant
from models import LeadInput
from services.email_sender import send_tenant_notification
from services.whatsapp import send_hot_lead_alert

logger = logging.getLogger(__name__)


def notificar_tenant(tenant_id: str, lead: LeadInput, result: dict) -> None:
    """Avisa a la agencia de un buen lead: por email (score >= NOTIFY_MIN_SCORE)
    y, si lo tiene activado, por WhatsApp para los CALIENTE (score >= WHATSAPP_MIN_SCORE)."""
    try:
        score = result.get("score") or 0
        if score < NOTIFY_MIN_SCORE:
            logger.info(
                "Lead %s con score %s < %s — no se envía aviso al tenant",
                lead.email, score, NOTIFY_MIN_SCORE,
            )
            return

        tenant = get_tenant(tenant_id)
        if not tenant:
            return
        dashboard_url = os.getenv("DASHBOARD_URL", "")

        notify_email = tenant.get("notify_email") or tenant.get("email", "")
        if notify_email:
            send_tenant_notification(
                tenant_email=notify_email,
                tenant_name=tenant.get("name", ""),
                lead_name=lead.name,
                lead_email=lead.email,
                lead_phone=lead.phone,
                lead_message=lead.message,
                score=result.get("score", 0),
                classification=result.get("classification", ""),
                dashboard_url=dashboard_url,
            )

        # WhatsApp: solo leads CALIENTE y solo si el agente lo ha activado.
        _avisar_whatsapp(tenant, lead, result, score, dashboard_url)

    except Exception as e:
        logger.warning("No se pudo enviar notificación al tenant %s: %s", tenant_id, str(e))


def _avisar_whatsapp(tenant: dict, lead: LeadInput, result: dict, score: int, dashboard_url: str) -> None:
    """Envía el aviso de WhatsApp si el tenant lo tiene activado y el lead es caliente."""
    if score < WHATSAPP_MIN_SCORE:
        return
    if not tenant.get("whatsapp_enabled") or not tenant.get("whatsapp_number"):
        return
    try:
        send_hot_lead_alert(
            to_phone=tenant["whatsapp_number"],
            lead_name=lead.name,
            lead_phone=lead.phone,
            score=score,
            classification=result.get("classification", ""),
            dashboard_url=dashboard_url,
        )
    except Exception as exc:
        logger.warning("Fallo al avisar por WhatsApp (tenant %s): %s", tenant.get("id"), exc)
