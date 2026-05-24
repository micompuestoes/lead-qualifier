"""
Definición e implementación de las herramientas (tools) que usa el agente Claude.
Cada tool tiene: definición JSON para la API + función Python que la ejecuta.
"""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Dominios de email personal más comunes — se tratan como leads individuales
PERSONAL_EMAIL_DOMAINS = {
    "gmail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es",
    "yahoo.com", "yahoo.es", "icloud.com", "me.com", "live.com",
    "protonmail.com", "tutanota.com", "msn.com", "telefonica.net",
}


# ─────────────────────────────────────────────
# Definiciones JSON de las tools para Claude
# ─────────────────────────────────────────────

TOOLS_DEFINITION = [
    {
        "name": "analyze_intent",
        "description": (
            "Analiza el mensaje del lead para extraer su intención, urgencia y palabras clave. "
            "Llama esta tool PRIMERO antes de cualquier otra."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "El mensaje original enviado por el lead",
                },
                "name": {
                    "type": "string",
                    "description": "Nombre del lead para personalizar el análisis",
                },
            },
            "required": ["message", "name"],
        },
    },
    {
        "name": "lookup_company",
        "description": (
            "Extrae el dominio del email e infiere información de la empresa: sector, tamaño estimado, "
            "si es un email personal (Gmail/Hotmail) o corporativo."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "email": {
                    "type": "string",
                    "description": "Email del lead para extraer el dominio empresarial",
                },
            },
            "required": ["email"],
        },
    },
    {
        "name": "score_lead",
        "description": (
            "Calcula la puntuación (1-10) y clasificación (CALIENTE/TIBIO/FRÍO) del lead "
            "usando el análisis de intención y la info de empresa. "
            "Llama esta tool después de analyze_intent y lookup_company."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "intent_analysis": {
                    "type": "object",
                    "description": "Resultado de analyze_intent",
                },
                "company_info": {
                    "type": "object",
                    "description": "Resultado de lookup_company",
                },
                "message": {
                    "type": "string",
                    "description": "Mensaje original del lead",
                },
            },
            "required": ["intent_analysis", "company_info", "message"],
        },
    },
    {
        "name": "generate_email",
        "description": (
            "Genera un email de respuesta personalizado en español para el lead, "
            "adaptado a su clasificación y perfil. Máximo 150 palabras."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "lead_data": {
                    "type": "object",
                    "description": "Datos del lead: name, email, phone, message",
                },
                "score": {
                    "type": "integer",
                    "description": "Puntuación del lead (1-10)",
                },
                "classification": {
                    "type": "string",
                    "description": "Clasificación: CALIENTE, TIBIO o FRÍO",
                },
                "company_info": {
                    "type": "object",
                    "description": "Información de la empresa del lead",
                },
                "reasoning": {
                    "type": "string",
                    "description": "Razonamiento de la puntuación para contextualizar el email",
                },
            },
            "required": ["lead_data", "score", "classification", "company_info", "reasoning"],
        },
    },
    {
        "name": "save_to_db",
        "description": (
            "Guarda el lead y todos los resultados del análisis en la base de datos SQLite. "
            "Llama esta tool SIEMPRE como último paso."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "lead_id": {
                    "type": "string",
                    "description": "UUID único del lead",
                },
                "lead_data": {
                    "type": "object",
                    "description": "Datos originales del lead",
                },
                "classification": {
                    "type": "string",
                    "description": "Clasificación final: CALIENTE, TIBIO o FRÍO",
                },
                "score": {
                    "type": "integer",
                    "description": "Puntuación final (1-10)",
                },
                "reasoning": {
                    "type": "string",
                    "description": "Razonamiento de la clasificación",
                },
                "generated_email": {
                    "type": "string",
                    "description": "Email generado para el lead",
                },
                "recommended_actions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Lista de acciones recomendadas",
                },
                "intent_analysis": {
                    "type": "object",
                    "description": "Resultado del análisis de intención",
                },
                "company_info": {
                    "type": "object",
                    "description": "Información de la empresa inferida",
                },
            },
            "required": [
                "lead_id", "lead_data", "classification", "score",
                "reasoning", "generated_email", "recommended_actions",
                "intent_analysis", "company_info",
            ],
        },
    },
]


