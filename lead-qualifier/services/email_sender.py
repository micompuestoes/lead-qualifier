"""
Módulo de envío de emails.
Soporta dos backends: SMTP nativo (smtplib) y SendGrid SDK.
Se selecciona automáticamente según las variables de entorno configuradas.

Buenas prácticas de entregabilidad incluidas:
- Cabeceras Date y Message-ID (reducen el riesgo de spam).
- Reply-To configurable (las respuestas del lead llegan a la agencia, no al SaaS).
- Nombre de remitente personalizable por agencia.

IMPORTANTE para que los emails no caigan en spam: el dominio de FROM_EMAIL debe
tener configurados SPF, DKIM y DMARC en su DNS. Esto se configura en el proveedor
(SendGrid/SES/Postmark) y en el DNS del dominio, no en el código.
"""

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
from typing import Optional

logger = logging.getLogger(__name__)


def send_email(
    to_email: str,
    to_name: str,
    subject: str,
    body: str,
    reply_to: Optional[str] = None,
    from_name: Optional[str] = None,
) -> bool:
    """
    Envía un email. Elige automáticamente el backend disponible.
    Devuelve True si se envió correctamente, False si falló.

    reply_to:  dirección a la que responderá el destinatario (p. ej. la agencia).
    from_name: nombre visible del remitente (p. ej. el nombre de la agencia).
    """
    sendgrid_key = os.getenv("SENDGRID_API_KEY")
    if sendgrid_key:
        return _send_via_sendgrid(to_email, to_name, subject, body, sendgrid_key, reply_to, from_name)

    resend_key = os.getenv("RESEND_API_KEY")
    if resend_key:
        return _send_via_resend(to_email, to_name, subject, body, resend_key, reply_to, from_name)

    smtp_host = os.getenv("SMTP_HOST")
    if smtp_host:
        return _send_via_smtp(to_email, to_name, subject, body, reply_to, from_name)

    # Sin configuración de email — solo loguear
    logger.warning(
        "⚠️  No hay backend de email configurado. "
        "Define SENDGRID_API_KEY o SMTP_HOST en .env para activar el envío.\n"
        "Email que se habría enviado:\n  A: %s\n  Asunto: %s",
        to_email, subject,
    )
    return False


def build_followup_email(lead_name: str, agency_name: str) -> tuple:
    """
    Construye el (asunto, cuerpo) del recordatorio de seguimiento que se envía
    UNA sola vez a un lead que sigue pendiente días después de su consulta.
    Plantilla determinista (sin IA): barata, predecible y segura para salir
    en nombre de la agencia.
    """
    primer_nombre = lead_name.split()[0] if lead_name.strip() else "de nuevo"
    firma = (agency_name or "").strip() or "el equipo"

    asunto = "Seguimos pendientes de tu consulta"
    if agency_name and agency_name.strip():
        asunto += f" · {agency_name.strip()}"

    cuerpo = (
        f"Hola {primer_nombre},\n\n"
        "Hace unos días recibimos tu consulta y no queremos que se quede sin respuesta. "
        "Seguimos a tu disposición: contéstanos a este email o, si lo prefieres, "
        "déjanos un teléfono y te llamamos cuando te venga bien.\n\n"
        "Si ya no lo necesitas, no pasa nada — no volveremos a insistir.\n\n"
        f"Un saludo,\n{firma}"
    )
    return asunto, cuerpo


