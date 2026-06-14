"""
Aviso de un buen lead a quien debe atenderlo.

Si el lead está asignado a un agente del equipo, se avisa DIRECTAMENTE a ese
agente (a su email y/o WhatsApp); si no, al contacto general de la cuenta.
Solo a partir de NOTIFY_MIN_SCORE: los leads FRÍO quedan en el dashboard pero
no generan aviso, para no saturar.
"""

import logging
import os

from config import NOTIFY_MIN_SCORE, WHATSAPP_MIN_SCORE
from core.database import get_agent_contact, get_tenant
from models import LeadInput
from services.email_sender import send_tenant_notification
from services.whatsapp import send_hot_lead_alert

logger = logging.getLogger(__name__)


def notificar_tenant(tenant_id: str, lead: LeadInput, result: dict) -> None:
    """
    Avisa del lead al agente asignado (o al contacto general si no hay agente):
    por email desde NOTIFY_MIN_SCORE y por WhatsApp para los CALIENTE.
    """
    try:
        score = result.get("score") or 0
        if score < NOTIFY_MIN_SCORE:
            logger.info(
                "Lead %s con score %s < %s — no se envía aviso",
                lead.email, score, NOTIFY_MIN_SCORE,
            )
            return

        tenant = get_tenant(tenant_id)
        if not tenant:
            return

        # ¿A quién avisamos? Al agente asignado, con respaldo en el dueño.
        contacto = get_agent_contact(tenant_id, result.get("assigned_to"))
        dashboard_url = os.getenv("DASHBOARD_URL", "")

        if contacto["email"]:
            send_tenant_notification(
                tenant_email=contacto["email"],
                tenant_name=contacto["name"] or tenant.get("name", ""),
                lead_name=lead.name,
                lead_email=lead.email,
                lead_phone=lead.phone,
                lead_message=lead.message,
                score=result.get("score", 0),
                classification=result.get("classification", ""),
                dashboard_url=dashboard_url,
            )

        _avisar_whatsapp(contacto, lead, result, score, dashboard_url)

    except Exception as e:
        logger.warning("No se pudo enviar notificación al tenant %s: %s", tenant_id, str(e))


def _avisar_whatsapp(contacto: dict, lead: LeadInput, result: dict, score: int, dashboard_url: str) -> None:
    """Avisa por WhatsApp al contacto si el lead es CALIENTE y hay número."""
    if score < WHATSAPP_MIN_SCORE:
        return
    numero = contacto.get("whatsapp")
    if not numero:
        return
    try:
        send_hot_lead_alert(
            to_phone=numero,
            lead_name=lead.name,
            lead_phone=lead.phone,
            score=score,
            classification=result.get("classification", ""),
            dashboard_url=dashboard_url,
        )
    except Exception as exc:
        logger.warning("Fallo al avisar por WhatsApp a %s: %s", numero, exc)