# ─────────────────────────────────────────────
# Implementaciones Python de cada tool
# ─────────────────────────────────────────────

def analyze_intent(message: str, name: str) -> dict:
    """
    Analiza el mensaje del lead para extraer intención, urgencia y palabras clave.
    Este análisis es determinista (no llama a Claude de nuevo) para mantener velocidad.
    """
    logger.info("🔍 Analizando intención del mensaje de %s", name)

    message_lower = message.lower()

    # Detectar urgencia por palabras clave
    urgency_high = any(w in message_lower for w in [
        "urgente", "urgencia", "inmediatamente", "cuanto antes", "ya", "hoy",
        "esta semana", "pronto", "rápido", "necesito ya", "asap",
    ])
    urgency_medium = any(w in message_lower for w in [
        "próximamente", "en breve", "este mes", "planificando", "evaluando",
    ])
    urgency = "alta" if urgency_high else ("media" if urgency_medium else "baja")

    # Extraer palabras clave relevantes (indicadores de calidad del lead)
    keyword_indicators = [
        "automatizar", "optimizar", "integrar", "escalar", "equipo", "agentes",
        "empleados", "clientes", "ventas", "leads", "crm", "erp", "facturación",
        "gestión", "seguimiento", "reportes", "análisis", "ia", "software",
        "plataforma", "api", "presupuesto", "inversión", "proyecto",
    ]
    keywords = [w for w in keyword_indicators if w in message_lower]

    # Evaluar calidad del mensaje
    word_count = len(message.split())
    if word_count < 10:
        quality = "muy_vago"
    elif word_count < 20 and len(keywords) < 2:
        quality = "vago"
    else:
        quality = "claro"

    # Inferir intención principal
    if any(w in message_lower for w in ["automatizar", "automatización"]):
        intention = "Automatización de procesos"
    elif any(w in message_lower for w in ["leads", "captación", "ventas", "clientes"]):
        intention = "Captación y gestión de leads/ventas"
    elif any(w in message_lower for w in ["crm", "gestión", "seguimiento"]):
        intention = "Gestión y seguimiento de clientes"
    elif any(w in message_lower for w in ["integrar", "conectar", "api"]):
        intention = "Integración de sistemas"
    elif quality == "muy_vago":
        intention = "Intención no especificada (mensaje muy corto)"
    else:
        intention = "Consulta general sobre soluciones digitales"

    result = {
        "intention": intention,
        "urgency": urgency,
        "keywords": keywords,
        "message_quality": quality,
        "word_count": word_count,
    }

    logger.info("  → Intención: %s | Urgencia: %s | Calidad: %s", intention, urgency, quality)
    return result


def lookup_company(email: str) -> dict:
    """
    Extrae el dominio del email e infiere información básica de la empresa.
    No hace scraping real — infiere a partir del dominio y patrones conocidos.
    """
    logger.info("🏢 Investigando empresa para email: %s", email)

    domain = email.split("@")[-1].lower()
    is_personal = domain in PERSONAL_EMAIL_DOMAINS

    if is_personal:
        result = {
            "domain": domain,
            "is_personal_email": True,
            "company_name": None,
            "estimated_sector": "Particular / Freelance",
            "estimated_size": "individual",
            "notes": "Email de cuenta personal — tratar como lead individual, no empresa",
        }
        logger.info("  → Email personal detectado (%s)", domain)
        return result

    # Intentar inferir sector por el dominio (heurísticas básicas)
    sector = _infer_sector_from_domain(domain)
    company_name = _domain_to_company_name(domain)

    result = {
        "domain": domain,
        "is_personal_email": False,
        "company_name": company_name,
        "estimated_sector": sector,
        "estimated_size": "desconocido",
        "notes": f"Email corporativo. Dominio: {domain}",
    }

    logger.info("  → Empresa: %s | Sector inferido: %s", company_name, sector)
    return result