def _send_via_smtp(
    to_email: str,
    to_name: str,
    subject: str,
    body: str,
    reply_to: Optional[str] = None,
    from_name: Optional[str] = None,
) -> bool:
    """Envía el email usando SMTP nativo con TLS."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    sender_name = from_name or os.getenv("FROM_NAME", "Inmuebia")
    # Fail-closed igual que el backend SendGrid: sin un FROM_EMAIL de dominio propio
    # verificado no se envía. Antes se caía a SMTP_USER, pero con proveedores como
    # Resend ese valor es literalmente "resend" (no un email) → remitente inválido.
    from_email = os.getenv("FROM_EMAIL", "").strip()
    if "@" not in from_email:
        logger.error("FROM_EMAIL no configurado o inválido — no se envía (debe ser un email de dominio propio verificado)")
        return False

    if not smtp_user or not smtp_password:
        logger.error("SMTP_USER y SMTP_PASSWORD son obligatorios para enviar emails")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{sender_name} <{from_email}>"
        msg["To"] = f"{to_name} <{to_email}>"
        msg["Date"] = formatdate(localtime=True)
        domain = from_email.split("@")[-1] if "@" in from_email else None
        msg["Message-ID"] = make_msgid(domain=domain)
        if reply_to:
            msg["Reply-To"] = reply_to

        msg.attach(MIMEText(body, "plain", "utf-8"))

        # timeout: sin esto, si el proveedor de hosting bloquea o descarta
        # silenciosamente el puerto SMTP saliente (frecuente en plataformas
        # cloud, para frenar spam), la conexion se queda colgada para siempre
        # y la tarea en segundo plano nunca llega a loguear ni exito ni error.
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(from_email, [to_email], msg.as_string())

        logger.info("✉️  Email enviado via SMTP a %s", to_email)
        return True

    except smtplib.SMTPAuthenticationError:
        logger.error("Error de autenticación SMTP — revisa SMTP_USER y SMTP_PASSWORD")
        return False
    except smtplib.SMTPException as e:
        logger.error("Error SMTP al enviar a %s: %s", to_email, str(e))
        return False
    except (TimeoutError, OSError) as e:
        logger.error(
            "No se pudo conectar a %s:%s en %ss (%s) — revisa si el proveedor "
            "de hosting bloquea el puerto SMTP saliente",
            smtp_host, smtp_port, 15, str(e),
        )
        return False


def _send_via_resend(
    to_email: str,
    to_name: str,
    subject: str,
    body: str,
    api_key: str,
    reply_to: Optional[str] = None,
    from_name: Optional[str] = None,
) -> bool:
    """Envía el email usando la API HTTP de Resend (puerto 443, que a diferencia
    del SMTP saliente no bloquean los proveedores de hosting como Render)."""
    import httpx

    sender_name = from_name or os.getenv("FROM_NAME", "Inmuebia")
    from_email = os.getenv("FROM_EMAIL", "").strip()
    if "@" not in from_email:
        logger.error("FROM_EMAIL no configurado o inválido — no se envía (debe ser un email de dominio propio verificado)")
        return False

    payload = {
        "from": f"{sender_name} <{from_email}>",
        "to": [f"{to_name} <{to_email}>" if to_name else to_email],
        "subject": subject,
        "text": body,
    }
    if reply_to:
        payload["reply_to"] = reply_to

    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
            timeout=15,
        )
        if response.status_code in (200, 201, 202):
            logger.info("✉️  Email enviado via Resend a %s", to_email)
            return True
        logger.error("Resend devolvió status %d: %s", response.status_code, response.text)
        return False
    except httpx.HTTPError as e:
        logger.error("Error al enviar via Resend a %s: %s", to_email, str(e))
        return False


def _send_via_sendgrid(
    to_email: str,
    to_name: str,
    subject: str,
    body: str,
    api_key: str,
    reply_to: Optional[str] = None,
    from_name: Optional[str] = None,
) -> bool:
    """Envía el email usando la API de SendGrid."""
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To, Content, ReplyTo
    except ImportError:
        logger.error(
            "sendgrid no está instalado. Instala con: pip install sendgrid\n"
            "O usa el backend SMTP configurando SMTP_HOST en .env"
        )
        return False

    sender_name = from_name or os.getenv("FROM_NAME", "Inmuebia")
    # Sin FROM_EMAIL no se envía: un remitente por defecto de un dominio que no
    # es nuestro equivale a suplantarlo (spam seguro y problema legal).
    from_email = os.getenv("FROM_EMAIL", "").strip()
    if not from_email:
        logger.error("FROM_EMAIL no configurado — no se envía el email (debe ser un dominio propio verificado)")
        return False

    try:
        sg = sendgrid.SendGridAPIClient(api_key=api_key)
        mail = Mail(
            from_email=Email(from_email, sender_name),
            to_emails=To(to_email, to_name),
            subject=subject,
            plain_text_content=Content("text/plain", body),
        )
        if reply_to:
            mail.reply_to = ReplyTo(reply_to)
        response = sg.client.mail.send.post(request_body=mail.get())

        if response.status_code in (200, 201, 202):
            logger.info("✉️  Email enviado via SendGrid a %s", to_email)
            return True
        logger.error("SendGrid devolvió status %d", response.status_code)
        return False

    except Exception as e:
        logger.error("Error al enviar via SendGrid a %s: %s", to_email, str(e))
        return False


def send_lead_response_email(
    lead_email: str,
    lead_name: str,
    generated_email_body: str,
    reply_to: Optional[str] = None,
    from_name: Optional[str] = None,
) -> bool:
    """
    Envía el email generado por la IA AL LEAD (el que preguntó).

    reply_to:  email de la agencia, para que las respuestas del lead le lleguen a ella.
    from_name: nombre comercial de la agencia (remitente visible).
    """
    subject = "Gracias por tu consulta — te respondemos enseguida"
    return send_email(
        to_email=lead_email,
        to_name=lead_name,
        subject=subject,
        body=generated_email_body,
        reply_to=reply_to,
        from_name=from_name,
    )


def send_and_mark_lead_email(
    lead_id: str,
    tenant_id: str,
    lead_email: str,
    lead_name: str,
    generated_email_body: str,
    reply_to: Optional[str] = None,
    from_name: Optional[str] = None,
) -> bool:
    """
    Envía la respuesta automática al lead y, SOLO si el envío fue bien, marca
    email_sent=1 en la BD. Pensado para background tasks del intake/qualify:
    si el SMTP falla, el lead queda como borrador y el agente puede enviarlo
    manualmente desde el dashboard (nunca figura como enviado en falso).
    """
    ok = send_lead_response_email(
        lead_email=lead_email,
        lead_name=lead_name,
        generated_email_body=generated_email_body,
        reply_to=reply_to,
        from_name=from_name,
    )
    if ok:
        from core.database import mark_lead_email_sent
        mark_lead_email_sent(lead_id, tenant_id)
    else:
        logger.error(
            "Envío automático al lead %s FALLÓ — queda como borrador (tenant %s)",
            lead_id, tenant_id,
        )
    return ok


def send_tenant_notification(
    tenant_email: str,
    tenant_name: str,
    lead_name: str,
    lead_email: str,
    lead_phone: Optional[str],
    lead_message: str,
    score: int,
    classification: str,
    dashboard_url: str = "",
) -> bool:
    """
    Notifica A LA AGENCIA cuando llega un lead cualificado.
    El filtro de qué leads notificar lo decide el llamador (main.py), no este módulo.
    """
    # Tono según puntuación
    if score >= 8:
        icono = "🔥"
        urgencia = "Lead muy caliente: contacta en menos de 1 hora."
    elif score >= 5:
        icono = "⚡"
        urgencia = "Lead de calidad: contacta hoy."
    else:
        icono = "📋"
        urgencia = "Revisa cuando puedas."

    phone_line = f"Teléfono:   {lead_phone}" if lead_phone else "Teléfono:   No proporcionado"
    dashboard_line = f"\nVer en el panel: {dashboard_url}" if dashboard_url else ""

    body = f"""{icono} Nuevo lead cualificado — {classification} ({score}/10)
{"=" * 50}

