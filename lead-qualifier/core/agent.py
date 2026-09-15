"""
Agente de cualificación de leads inmobiliarios.

Pipeline: UNA sola llamada a Claude por lead, que hace dos cosas en la misma
respuesta: (1) extrae las señales del mensaje (operación, financiación,
urgencia, presupuesto...) ENTENDIENDO el significado real —incluidas
negaciones ("no tengo la hipoteca aprobada todavía")— en vez de buscar
palabras clave con regex, y (2) redacta el email de respuesta. La puntuación
final (score_lead en core/tools.py) sigue siendo 100% determinista y
transparente a partir de esas señales: la IA solo mejora CÓMO se detectan,
no cómo se puntúan.

Si la llamada a Claude falla (API caída, timeout, respuesta inválida), el
lead nunca se queda sin cualificar: se usa analyze_intent (regex) como
respaldo determinista y una plantilla de email fija.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import anthropic
import httpx

from config import CLAUDE_PRICE_INPUT_PER_MTOK, CLAUDE_PRICE_OUTPUT_PER_MTOK
from prompts import SYSTEM_PROMPT
from core.tools import analyze_intent, lookup_company, score_lead, etiqueta_intencion
from core.database import pick_next_agent, save_lead

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
# Extracción de señales + redacción del email (única llamada a la IA)
# ─────────────────────────────────────────────

# Herramienta que Claude debe rellenar en su respuesta. Forzamos su uso
# (tool_choice) para obtener siempre un objeto validado, no texto libre a
# parsear. Las descripciones de cada campo son el mecanismo real anti-bug:
# le decimos explícitamente cómo tratar las negaciones, que es justo lo que
# el regex nunca puede generalizar (siempre aparece una frase nueva que no
# está en la lista de patrones).
CUALIFICAR_TOOL = {
    "name": "cualificar_lead",
    "description": (
        "Registra las señales reales del mensaje del lead inmobiliario y el "
        "email de respuesta para él."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "operation": {
                "type": "string",
                "enum": ["VENTA", "TASACION", "INVERSION", "COMPRA", "ALQUILER", "INFORMACION"],
                "description": (
                    "VENTA: quiere vender/poner a la venta su inmueble. "
                    "TASACION: pide tasar o valorar su inmueble (cuánto vale). "
                    "INVERSION: busca inmuebles como inversión/rentabilidad, no para vivir. "
                    "COMPRA: quiere comprar un inmueble para sí mismo. "
                    "ALQUILER: busca o pone en alquiler un inmueble. "
                    "INFORMACION: consulta general, sin operación definida."
                ),
            },
            "property_type": {
                "type": ["string", "null"],
                "description": "Tipo de inmueble mencionado (piso, casa, ático, chalet, local, terreno...), o null si no se menciona.",
            },
            "has_zone": {
                "type": "boolean",
                "description": "true si el mensaje menciona una zona, ciudad, barrio o ubicación concreta donde busca/vende.",
            },
            "rooms": {
                "type": ["integer", "null"],
                "description": "Número de habitaciones/dormitorios mencionado, o null si no se indica.",
            },
            "budget": {
                "type": ["integer", "null"],
                "description": (
                    "Presupuesto o precio en euros mencionado explícitamente, como número "
                    "entero (ej. '300k' -> 300000, '1,2 millones' -> 1200000), o null si no "
                    "se indica ninguna cifra."
                ),
            },
            "financing": {
                "type": "string",
                "enum": ["contado", "hipoteca_aprobada", "necesita", "desconocido"],
                "description": (
                    "Estado REAL de financiación. Presta MÁXIMA atención a negaciones: "
                    "'no tengo el dinero', 'no tengo la hipoteca aprobada todavía', 'el banco "
                    "no me ha concedido nada' significan SIEMPRE 'necesita' — nunca 'contado' "
                    "ni 'hipoteca_aprobada' — aunque el mensaje contenga esas palabras. "
                    "'contado': tiene el dinero/liquidez, paga sin hipoteca. "
                    "'hipoteca_aprobada': ya tiene hipoteca aprobada/preaprobada/concedida por el banco. "
                    "'necesita': aún necesita conseguir financiación, o dice explícitamente que "
                    "todavía no la tiene resuelta. "
                    "'desconocido': el mensaje no menciona nada sobre financiación."
                ),
            },
            "urgency": {
                "type": "string",
                "enum": ["alta", "media", "baja"],
                "description": (
                    "Urgencia REAL, prestando atención a negaciones: 'no es urgente', 'sin "
                    "prisa', 'con calma' significan SIEMPRE 'baja' aunque contengan la palabra "
                    "'urgente'. 'alta': quiere cerrar ya/cuanto antes/esta semana. "
                    "'media': a medio plazo, mirando opciones sin fecha concreta. "
                    "'baja': sin plazo definido, o declara explícitamente que no tiene prisa."
                ),
            },
            "urgency_explicit_low": {
                "type": "boolean",
                "description": "true SOLO si el lead declara explícitamente que no tiene prisa (ej. 'no tengo prisa', 'sin prisa', 'con calma'). false en cualquier otro caso, incluida la simple ausencia de mención al plazo.",
            },
            "message_quality": {
                "type": "string",
                "enum": ["muy_vago", "vago", "claro"],
                "description": (
                    "'muy_vago': mensaje muy corto sin información útil, texto de prueba/spam "
                    "('prueba', 'test', 'asdf'...), o el lead se muestra indeciso ('lo que sea', "
                    "'un poco de todo', 'no lo tengo claro'). "
                    "'vago': aporta poca información concreta sobre lo que busca. "
                    "'claro': mensaje con contenido real y concreto."
                ),
            },
            "email": {
                "type": "string",
                "description": (
                    "El email de respuesta para el lead. Máximo 150 palabras, español natural "
                    "y cercano. Empieza con 'Hola {primer_nombre},'. Propón un siguiente paso "
                    "concreto y COHERENTE con las señales que acabas de extraer en este mismo "
                    "objeto (ej.: si operation es VENTA/TASACION, ofrece valoración gratuita; "
                    "si financing es 'necesita', ofrece ayuda con la hipoteca; si urgency es "
                    "'baja', no fuerces prisa; si message_quality no es 'claro', haz 1-2 "
                    "preguntas concretas en vez de proponer visitas). No inventes inmuebles ni "
                    "precios. No menciones puntuaciones ni procesos internos. Cierra EXACTAMENTE "
                    "con 'Un saludo,\\n{firma}'."
                ),
            },
        },
        "required": [
            "operation", "has_zone", "financing", "urgency",
            "urgency_explicit_low", "message_quality", "email",
        ],
    },
}


def _limpiar_email(texto: str) -> str:
    """Quita comillas o vallas de código que a veces envuelven la respuesta."""
    t = texto.strip()
    if t.startswith("```"):
        t = (t.split("```")[1] if "```" in t[3:] else t.lstrip("`")).strip()
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


def _extraer_y_redactar(
    client: anthropic.Anthropic,
    name: str,
    primer_nombre: str,
    firma: str,
    email: str,
    message: str,
    brand_voice: Optional[str] = None,
) -> Optional[dict]:
    """
    Única llamada a Claude: extrae las señales del mensaje (financiación,
    urgencia, presupuesto...) entendiendo negaciones y matices reales, y
    redacta el email en la misma respuesta.

    Devuelve None si la llamada falla o la respuesta no es válida — el
    llamante debe entonces usar analyze_intent (regex) + email plantilla,
    así el lead nunca se queda sin cualificar por una caída de la API.
    """
    estilo = ""
    if brand_voice and brand_voice.strip():
        estilo = f"\nSigue estas preferencias de estilo de la agencia al redactar el email: {brand_voice.strip()}"

    user_prompt = f"""Analiza este lead inmobiliario llamando a la herramienta cualificar_lead.

