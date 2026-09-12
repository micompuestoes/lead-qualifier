"""
Webhook saliente por tenant: reenvía cada lead cualificado a su CRM (Zapier,
Make, HubSpot, Pipedrive... cualquier endpoint que acepte un POST JSON).
"""

import logging
from urllib.parse import urlparse

import httpx

from services.email_imap import _validar_host_seguro

logger = logging.getLogger(__name__)


def send_lead_webhook(webhook_url: str, payload: dict) -> None:
    """
    POST del lead cualificado a la URL configurada por el tenant en su perfil.

    Siempre se llama como background task, después de guardar el lead y de
    responder al visitante/cliente: un CRM caído o lento nunca debe afectar
    la respuesta al lead ni retrasar el envío de su email.

    La URL la elige el propio tenant (igual que el host IMAP), así que se
    valida con el mismo guard anti-SSRF antes de hacer la petición: sin esto,
    cualquier cuenta podría apuntar a IPs internas de la infraestructura.
    """
    parsed = urlparse(webhook_url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        logger.warning("Webhook CRM: URL inválida, se omite el envío (url=%s)", webhook_url)
        return
    try:
        _validar_host_seguro(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except Exception as exc:
        logger.warning("Webhook CRM: host no permitido, se omite el envío (url=%s): %s", webhook_url, exc)
        return

    try:
        resp = httpx.post(webhook_url, json=payload, timeout=10.0, follow_redirects=False)
        if resp.status_code >= 400:
            logger.warning("Webhook CRM respondió %s (url=%s)", resp.status_code, webhook_url)
    except Exception as exc:
        logger.warning("Webhook CRM falló (url=%s): %s", webhook_url, exc)
