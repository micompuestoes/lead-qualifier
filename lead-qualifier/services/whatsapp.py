"""
Envío de notificaciones por WhatsApp vía la Cloud API oficial de Meta.

Patrón idéntico al de email_sender: solo se activa si está configurado
(WHATSAPP_TOKEN + WHATSAPP_PHONE_ID); si no, es un no-op que loguea.

WhatsApp NO permite escribir libremente a alguien que no te ha escrito en las
últimas 24 h: para iniciar conversación hay que usar una PLANTILLA aprobada por
Meta. Por eso el aviso al agente se envía como `template`, cuyo nombre e idioma
son configurables. La plantilla que hay que crear en Meta se documenta en el
README y en .env.example.

Variables de entorno:
  WHATSAPP_TOKEN            → token de acceso de la app de WhatsApp Business
  WHATSAPP_PHONE_ID         → Phone Number ID del remitente
  WHATSAPP_TEMPLATE_HOT_LEAD→ nombre de la plantilla (def: hot_lead_alert)
  WHATSAPP_TEMPLATE_LANG    → idioma de la plantilla (def: es)
  WHATSAPP_API_VERSION      → versión del Graph API (def: v21.0)

httpx se importa de forma perezosa (dentro de las funciones) para que el módulo
pueda importarse sin dependencias pesadas (p. ej. en los tests del scoring).
"""

import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)


def whatsapp_configured() -> bool:
    """True si hay credenciales suficientes para enviar por WhatsApp."""
    return bool(os.getenv("WHATSAPP_TOKEN") and os.getenv("WHATSAPP_PHONE_ID"))


def normalize_phone(raw: Optional[str], default_country: str = "34") -> Optional[str]:
    """
    Normaliza un teléfono al formato que espera Meta: solo dígitos con prefijo
    de país y SIN el '+'. Ej.: '+34 600 11 22 33' → '34600112233'.

    - Acepta prefijo internacional con '+' o '00'.
    - Un número español de 9 dígitos sin prefijo se asume del país por defecto.
    Devuelve None si no parece un teléfono válido.
    """
    if not raw:
        return None

    s = raw.strip()
    tiene_prefijo = s.startswith("+") or s.startswith("00")

    # Quitar todo lo que no sea dígito
    digits = re.sub(r"\D", "", s)
    if s.startswith("00"):
        digits = digits[2:]  # '00' es el prefijo internacional → descartarlo

    if not digits:
        return None

    # Número nacional de 9 dígitos (España) sin prefijo → anteponer país
    if not tiene_prefijo and len(digits) == 9:
        digits = default_country + digits

    # Validación laxa: longitud razonable de un número internacional
    if not (8 <= len(digits) <= 15):
        return None

    return digits


def _send_template(to: str, template: str, lang: str, body_params: list[str]) -> bool:
    """
    Envía un mensaje de plantilla por la Cloud API. Devuelve True si Meta lo aceptó.
    Errores y fallos de red se loguean y devuelven False (nunca lanzan).
    """
    token = os.getenv("WHATSAPP_TOKEN", "")
    phone_id = os.getenv("WHATSAPP_PHONE_ID", "")
    api_version = os.getenv("WHATSAPP_API_VERSION", "v21.0")

    url = f"https://graph.facebook.com/{api_version}/{phone_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template,
            "language": {"code": lang},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": p} for p in body_params],
                }
            ],
        },
    }

    try:
        import httpx  # import perezoso: el módulo se puede cargar sin httpx
        resp = httpx.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if resp.status_code >= 400:
            logger.warning("WhatsApp API %s: %s", resp.status_code, resp.text[:300])
            return False
        return True
    except Exception as exc:
        logger.warning("No se pudo enviar WhatsApp a %s: %s", to, exc)
        return False


def send_hot_lead_alert(
    to_phone: str,
    lead_name: str,
    lead_phone: Optional[str],
    score: int,
    classification: str,
    dashboard_url: str = "",
) -> bool:
    """
    Avisa al agente por WhatsApp de un lead caliente.

    Requiere una plantilla aprobada en Meta (por defecto `hot_lead_alert`) con
    4 parámetros en el cuerpo, en este orden:
      {{1}} clasificación + score   p. ej. "CALIENTE (9/10)"
      {{2}} nombre del lead
      {{3}} teléfono del lead
      {{4}} enlace al panel
    """
    if not whatsapp_configured():
        logger.info("WhatsApp no configurado — se omite el aviso del lead %s", lead_name)
        return False

    to = normalize_phone(to_phone)
    if not to:
        logger.warning("Número de WhatsApp del agente no válido: %r", to_phone)
        return False

    template = os.getenv("WHATSAPP_TEMPLATE_HOT_LEAD", "hot_lead_alert")
    lang = os.getenv("WHATSAPP_TEMPLATE_LANG", "es")

    params = [
        f"{classification} ({score}/10)",
        lead_name or "Sin nombre",
        lead_phone or "no facilitado",
        dashboard_url or "tu panel de Inmonia",
    ]
    enviado = _send_template(to, template, lang, params)
    if enviado:
        logger.info("Aviso de lead caliente enviado por WhatsApp a %s", to)
    return enviado
