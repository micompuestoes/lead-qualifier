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
from typing import Optional

import runtime
from core.agent import qualify_lead
from core.database import (
    acquire_job_lock, add_notification, get_all_tenants, get_closed_deals_value,
    get_digest_counts, get_leads_for_followup, get_notifications,
    get_pending_reminders, get_stale_pending_leads, get_tenant,
    get_tenants_with_imap, hoy_espana, mark_followup_sent, update_imap_last_sync,
)
from models import LeadInput
from pydantic import ValidationError
from notifications import notificar_tenant
from security import descifrar
from services.email_imap import obtener_no_leidos
from services.email_sender import (
    build_followup_email, send_email, send_reminders_due, send_stale_leads_alert,
    send_weekly_digest,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Periodos para el lock de jobs (ver acquire_job_lock):
# con varias instancias, solo una ejecuta cada (job, periodo).
# ─────────────────────────────────────────────

def _periodo_diario() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _periodo_semanal() -> str:
    return datetime.now(timezone.utc).strftime("%G-W%V")  # semana ISO, ej. 2026-W30


def _periodo_10min() -> str:
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:") + f"{now.minute // 10}0"


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
        counts["deal_value_total"] = get_closed_deals_value(t["id"])["total_value"]
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


def _recordatorios_hoy_sync() -> None:
    """Avisa a cada agencia de los recordatorios de seguimiento que vencen hoy o antes."""
    dashboard_url = os.getenv("DASHBOARD_URL", "")
    hoy = hoy_espana()
    avisos = 0
    for t in get_all_tenants():
        if t.get("status") != "active":
            continue
        email = t.get("notify_email") or t.get("email")
        if not email:
            continue
        pendientes = get_pending_reminders(t["id"], hasta=hoy)
        if not pendientes:
            continue
        try:
            send_reminders_due(email, t.get("name", ""), pendientes, dashboard_url)
            avisos += 1
        except Exception as exc:
            logger.warning("Aviso de recordatorios falló (tenant %s): %s", t["id"], exc)
    logger.info("Avisos de recordatorios enviados: %d", avisos)


async def avisar_recordatorios_hoy() -> None:
    if not acquire_job_lock("recordatorios_hoy", _periodo_diario()):
        return
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _recordatorios_hoy_sync)


async def enviar_resumenes_semanales() -> None:
    if not acquire_job_lock("resumen_semanal", _periodo_semanal()):
        return
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _resumenes_semanales_sync)


async def avisar_leads_sin_contactar() -> None:
    if not acquire_job_lock("leads_sin_contactar", _periodo_diario()):
        return
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
    if not acquire_job_lock("seguimientos", _periodo_diario()):
        return
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _seguimientos_sync)


# ─────────────────────────────────────────────
# Sync IMAP (bandeja de entrada → leads)
# ─────────────────────────────────────────────

# Umbral sin sincronizar (desde el último éxito) a partir del cual se avisa a
# la agencia: antes, un fallo de IMAP (credenciales caducadas, servidor caído)
# era completamente silencioso — el único síntoma era que "Última
# sincronización" en /perfil dejaba de avanzar, y nadie lo mira activamente.
ALERTA_IMAP_HORAS = 12


def _hace_menos_de(iso_ts: Optional[str], horas: int) -> bool:
    if not iso_ts:
        return False
    try:
        momento = datetime.fromisoformat(iso_ts)
    except ValueError:
        return False
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - momento < timedelta(hours=horas)


def _alertar_imap_caido_si_procede(tenant_id: str) -> None:
    """
    Crea una notificación de sistema si el correo entrante lleva caído más de
    ALERTA_IMAP_HORAS desde el último sync con éxito. Se avisa una sola vez
    por incidencia (no en cada ciclo del job) comprobando si ya hay un aviso
    del mismo tipo en las últimas ALERTA_IMAP_HORAS.
    """
    tenant = get_tenant(tenant_id)
    if not tenant:
        return
    if not _hace_menos_de(tenant.get("imap_last_sync"), ALERTA_IMAP_HORAS):
        recientes = get_notifications(tenant_id, limit=5)
        ya_avisado = any(
            n.get("type") == "imap_sync_error" and _hace_menos_de(n.get("created_at"), ALERTA_IMAP_HORAS)
            for n in recientes
        )
        if not ya_avisado:
            add_notification(
                tenant_id, "imap_sync_error",
                "El correo entrante ha dejado de sincronizarse",
                f"No hemos podido conectar con tu bandeja de email desde hace más de "
                f"{ALERTA_IMAP_HORAS} horas. Revisa la contraseña y la conexión en "
                "Mi perfil → Email entrante.",
            )


async def sync_imap_todos() -> None:
    """Job del scheduler: procesa la bandeja IMAP de cada tenant activo."""
    # Lock por ventana de 10 min: dos instancias leyendo la misma bandeja
    # a la vez crearían leads duplicados del mismo email.
    if not acquire_job_lock("imap_sync", _periodo_10min()):
        return
    tenants = get_tenants_with_imap()
    if not tenants:
        return
    logger.info("IMAP sync — %d tenant(s)", len(tenants))
    for t in tenants:
        try:
            await _sync_imap_tenant(t)
        except Exception as exc:
            logger.error("IMAP sync error (tenant %s): %s", t["id"], exc)
            _alertar_imap_caido_si_procede(t["id"])


async def _sync_imap_tenant(t: dict) -> None:
    """Descarga emails no leídos del tenant y los cualifica como leads."""
    password = descifrar(t["password_enc"])
    loop = asyncio.get_event_loop()
    client = runtime.anthropic_client
    tenant_full = get_tenant(t["id"]) or {}

    def _procesar(datos: dict) -> bool:
        """
        Cualifica un email ya parseado. Devuelve True si el email debe
        marcarse como leído (procesado con éxito, o con datos que nunca
        van a validar y no tiene sentido reintentar). Devuelve False ante
        un fallo transitorio (IA, red, DB...) para que el email quede sin
        leer y se reintente en el siguiente sync — así no se pierde el lead.
        """
        try:
            lead_input = LeadInput(**datos)
        except ValidationError as exc:
            logger.error(
                "Email de %s descartado — datos inválidos para un lead: %s",
                datos.get("email"), exc,
            )
            return True  # no reintentar: nunca va a validar

        try:
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
                source="email",
            )
            notificar_tenant(t["id"], lead_input, result)
            logger.info(
                "Lead IMAP cualificado: %s — score %s (%s)",
                datos["email"], result.get("score"), result.get("classification"),
            )
            return True
        except Exception as exc:
            logger.error("Error cualificando email de %s: %s", datos.get("email"), exc)
            return False

    # La I/O IMAP es bloqueante → correr en thread pool. La cualificación
    # (`_procesar`) corre en ese mismo hilo, por email, antes de decidir si
    # se marca como leído.
    emails = await loop.run_in_executor(
        None, obtener_no_leidos, t["host"], t["port"], t["user"], password, _procesar
    )

    if emails:
        logger.info("IMAP tenant %s — %d email(s) cualificado(s)", t["id"], len(emails))

    update_imap_last_sync(t["id"])
