"""
Aviso por email a la agencia cuando entra un lead que merece la pena.

Solo se notifica a partir de NOTIFY_MIN_SCORE: los leads FRÍO quedan en el
dashboard pero no generan correo, para no saturar a la agencia.
"""

import logging
import os

from config import NOTIFY_MIN_SCORE
from core.database import get_tenant
from models import LeadInput
from services.email_sender import send_tenant_notification

logger = logging.getLogger(__name__)


def notificar_tenant(tenant_id: str, lead: LeadInput, result: dict) -> None:
    """Avisa por email a la agencia solo si el lead es bueno (score >= NOTIFY_MIN_SCORE)."""
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
        notify_email = tenant.get("notify_email") or tenant.get("email", "")
        if not notify_email:
            return
        dashboard_url = os.getenv("DASHBOARD_URL", "")
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
    except Exception as e:
        logger.warning("No se pudo enviar notificación al tenant %s: %s", tenant_id, str(e))
