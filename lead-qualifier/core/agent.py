"""
Agente de cualificación de leads inmobiliarios.

Pipeline optimizado: el análisis, el perfil y la puntuación son deterministas
(Python puro, instantáneo y gratis). La IA se usa para UNA sola cosa: redactar
el email de respuesta. Esto reduce de ~5-10 llamadas a Claude por lead a 1,
bajando coste y latencia drásticamente sin perder calidad.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import anthropic
import httpx

from prompts import SYSTEM_PROMPT
from core.tools import analyze_intent, lookup_company, score_lead
from core.database import save_lead

logger = logging.getLogger(__name__)

# Modelo para la redacción del email — fácil de cambiar aquí.
CLAUDE_MODEL = "claude-sonnet-4-6"


def _make_anthropic_client(api_key: str) -> anthropic.Anthropic:
    """
    Crea el cliente de Anthropic con SSL del almacén nativo del sistema.
    truststore inyecta los certificados raíz del SO en el contexto SSL,
    lo que soluciona CERTIFICATE_VERIFY_FAILED en algunos entornos Windows.
    """
    import ssl
    import truststore
    ssl_ctx = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    http_client = httpx.Client(verify=ssl_ctx)
    return anthropic.Anthropic(api_key=api_key, http_client=http_client)


# ─────────────────────────────────────────────
# Redacción del email (única llamada a la IA)
# ─────────────────────────────────────────────

def _siguiente_paso(classification: str, operation: str) -> str:
    """Pista para la IA sobre qué CTA proponer según el tipo de lead."""
    if operation in ("VENTA", "TASACION"):
        return "ofrece una valoración gratuita y una visita para tasar el inmueble"
    if classification == "CALIENTE":
        return "propón ver inmuebles que encajen con su búsqueda y una llamada o visita esta misma semana"
    if classification == "TIBIO":
        return "ofrece enviarle una selección de opciones y resuelve sus dudas sin compromiso"
    return "haz 1 o 2 preguntas concretas (zona, presupuesto o plazo) para poder ayudarle mejor"


def _limpiar_email(texto: str) -> str:
    """Quita comillas o vallas de código que a veces envuelven la respuesta."""
    t = texto.strip()
    if t.startswith("```"):
        t = t.split("```")[1] if "```" in t[3:] else t.lstrip("`")
    if len(t) >= 2 and t[0] == '"' and t[-1] == '"':
        t = t[1:-1].strip()
    return t.strip()


def _email_fallback(primer_nombre: str, firma: str, classification: str, operation: str) -> str:
    """Email de respaldo si la IA no está disponible — el lead nunca se queda sin respuesta."""
    if operation in ("VENTA", "TASACION"):
        cuerpo = ("Gracias por contar con nosotros para la venta de tu inmueble. "
                  "Nos encantaría ofrecerte una valoración gratuita y sin compromiso. "
                  "¿Cuándo te vendría bien que hablemos?")
    elif classification == "CALIENTE":
        cuerpo = ("Gracias por tu mensaje. Tenemos opciones que pueden encajar con lo que buscas "
                  "y me gustaría enseñártelas. ¿Te viene bien que te llame esta semana?")
    else:
        cuerpo = ("Gracias por tu mensaje. Para ayudarte mejor, ¿podrías indicarme la zona que te "
                  "interesa, tu presupuesto aproximado y en qué plazo te gustaría avanzar?")
    return f"Hola {primer_nombre},\n\n{cuerpo}\n\nUn saludo,\n{firma}"


def _redactar_email(
    client: anthropic.Anthropic,
    name: str,
    primer_nombre: str,
    firma: str,
    email: str,
    message: str,
    intent: dict,
    scoring: dict,
) -> str:
    """Genera el email de respuesta con una única llamada a Claude."""
    classification = scoring.get("classification", "TIBIO")
    score          = scoring.get("score", 5)
    operation      = intent.get("operation", "INFORMACION")
    reasoning      = scoring.get("reasoning", "")
    hint           = _siguiente_paso(classification, operation)

    user_prompt = f"""Redacta el email de respuesta para este lead inmobiliario.
