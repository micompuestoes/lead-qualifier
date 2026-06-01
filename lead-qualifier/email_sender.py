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
    sender_name = from_name or os.getenv("FROM_NAME", "Inmobia")
    from_email = os.getenv("FROM_EMAIL", smtp_user)

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

        with smtplib.SMTP(smtp_host, smtp_port) as server:
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

    sender_name = from_name or os.getenv("FROM_NAME", "Inmobia")
    from_email = os.getenv("FROM_EMAIL", "noreply@inmobia.es")

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
Mensaje automático de Inmobia. Puedes ajustar las notificaciones desde tu perfil.
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
