"""
Jobs en segundo plano ejecutados por el scheduler (APScheduler):

  - sync IMAP: descarga emails no leídos de cada tenant y los cualifica.
  - resumen semanal: envía a cada agencia un digest de su actividad.
  - leads sin contactar: avisa de leads buenos que llevan días en 'Pendiente'.

Las versiones `_sync` son síncronas (I/O bloqueante) y se ejecutan en un
thread pool desde sus envoltorios async para no bloquear el event loop.
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

import runtime
from core.agent import qualify_lead
from core.database import (
    get_all_tenants, get_digest_counts, get_leads_for_followup,
    get_stale_pending_leads, get_tenant, get_tenants_with_imap,
    mark_followup_sent, update_imap_last_sync,
)
from models import LeadInput
from notifications import notificar_tenant
from security import descifrar
from services.email_imap import obtener_no_leidos
from services.email_sender import (
    build_followup_email, send_email, send_stale_leads_alert, send_weekly_digest,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Resumen semanal + leads sin contactar
# ─────────────────────────────────────────────

def _resumenes_semanales_sync() -> None:
    """Envía a cada agencia activa un resumen de su actividad de la semana."""
    desde = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    dashboard_url = os.getenv("DASHBOARD_URL", "")
    enviados = 0
    for t in get_all_tenants():
        if t.get("status") != "active":
            continue
        email = t.get("notify_email") or t.get("email")
        if not email:
            continue
        counts = get_digest_counts(t["id"], desde)
        # Solo enviamos si hay algo que contar (evita spamear cuentas inactivas)
        if counts["nuevos"] == 0 and counts["pendientes"] == 0:
            continue
        try:
            send_weekly_digest(email, t.get("name", ""), counts, dashboard_url)
            enviados += 1
        except Exception as exc:
            logger.warning("Resumen semanal falló (tenant %s): %s", t["id"], exc)
    logger.info("Resúmenes semanales enviados: %d", enviados)


def _leads_sin_contactar_sync() -> None:
    """Avisa a cada agencia de los leads buenos que llevan días en 'Pendiente'."""
    dashboard_url = os.getenv("DASHBOARD_URL", "")
    avisos = 0
    for t in get_all_tenants():
        if t.get("status") != "active":
            continue
        email = t.get("notify_email") or t.get("email")
        if not email:
            continue
        stale = get_stale_pending_leads(t["id"], dias=2, min_score=5)
        if not stale:
            continue
        try:
            send_stale_leads_alert(email, t.get("name", ""), stale, dashboard_url)
            avisos += 1
        except Exception as exc:
            logger.warning("Aviso de leads sin contactar falló (tenant %s): %s", t["id"], exc)
    logger.info("Avisos de leads sin contactar enviados: %d", avisos)


async def enviar_resumenes_semanales() -> None:
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _resumenes_semanales_sync)


async def avisar_leads_sin_contactar() -> None:
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _leads_sin_contactar_sync)


# ─────────────────────────────────────────────
# Seguimiento automático al lead (opt-in por tenant)
# ─────────────────────────────────────────────

def _seguimientos_sync() -> None:
    """
    Envía UN recordatorio amable al lead que sigue PENDIENTE días después de su
    consulta (score >= 5, respuesta inicial enviada, sin seguimiento previo).
    Solo para tenants que lo han activado explícitamente (followup_enabled).
    """
    enviados = 0
    for t in get_all_tenants():
        if t.get("status") != "active" or not t.get("followup_enabled"):
            continue
        for lead in get_leads_for_followup(t["id"]):
            asunto, cuerpo = build_followup_email(lead["name"], t.get("name") or "")
            try:
                ok = send_email(
                    to_email=lead["email"],
                    to_name=lead["name"],
                    subject=asunto,
                    body=cuerpo,
                    reply_to=t.get("notify_email") or t.get("email"),
                    from_name=t.get("name"),
                )
            except Exception as exc:
                logger.warning("Seguimiento falló (lead %s, tenant %s): %s", lead["id"], t["id"], exc)
                continue
            # Solo se marca si el envío fue OK: si falla, se reintenta al día siguiente.
            if ok:
                mark_followup_sent(lead["id"], t["id"])
                enviados += 1
    logger.info("Seguimientos automáticos enviados: %d", enviados)


async def enviar_seguimientos() -> None:
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _seguimientos_sync)


# ─────────────────────────────────────────────
# Sync IMAP (bandeja de entrada → leads)
# ─────────────────────────────────────────────

async def sync_imap_todos() -> None:
    """Job del scheduler: procesa la bandeja IMAP de cada tenant activo."""
    tenants = get_tenants_with_imap()
    if not tenants:
        return
    logger.info("IMAP sync — %d tenant(s)", len(tenants))
    for t in tenants:
        try:
            await _sync_imap_tenant(t)
        except Exception as exc:
            logger.error("IMAP sync error (tenant %s): %s", t["id"], exc)


async def _sync_imap_tenant(t: dict) -> None:
    """Descarga emails no leídos del tenant y los cualifica como leads."""
    password = descifrar(t["password_enc"])
    loop = asyncio.get_event_loop()

    # La I/O IMAP es bloqueante → correr en thread pool
    emails = await loop.run_in_executor(
        None, obtener_no_leidos, t["host"], t["port"], t["user"], password
    )

    if emails:
        logger.info("IMAP tenant %s — %d email(s) nuevos", t["id"], len(emails))

    client = runtime.anthropic_client
    tenant_full = get_tenant(t["id"]) or {}
    for datos in emails:
        try:
            lead_input = LeadInput(**datos)
            # auto_send=False: la respuesta a un email de la bandeja NO se envía
            # automáticamente (saldría desde otro remitente); queda como borrador
            # listo para revisar y enviar desde el dashboard con un clic.
            result = qualify_lead(
                name=lead_input.name,
                email=lead_input.email,
                phone=None,
                message=lead_input.message,
                anthropic_client=client,
                tenant_id=t["id"],
                agency_name=t.get("name"),
                brand_voice=tenant_full.get("brand_voice") or None,
                auto_send=False,
            )
            notificar_tenant(t["id"], lead_input, result)
            logger.info(
                "Lead IMAP cualificado: %s — score %s (%s)",
                datos["email"], result.get("score"), result.get("classification"),
            )
        except Exception as exc:
            logger.error("Error cualificando email de %s: %s", datos.get("email"), exc)

    update_imap_last_sync(t["id"])
