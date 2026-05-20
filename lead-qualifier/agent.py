"""
Agente principal de cualificación de leads.
Implementa el agentic loop real: Claude decide qué tools llamar y en qué orden.
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import anthropic
import certifi
import httpx

from prompts import SYSTEM_PROMPT, EMAIL_GENERATION_PROMPT
from tools import TOOLS_DEFINITION, execute_tool

logger = logging.getLogger(__name__)

# Modelo a usar — fácil de cambiar aquí
CLAUDE_MODEL = "claude-sonnet-4-20250514"
MAX_ITERATIONS = 10  # Límite de seguridad para el loop


def _make_anthropic_client(api_key: str) -> anthropic.Anthropic:
    """
    Crea el cliente de Anthropic con SSL del almacén nativo de Windows.
    truststore inyecta los certificados raíz del sistema operativo en el contexto SSL,
    lo que soluciona el error CERTIFICATE_VERIFY_FAILED en Python de Microsoft Store.
    """
    import ssl
    import truststore
    ssl_ctx = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    http_client = httpx.Client(verify=ssl_ctx)
    return anthropic.Anthropic(api_key=api_key, http_client=http_client)


def qualify_lead(
    name: str,
    email: str,
    phone: Optional[str],
    message: str,
    anthropic_client: anthropic.Anthropic,
) -> dict:
    """
    Punto de entrada principal del agente.
    Ejecuta el agentic loop completo y devuelve el resultado estructurado.
    """
    lead_id = str(uuid.uuid4())
    logger.info("═" * 60)
    logger.info("🚀 Iniciando cualificación de lead")
    logger.info("   ID     : %s", lead_id)
    logger.info("   Nombre : %s", name)
    logger.info("   Email  : %s", email)
    logger.info("═" * 60)

    # Mensaje inicial al agente con todos los datos del lead
    initial_message = f"""Nuevo lead recibido. Cualifícalo usando las herramientas disponibles.

Datos del lead:
- Nombre: {name}
- Email: {email}
- Teléfono: {phone or "No proporcionado"}
- Mensaje: {message}

ID del lead para guardar en BD: {lead_id}

Por favor:
1. Analiza la intención del mensaje
2. Investiga el dominio del email
3. Calcula la puntuación y clasificación
4. Genera un email de respuesta en español (máximo 150 palabras, tono cálido y profesional)
5. Guarda todo en la base de datos con el ID proporcionado

Para el email generado: escríbelo directamente en el campo generated_email de save_to_db.
El email debe empezar con "Hola {name.split()[0]}," y terminar con "Un saludo,\\nEl equipo"
"""

    messages = [{"role": "user", "content": initial_message}]

    # Estado acumulado del agente — se rellena conforme las tools devuelven resultados
    agent_state = {
        "lead_id": lead_id,
        "lead_data": {"name": name, "email": email, "phone": phone, "message": message},
        "intent_analysis": None,
        "company_info": None,
        "score": None,
        "classification": None,
        "reasoning": None,
        "generated_email": None,
        "recommended_actions": [],
    }

    # ─────────────────────────────────────────
    # Agentic loop
    # ─────────────────────────────────────────
    iteration = 0
    while iteration < MAX_ITERATIONS:
        iteration += 1
        logger.info("─── Iteración %d del agente ───────────────────", iteration)

        response = anthropic_client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS_DEFINITION,
            messages=messages,
        )

        logger.info("   Stop reason: %s", response.stop_reason)

        # Agregar respuesta del asistente al historial
        messages.append({"role": "assistant", "content": response.content})

        # Si Claude terminó sin más tool calls, salimos del loop
        if response.stop_reason == "end_turn":
            logger.info("✅ Agente finalizado (end_turn)")
            break

        # Procesar tool calls si las hay
        if response.stop_reason == "tool_use":
            tool_results = []

            for content_block in response.content:
                if content_block.type != "tool_use":
                    continue

                tool_name = content_block.name
                tool_input = content_block.input
                tool_use_id = content_block.id

                logger.info("🔧 Tool llamada: %s", tool_name)
                logger.debug("   Input: %s", json.dumps(tool_input, ensure_ascii=False, indent=2))

                try:
                    # Ejecutar la tool
                    result = execute_tool(tool_name, tool_input)

                    # Guardar resultados en el estado del agente
                    _update_agent_state(agent_state, tool_name, tool_input, result)

                    result_str = json.dumps(result, ensure_ascii=False)
                    logger.info("   ✓ Resultado: %s", result_str[:200])

                except Exception as e:
                    logger.error("   ✗ Error en tool %s: %s", tool_name, str(e))
                    result_str = json.dumps({"error": str(e), "tool": tool_name})

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": result_str,
                })

            # Enviar los resultados de las tools de vuelta a Claude
            messages.append({"role": "user", "content": tool_results})

    else:
        logger.warning("⚠️  Se alcanzó el límite máximo de iteraciones (%d)", MAX_ITERATIONS)

    # ─────────────────────────────────────────
    # Construir respuesta final
    # ─────────────────────────────────────────
    return _build_final_response(agent_state, response)


def _update_agent_state(state: dict, tool_name: str, tool_input: dict, result: Any) -> None:
    """Actualiza el estado acumulado del agente con el resultado de cada tool."""
    if tool_name == "analyze_intent":
        state["intent_analysis"] = result

    elif tool_name == "lookup_company":
        state["company_info"] = result

    elif tool_name == "score_lead":
        state["score"] = result.get("score")
        state["classification"] = result.get("classification")
        state["reasoning"] = result.get("reasoning")
        state["recommended_actions"] = result.get("recommended_actions", [])

    elif tool_name == "generate_email":
        # El email real lo escribe Claude — aquí guardamos lo que pasó como input
        # El texto real se extrae del argumento que Claude pasó a save_to_db
        pass

    elif tool_name == "save_to_db":
        # Cuando se guarda en BD, actualizamos el estado con el email final
        state["generated_email"] = tool_input.get("generated_email", "")
        if not state["recommended_actions"] and tool_input.get("recommended_actions"):
            state["recommended_actions"] = tool_input.get("recommended_actions", [])


def _build_final_response(state: dict, last_response) -> dict:
    """Construye el JSON de respuesta final a partir del estado del agente."""

    # Extraer el texto final que Claude escribió (si lo hay)
    final_text = ""
    for block in last_response.content:
        if hasattr(block, "text"):
            final_text = block.text
            break

    # Fallbacks por si algún campo no se llenó correctamente
    classification = state.get("classification") or "TIBIO"
    score = state.get("score") or 5
    reasoning = state.get("reasoning") or "Análisis completado"
    generated_email = state.get("generated_email") or final_text or "Email pendiente de generación"
    recommended_actions = state.get("recommended_actions") or ["Revisar manualmente"]

    result = {
        "lead_id": state["lead_id"],
        "classification": classification,
        "score": score,
        "reasoning": reasoning,
        "generated_email": generated_email,
        "recommended_actions": recommended_actions,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }

    logger.info("═" * 60)
    logger.info("📋 RESULTADO FINAL")
    logger.info("   Lead ID       : %s", result["lead_id"])
    logger.info("   Clasificación : %s", result["classification"])
    logger.info("   Score         : %d/10", result["score"])
    logger.info("   Razonamiento  : %s", result["reasoning"])
    logger.info("═" * 60)

    return result