Nombre:     {lead_name}
Email:      {lead_email}
{phone_line}

Mensaje original:
"{lead_message}"

{urgencia}{dashboard_line}

---
Mensaje automático de Inmuebia. Puedes ajustar las notificaciones desde tu perfil.
"""

    subject = f"{icono} Nuevo lead [{score}/10] — {lead_name}"

    # Reply-To al propio lead: la agencia puede responder directamente desde el aviso.
    return send_email(
        to_email=tenant_email,
        to_name=tenant_name,
        subject=subject,
        body=body,
        reply_to=lead_email,
    )


def send_weekly_digest(tenant_email: str, tenant_name: str, counts: dict, dashboard_url: str = "") -> bool:
    """Resumen semanal de actividad — recuerda a la agencia el valor de Inmuebia."""
    nuevos      = counts.get("nuevos", 0)
    calientes   = counts.get("calientes", 0)
    pendientes  = counts.get("pendientes", 0)
    valor_total = counts.get("deal_value_total", 0)

    # Estimación de tiempo ahorrado (~5 min por lead cualificado y respondido)
    minutos = nuevos * 5
    ahorro = f"{minutos} minutos" if minutos < 60 else f"{round(minutos / 60, 1)} horas"

    saludo = f"Hola {tenant_name}," if tenant_name else "Hola,"
    dashboard_line = f"\nEntra a tu panel: {dashboard_url}" if dashboard_url else ""
    # Solo se muestra si la agencia ha registrado algún valor de operación cerrada
    # (ver /leads/{id}/status con deal_value) — refuerza el ROI real, no solo actividad.
    valor_line = (
        f"\n💰 Llevas {valor_total:,.0f} € en operaciones cerradas gracias a tus leads de Inmuebia.\n"
        if valor_total > 0 else ""
    )

    body = f"""{saludo}