def _domain_to_company_name(domain: str) -> str:
    """Convierte el dominio en un nombre de empresa legible."""
    # Quita la extensión (.com, .es, .net, etc.)
    name = domain.split(".")[0]
    return name.capitalize()


def _infer_sector_from_domain(domain: str) -> str:
    """Infiere el sector basándose en palabras en el dominio."""
    domain_lower = domain.lower()
    sector_keywords = {
        "inmobil": "Inmobiliaria",
        "realty": "Inmobiliaria",
        "homes": "Inmobiliaria",
        "clinic": "Salud / Clínica",
        "dental": "Salud / Dental",
        "law": "Legal / Jurídico",
        "legal": "Legal / Jurídico",
        "abogad": "Legal / Jurídico",
        "consult": "Consultoría",
        "tech": "Tecnología",
        "software": "Tecnología / Software",
        "digital": "Marketing Digital",
        "market": "Marketing",
        "hotel": "Hostelería",
        "restaur": "Hostelería",
        "shop": "Comercio / Ecommerce",
        "tienda": "Comercio / Ecommerce",
        "academ": "Educación",
        "school": "Educación",
        "edu": "Educación",
        "gym": "Fitness / Bienestar",
        "fit": "Fitness / Bienestar",
        "farm": "Farmacia / Salud",
        "construct": "Construcción",
        "obra": "Construcción",
    }
    for keyword, sector in sector_keywords.items():
        if keyword in domain_lower:
            return sector
    return "Sector desconocido"


def score_lead(intent_analysis: dict, company_info: dict, message: str) -> dict:
    """
    Calcula la puntuación y clasificación del lead basándose en los análisis previos.
    Lógica determinista y transparente — fácil de ajustar sin cambiar prompts.
    """
    logger.info("📊 Calculando puntuación del lead")

    score = 5  # Base neutra
    reasons = []
    actions = []

    # ── Factor 1: Urgencia ──────────────────
    urgency = intent_analysis.get("urgency", "baja")
    if urgency == "alta":
        score += 2
        reasons.append("urgencia explícita en el mensaje")
        actions.append("Llamar en menos de 2 horas")
    elif urgency == "media":
        score += 1
        reasons.append("cierta urgencia implícita")
        actions.append("Contactar hoy o mañana")
    else:
        actions.append("Responder por email en 24h")

    # ── Factor 2: Email personal vs corporativo ──
    if company_info.get("is_personal_email"):
        score -= 2
        reasons.append("email personal — no empresa identificada")
        actions.append("Verificar si es autónomo o particular")
    else:
        score += 1
        reasons.append(f"email corporativo ({company_info.get('domain', '')})")

    # ── Factor 3: Calidad del mensaje ──────
    quality = intent_analysis.get("message_quality", "vago")
    if quality == "claro":
        score += 1
        reasons.append("mensaje detallado con necesidad clara")
    elif quality == "muy_vago":
        score -= 2
        reasons.append("mensaje muy vago — necesita más contexto")
        actions.append("Pedir más información sobre su necesidad concreta")

    # ── Factor 4: Keywords relevantes ──────
    keyword_count = len(intent_analysis.get("keywords", []))
    if keyword_count >= 4:
        score += 1
        reasons.append(f"{keyword_count} indicadores de madurez en el mensaje")
    elif keyword_count >= 2:
        score += 0  # neutro, sin bonus
    else:
        score -= 1
        reasons.append("pocos indicadores de necesidad específica")

    # Clamp: asegurar rango 1-10
    score = max(1, min(10, score))

    # Clasificación según score
    if score >= 7:
        classification = "CALIENTE"
        if "Enviar propuesta personalizada" not in actions:
            actions.append("Enviar propuesta personalizada")
    elif score >= 4:
        classification = "TIBIO"
        actions.append("Enviar caso de uso relevante para su sector")
    else:
        classification = "FRÍO"
        actions.append("Añadir a secuencia de nurturing por email")

    # Construir razonamiento legible
    reasoning = "; ".join(reasons) if reasons else "Evaluación estándar sin factores destacados"

    result = {
        "score": score,
        "classification": classification,
        "reasoning": reasoning,
        "recommended_actions": list(dict.fromkeys(actions)),  # eliminar duplicados
    }

    logger.info("  → Score: %d/10 | Clasificación: %s", score, classification)
    return result


