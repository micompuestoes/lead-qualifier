"""
Módulo de envío de emails.
Soporta dos backends: SMTP nativo (smtplib) y SendGrid SDK.
Se selecciona automáticamente según las variables de entorno configuradas.
"""

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger(__name__)


def send_email(
    to_email: str,
    to_name: str,
    subject: str,
    body: str,
) -> bool:
    """
    Envía un email. Elige automáticamente el backend disponible.
    Devuelve True si se envió correctamente, False si falló.
    """
    # Si hay API key de SendGrid, usarla
    sendgrid_key = os.getenv("SENDGRID_API_KEY")
    if sendgrid_key:
        return _send_via_sendgrid(to_email, to_name, subject, body, sendgrid_key)

    # Si hay configuración SMTP, usarla
    smtp_host = os.getenv("SMTP_HOST")
    if smtp_host:
        return _send_via_smtp(to_email, to_name, subject, body)

    # Sin configuración de email — solo loguear
    logger.warning(
        "⚠️  No hay backend de email configurado. "
        "Define SENDGRID_API_KEY o SMTP_HOST en .env para activar el envío.\n"
        "Email que se habría enviado:\n  A: %s\n  Asunto: %s\n  Cuerpo:\n%s",
        to_email, subject, body
    )
    return False


def _send_via_smtp(
    to_email: str,
    to_name: str,
    subject: str,
    body: str,
) -> bool:
    """Envía el email usando SMTP nativo con TLS."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    from_name = os.getenv("FROM_NAME", "Tu Empresa")
    from_email = os.getenv("FROM_EMAIL", smtp_user)

    if not smtp_user or not smtp_password:
        logger.error("SMTP_USER y SMTP_PASSWORD son obligatorios para enviar emails")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = f"{to_name} <{to_email}>"

        # Versión texto plano
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
) -> bool:
    """Envía el email usando la API de SendGrid."""
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To, Content
    except ImportError:
        logger.error(
            "sendgrid no está instalado. Instala con: pip install sendgrid\n"
            "O usa el backend SMTP configurando SMTP_HOST en .env"
        )
        return False

    from_name = os.getenv("FROM_NAME", "Tu Empresa")
    from_email = os.getenv("FROM_EMAIL", "noreply@tuempresa.com")

    try:
        sg = sendgrid.SendGridAPIClient(api_key=api_key)
        mail = Mail(
            from_email=Email(from_email, from_name),
            to_emails=To(to_email, to_name),
            subject=subject,
            plain_text_content=Content("text/plain", body),
        )
        response = sg.client.mail.send.post(request_body=mail.get())

        if response.status_code in (200, 201, 202):
            logger.info("✉️  Email enviado via SendGrid a %s", to_email)
            return True
        else:
            logger.error("SendGrid devolvió status %d", response.status_code)
            return False

    except Exception as e:
        logger.error("Error al enviar via SendGrid a %s: %s", to_email, str(e))
        return False


def send_lead_response_email(
    lead_email: str,
    lead_name: str,
    generated_email_body: str,
) -> bool:
    """
    Envía el email generado por la IA AL LEAD (el que preguntó).
    """
    subject = "Gracias por contactarnos — Recibimos tu consulta"
    return send_email(
        to_email=lead_email,
        to_name=lead_name,
        subject=subject,
        body=generated_email_body,
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
    Notifica A LA EMPRESA (inmobiliaria, etc.) cuando llega un lead cualificado.
    Solo se envía si score >= 6 para no spamear con leads fríos.
    """
    if score < 6:
        logger.info("Lead score %d < 6 — no se notifica al tenant", score)
        return False

    # Emoji según puntuación
    if score >= 8:
        icono = "🔥"
        urgencia = "¡LEAD MUY CALIENTE! Contacta en menos de 1 hora."
    elif score >= 6:
        icono = "⚡"
        urgencia = "Lead de calidad. Contacta hoy."
    else:
        icono = "📋"
        urgencia = "Revisar cuando puedas."

    phone_line = f"Teléfono:  {lead_phone}" if lead_phone else "Teléfono:  No proporcionado"
    dashboard_line = f"\nVer en dashboard: {dashboard_url}" if dashboard_url else ""

    body = f"""{icono} Nuevo lead cualificado — {classification}
{"=" * 50}

Nombre:    {lead_name}
Email:     {lead_email}
{phone_line}
Puntuación: {score}/10

Mensaje original:
"{lead_message}"

{urgencia}{dashboard_line}

---
Este mensaje fue generado automáticamente por Lead Qualifier.
Para desactivar estas notificaciones, actualiza tu perfil en el dashboard.
"""

    subject = f"{icono} Nuevo lead [{score}/10] — {lead_name}"

    return send_email(
        to_email=tenant_email,
        to_name=tenant_name,
        subject=subject,
        body=body,
    )