Devuelve ÚNICAMENTE el texto del email: sin asunto, sin comillas y sin notas adicionales.

Lead: {name} <{email}>
Mensaje recibido: "{message}"

Cualificación interna (NO la menciones nunca en el email):
- Clasificación: {classification} ({score}/10)
- Operación detectada: {operation}
- Señales clave: {reasoning}

Reglas:
- Empieza con "Hola {primer_nombre},".
- Máximo 150 palabras, español natural y cercano, como un buen comercial inmobiliario.
- Siguiente paso a proponer: {hint}.
- No inventes inmuebles, precios ni datos que no aparezcan en el mensaje.
- Cierra exactamente con:
Un saludo,
{firma}"""

    try:
        resp = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=600,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        texto = resp.content[0].text if resp.content else ""
        limpio = _limpiar_email(texto)
        return limpio or _email_fallback(primer_nombre, firma, classification, operation)
    except Exception as exc:
        logger.error("Error redactando email con IA: %s — usando fallback", exc)
        return _email_fallback(primer_nombre, firma, classification, operation)


# ─────────────────────────────────────────────
# Punto de entrada principal
# ─────────────────────────────────────────────

def qualify_lead(
    name: str,
    email: str,
    phone: Optional[str],
    message: str,
    anthropic_client: anthropic.Anthropic,
    tenant_id: str = "legacy",
    agency_name: Optional[str] = None,
) -> dict:
    """
    Cualifica un lead inmobiliario completo y lo guarda en la base de datos.

    Flujo:
      1. analyze_intent  (Python, determinista)
      2. lookup_company  (Python, determinista)
      3. score_lead      (Python, determinista)
      4. redactar email  (1 llamada a Claude)
      5. guardar en BD

    agency_name: nombre comercial de la agencia para firmar el email.
    """
    lead_id       = str(uuid.uuid4())
    firma         = (agency_name or "").strip() or "el equipo"
    primer_nombre = name.split()[0] if name.strip() else "cliente"

    logger.info("═" * 60)
    logger.info("🚀 Cualificando lead inmobiliario")
    logger.info("   ID      : %s", lead_id)
    logger.info("   Nombre  : %s", name)
    logger.info("   Email   : %s", email)
    logger.info("   Agencia : %s", firma)
    logger.info("═" * 60)

    # ── 1-3: análisis determinista ──
    intent  = analyze_intent(message, name)
    company = lookup_company(email)
    scoring = score_lead(intent, company)

    classification      = scoring.get("classification", "TIBIO")
    score               = scoring.get("score", 5)
    reasoning           = scoring.get("reasoning", "Análisis completado")
    recommended_actions = scoring.get("recommended_actions", ["Revisar manualmente"])

    # ── 4: email (única llamada a la IA) ──
    generated_email = _redactar_email(
        anthropic_client, name, primer_nombre, firma, email, message, intent, scoring,
    )

    # ── 5: persistir ──
    try:
        save_lead(
            lead_id=lead_id,
            tenant_id=tenant_id,
            name=name,
            email=email,
            phone=phone,
            message=message,
            classification=classification,
            score=score,
            reasoning=reasoning,
            generated_email=generated_email,
            recommended_actions=recommended_actions,
            intent_analysis=intent,
            company_info=company,
        )
    except Exception as exc:
        logger.error("Error guardando lead %s en BD: %s", lead_id, exc)

    result = {
        "lead_id": lead_id,
        "classification": classification,
        "score": score,
        "reasoning": reasoning,
        "generated_email": generated_email,
        "recommended_actions": recommended_actions,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }

    logger.info("📋 Resultado: %s · %d/10 · %s", classification, score, intent.get("operation"))
    return result