def generate_email(
    lead_data: dict,
    score: int,
    classification: str,
    company_info: dict,
    reasoning: str,
) -> str:
    """
    Genera el email de respuesta.
    La generación real del texto la hace Claude en el agentic loop —
    aquí definimos la estructura para que Claude sepa qué construir.
    Devuelve el texto completo del email.
    """
    # Esta función es invocada por Claude para que él mismo genere el email.
    # El texto real lo escribe Claude en su respuesta al tool_use.
    # Aquí devolvemos un placeholder que Claude sustituirá.
    # (Ver agent.py — cuando Claude llama generate_email, el resultado
    #  se sobreescribe con el texto que Claude genere internamente.)
    logger.info(
        "✉️  Generando email para %s (score %d, %s)",
        lead_data.get("name"), score, classification
    )
    # Plantilla base que Claude usará como contexto para generar
    name = lead_data.get("name", "").split()[0]  # solo el nombre
    company = company_info.get("company_name") or company_info.get("domain", "tu empresa")

    placeholder = (
        f"[EMAIL PENDIENTE DE GENERACIÓN]\n"
        f"Destinatario: {name}\n"
        f"Empresa: {company}\n"
        f"Clasificación: {classification} ({score}/10)\n"
        f"Contexto: {reasoning}"
    )
    return placeholder


def save_to_db(
    lead_id: str,
    lead_data: dict,
    classification: str,
    score: int,
    reasoning: str,
    generated_email: str,
    recommended_actions: list,
    intent_analysis: dict,
    company_info: dict,
    tenant_id: str = "legacy",
) -> dict:
    """
    Guarda el lead completo en la base de datos.
    tenant_id se inyecta desde execute_tool — Claude no lo ve ni lo controla.
    """
    logger.info("💾 Guardando lead %s en base de datos (tenant: %s)", lead_id, tenant_id)

    from database import save_lead

    save_lead(
        lead_id=lead_id,
        tenant_id=tenant_id,
        name=lead_data.get("name", ""),
        email=lead_data.get("email", ""),
        phone=lead_data.get("phone"),
        message=lead_data.get("message", ""),
        classification=classification,
        score=score,
        reasoning=reasoning,
        generated_email=generated_email,
        recommended_actions=recommended_actions,
        intent_analysis=intent_analysis,
        company_info=company_info,
    )

    return {"success": True, "lead_id": lead_id, "saved_at": "utcnow"}


# ─────────────────────────────────────────────
# Dispatcher: ejecuta la tool por nombre
# ─────────────────────────────────────────────

def execute_tool(tool_name: str, tool_input: dict, tenant_id: str = "legacy") -> Any:
    """
    Recibe el nombre de la tool y sus argumentos y ejecuta la función correspondiente.
    tenant_id se pasa internamente a save_to_db para el aislamiento multi-tenant.
    """
    logger.info("⚙️  Ejecutando tool: %s", tool_name)

    if tool_name == "analyze_intent":
        return analyze_intent(**tool_input)

    elif tool_name == "lookup_company":
        return lookup_company(**tool_input)

    elif tool_name == "score_lead":
        return score_lead(**tool_input)

    elif tool_name == "generate_email":
        return generate_email(**tool_input)

    elif tool_name == "save_to_db":
        # Inyectamos tenant_id aquí — Claude no lo controla, solo el backend lo decide
        return save_to_db(**tool_input, tenant_id=tenant_id)

    else:
        raise ValueError(f"Tool desconocida: {tool_name}")