Este es tu resumen de la semana en Inmuebia:

  • {nuevos} leads nuevos cualificados con IA
  • {calientes} leads calientes (listos para cerrar)
  • {pendientes} leads pendientes de contactar
{valor_line}
Inmuebia te ha ahorrado aproximadamente {ahorro} de leer y responder mensajes.
{f"Tienes {pendientes} leads esperando tu llamada — no dejes que se enfríen." if pendientes else "¡Buen trabajo, lo tienes todo al día!"}
{dashboard_line}

Un saludo,
El equipo de Inmuebia
"""
    return send_email(tenant_email, tenant_name, "📊 Tu resumen semanal en Inmuebia", body)


def send_stale_leads_alert(tenant_email: str, tenant_name: str, leads: list, dashboard_url: str = "") -> bool:
    """Avisa a la agencia de leads buenos que llevan días sin contactar."""
    if not leads:
        return False

    saludo = f"Hola {tenant_name}," if tenant_name else "Hola,"
    dashboard_line = f"\nContáctalos desde tu panel: {dashboard_url}" if dashboard_url else ""
    listado = "\n".join(f"  • {l.get('name', 'Lead')} ({l.get('score', '?')}/10)" for l in leads[:8])
    extra = f"\n  …y {len(leads) - 8} más" if len(leads) > 8 else ""

    body = f"""{saludo}

Tienes {len(leads)} lead(s) de calidad sin contactar desde hace días:

{listado}{extra}

Un lead que no se contacta a tiempo se enfría y se pierde. Llámalos cuanto antes
para no dejar escapar la operación.
{dashboard_line}

Un saludo,
El equipo de Inmuebia
"""
    return send_email(tenant_email, tenant_name, f"⏰ Tienes {len(leads)} leads sin contactar", body)


def send_reminders_due(tenant_email: str, tenant_name: str, reminders: list, dashboard_url: str = "") -> bool:
    """Avisa de los recordatorios de seguimiento que vencen hoy o antes."""
    if not reminders:
        return False

    saludo = f"Hola {tenant_name}," if tenant_name else "Hola,"
    dashboard_line = f"\nRevísalos en tu panel: {dashboard_url}/leads" if dashboard_url else ""
    listado = "\n".join(
        f"  • {r.get('lead_name', 'Lead')}: {r.get('note', '')} ({r.get('due_date', '')})"
        for r in reminders[:10]
    )
    extra = f"\n  …y {len(reminders) - 10} más" if len(reminders) > 10 else ""

    body = f"""{saludo}

Tienes {len(reminders)} recordatorio(s) de seguimiento que vencen hoy o ya pasaron:

{listado}{extra}
{dashboard_line}

Un saludo,
El equipo de Inmuebia
"""
    return send_email(tenant_email, tenant_name, f"📌 Tienes {len(reminders)} recordatorio(s) pendientes hoy", body)


def send_payment_failed(tenant_email: str, tenant_name: str, dashboard_url: str = "") -> bool:
    """Avisa de un pago fallido para que el cliente actualice su tarjeta (evita baja involuntaria)."""
    saludo = f"Hola {tenant_name}," if tenant_name else "Hola,"
    portal_line = f"\nActualiza tu método de pago aquí: {dashboard_url}/perfil" if dashboard_url else ""

    body = f"""{saludo}

No hemos podido procesar el pago de tu suscripción de Inmuebia. Suele deberse a una
tarjeta caducada o sin fondos.

Para no perder el acceso a tus leads, actualiza tu método de pago en los próximos días.
Lo reintentaremos automáticamente.{portal_line}

Si necesitas ayuda, responde a este correo y te echamos una mano.

Un saludo,
El equipo de Inmuebia
"""
    return send_email(tenant_email, tenant_name, "⚠️ Problema con tu pago en Inmuebia", body)