Lead: {name} <{email}>
Mensaje recibido: "{message}"

Primer nombre para el saludo del email: {primer_nombre}
Firma para cerrar el email: {firma}{estilo}"""

    try:
        # Timeout explícito: esta llamada es bloqueante y corre en el
        # threadpool de FastAPI (ver qualify_lead_endpoint/public_intake). Sin
        # límite, una degradación de latencia en la API de Anthropic retiene
        # hilos del pool más tiempo del esperado bajo carga sostenida.
        resp = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=800,
            system=SYSTEM_PROMPT,
            tools=[CUALIFICAR_TOOL],
            tool_choice={"type": "tool", "name": "cualificar_lead"},
            messages=[{"role": "user", "content": user_prompt}],
            timeout=20.0,
        )
        bloque = next((b for b in (resp.content or []) if getattr(b, "type", None) == "tool_use"), None)
        if bloque is None:
            raise ValueError("la respuesta no incluyó una llamada a la herramienta cualificar_lead")
        datos = bloque.input or {}

        def _entero_o_none(valor):
            try:
                return int(valor) if valor is not None else None
            except (TypeError, ValueError):
                return None

        operation     = datos.get("operation") or "INFORMACION"
        property_type = datos.get("property_type") or None
        budget        = _entero_o_none(datos.get("budget"))

        intent = {
            "intention":        etiqueta_intencion(operation, property_type),
            "operation":        operation,
            "property_type":    property_type,
            "has_zone":         bool(datos.get("has_zone", False)),
            "rooms":            _entero_o_none(datos.get("rooms")),
            "budget":           budget,
            "budget_text":      f"{budget:,} €".replace(",", ".") if budget else None,
            "financing":        datos.get("financing") or "desconocido",
            "urgency":          datos.get("urgency") or "baja",
            "urgency_explicit_low": bool(datos.get("urgency_explicit_low", False)),
            "keywords":         [],
            "message_quality":  datos.get("message_quality") or "vago",
            "word_count":       len(message.split()),
        }

        email_texto = _limpiar_email(str(datos.get("email") or ""))
        if not email_texto:
            raise ValueError("la herramienta cualificar_lead no devolvió texto de email")

        usage = getattr(resp, "usage", None)
        return {
            "intent": intent,
            "email_text": email_texto,
            "input_tokens": getattr(usage, "input_tokens", None) if usage else None,
            "output_tokens": getattr(usage, "output_tokens", None) if usage else None,
        }
    except Exception as exc:
        logger.error("Error extrayendo señales/redactando email con IA: %s — usando respaldo determinista", exc)
        return None


def _estimar_coste_usd(input_tokens: Optional[int], output_tokens: Optional[int]) -> Optional[float]:
    """Coste estimado (USD) de la llamada de redacción a partir de sus tokens reales."""
    if input_tokens is None or output_tokens is None:
        return None
    return (
        input_tokens / 1_000_000 * CLAUDE_PRICE_INPUT_PER_MTOK
        + output_tokens / 1_000_000 * CLAUDE_PRICE_OUTPUT_PER_MTOK
    )


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
    brand_voice: Optional[str] = None,
    auto_send: bool = True,
    source: Optional[str] = None,
) -> dict:
    """
    Cualifica un lead inmobiliario completo y lo guarda en la base de datos.

    Flujo:
      1. extraer señales + redactar email (1 llamada a Claude; regex+plantilla
         de respaldo si falla)
      2. lookup_company  (Python, determinista)
      3. score_lead      (Python, determinista, sobre las señales extraídas)
      4. guardar en BD

    agency_name: nombre comercial de la agencia para firmar el email.
    brand_voice: preferencias de estilo del tenant que la IA respeta al redactar.
    auto_send:   False → el email queda como BORRADOR (email_sent=0) para que el
                 agente lo revise/edite antes de enviarlo desde el dashboard.
    source:      canal de entrada ('formulario' | 'api' | 'email'), para poder
                 comparar qué canal convierte mejor.
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

    # ── 1: extracción de señales + email (única llamada a la IA) ──
    resultado_ia = _extraer_y_redactar(
        anthropic_client, name, primer_nombre, firma, email, message,
        brand_voice=brand_voice,
    )
    if resultado_ia is not None:
        intent = resultado_ia["intent"]
        input_tokens = resultado_ia["input_tokens"]
        output_tokens = resultado_ia["output_tokens"]
    else:
        intent = analyze_intent(message, name)
        input_tokens = output_tokens = None

    # ── 2-3: perfil + puntuación (Python, determinista) ──
    company = lookup_company(email)
    scoring = score_lead(intent, company)

    classification      = scoring.get("classification", "TIBIO")
    score               = scoring.get("score", 5)
    reasoning           = scoring.get("reasoning", "Análisis completado")
    recommended_actions = scoring.get("recommended_actions", ["Revisar manualmente"])

    generated_email = (
        resultado_ia["email_text"] if resultado_ia is not None
        else _email_fallback(primer_nombre, firma, classification, intent.get("operation", "INFORMACION"))
    )
    ai_cost_usd = _estimar_coste_usd(input_tokens, output_tokens)

    # ── 5: reparto automático entre el equipo (None si es cuenta individual) ──
    try:
        assigned_to = pick_next_agent(tenant_id)
    except Exception as exc:
        logger.warning("No se pudo asignar el lead %s a un agente: %s", lead_id, exc)
        assigned_to = None

    # ── 6: persistir ──
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
            assigned_to=assigned_to,
            # Siempre 0: el envío ocurre DESPUÉS (background task) y solo al
            # confirmarse se marca como enviado. Si el SMTP falla, el lead queda
            # como borrador reclamable en el dashboard, no como enviado en falso.
            email_sent=0,
            source=source,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            ai_cost_usd=ai_cost_usd,
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
        "assigned_to": assigned_to,
        # True = se enviará automáticamente (el envío real lo confirma el
        # background task marcando email_sent=1 en BD); False = queda en borrador.
        "email_sent": bool(auto_send),
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }

    logger.info("📋 Resultado: %s · %d/10 · %s", classification, score, intent.get("operation"))
    return result
