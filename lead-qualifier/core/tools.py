"""
Pipeline determinista de cualificación de leads inmobiliarios.

Funciones: analyze_intent, lookup_company, score_lead.
La redacción del email se hace en agent.py con una única llamada a Claude.
"""

import logging
import re
import unicodedata

logger = logging.getLogger(__name__)

# Dominios de email personal más comunes — en vivienda son LO NORMAL (no penalizan)
PERSONAL_EMAIL_DOMAINS = {
    "gmail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es",
    "yahoo.com", "yahoo.es", "icloud.com", "me.com", "live.com",
    "protonmail.com", "proton.me", "tutanota.com", "msn.com", "telefonica.net",
    "terra.es", "ya.com", "wanadoo.es",
}

# Pistas en el dominio de que el contacto es un profesional/inversor del sector
SECTOR_DOMAIN_HINTS = (
    "inmobil", "inmo", "realty", "realestate", "homes", "house", "fincas",
    "propert", "estate", "invers", "invest", "capital", "patrimon", "promot",
    "construc", "habitat", "vivienda", "haus", "casa",
)


# ─────────────────────────────────────────────
# Normalización de texto (acentos, mayúsculas)
# ─────────────────────────────────────────────

def _normalizar(texto: str) -> str:
    """Pasa a minúsculas y elimina acentos para comparar palabras clave."""
    sin_acentos = "".join(
        c for c in unicodedata.normalize("NFD", texto.lower())
        if unicodedata.category(c) != "Mn"
    )
    return sin_acentos



# ─────────────────────────────────────────────
# Implementaciones Python de cada tool
# ─────────────────────────────────────────────

# ─────────────────────────────────────────────
# Detectores de señales inmobiliarias
# ─────────────────────────────────────────────

def _detectar_operacion(msg: str) -> str:
    """Identifica la operación: VENTA, COMPRA, ALQUILER, INVERSION, TASACION o INFORMACION."""
    # El orden importa: vender y tasar tienen prioridad (aportan inventario a la agencia)
    if any(w in msg for w in ("quiero vender", "vender mi", "vender mi piso", "vender mi casa",
                              "poner a la venta", "pongo a la venta", "deshacerme", "traspasar mi")):
        return "VENTA"
    if any(w in msg for w in ("tasar", "tasacion", "valorar mi", "valoracion de mi",
                              "cuanto vale mi", "cuanto valdria", "precio de mi")):
        return "TASACION"
    if any(w in msg for w in ("invertir", "inversion", "rentabilidad", "para alquilar despues",
                              "como inversion", "cartera", "varios inmuebles", "rentar")):
        return "INVERSION"
    if any(w in msg for w in ("alquilar", "alquiler", "arrendar", "de renta", "en renta",
                              "mensualidad", "al mes")):
        # "alquilar mi piso" sería poner en alquiler (también inventario), pero lo agrupamos en ALQUILER
        return "ALQUILER"
    # Compra directa
    if any(w in msg for w in ("comprar", "compra", "adquirir", "adquisicion")):
        return "COMPRA"
    # Verbo de búsqueda + mención de un inmueble → intención de compra
    verbos_busqueda = (
        "busco", "buscando", "busca ", "quiero", "necesito", "me gustaria",
        "me interesa", "nos interesa", "estoy buscando", "estamos buscando",
    )
    inmueble_kw = (
        "piso", "casa", "atico", "duplex", "chalet", "chale", "adosado", "pareado",
        "estudio", "loft", "apartamento", "villa", "local", "nave", "oficina",
        "terreno", "parcela", "solar", "garaje", "trastero", "finca", "vivienda",
        "inmueble", "propiedad",
    )
    if any(v in msg for v in verbos_busqueda) and any(re.search(rf"\b{k}", msg) for k in inmueble_kw):
        return "COMPRA"
    return "INFORMACION"


def _detectar_tipo_inmueble(msg: str) -> str | None:
    """Detecta el tipo de inmueble mencionado."""
    tipos = {
        "atico": "ático", "duplex": "dúplex", "chalet": "chalet", "chale": "chalet",
        "adosado": "adosado", "pareado": "pareado", "estudio": "estudio",
        "loft": "loft", "piso": "piso", "apartamento": "apartamento", "casa": "casa",
        "villa": "villa", "local": "local comercial", "nave": "nave industrial",
        "oficina": "oficina", "terreno": "terreno", "parcela": "parcela",
        "solar": "solar", "garaje": "garaje", "trastero": "trastero",
        "finca": "finca", "masia": "masía", "cortijo": "cortijo",
    }
    for clave, etiqueta in tipos.items():
        if re.search(rf"\b{clave}s?\b", msg):
            return etiqueta
    return None


def _detectar_presupuesto(message: str) -> dict | None:
    """
    Extrae un presupuesto / precio en euros del mensaje original (con mayúsculas y acentos).
    Reconoce: 300.000€, 300000 euros, 300k, 1,2 millones, 450 mil, hasta 250.000…
    Devuelve {'valor': int|None, 'texto': str} o None si no encuentra nada.
    """
    texto = message.replace(" ", " ")
    low = _normalizar(texto)

    # 1) Millones: "1,2 millones", "2 millones", "un millon"
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*millon", low)
    if m:
        num = float(m.group(1).replace(".", "").replace(",", "."))
        return {"valor": int(num * 1_000_000), "texto": m.group(0).strip()}
    if re.search(r"\bun millon\b", low):
        return {"valor": 1_000_000, "texto": "un millón"}

    # 2) "450 mil", "450mil"
    m = re.search(r"(\d{1,4})\s*mil\b", low)
    if m:
        return {"valor": int(m.group(1)) * 1_000, "texto": m.group(0).strip()}

    # 3) "300k", "300 k"
    m = re.search(r"(\d{2,4})\s*k\b", low)
    if m:
        return {"valor": int(m.group(1)) * 1_000, "texto": m.group(0).strip()}

    # 4) Cifra con € o "euros": 300.000€, 300000 euros, 250,000 eur
    m = re.search(r"(\d[\d.\s,]{2,})\s*(?:€|eur|euros)", low)
    if not m:
        # 5) Cifra grande "pegada" a símbolo €: €300000
        m = re.search(r"(?:€|eur|euros)\s*(\d[\d.\s,]{2,})", low)
    if m:
        crudo = re.sub(r"[.\s,]", "", m.group(1))
        if crudo.isdigit():
            valor = int(crudo)
            if valor >= 10_000:  # filtrar cifras absurdas (m², años…)
                return {"valor": valor, "texto": m.group(0).strip()}

    return None


def _detectar_financiacion(msg: str) -> str:
    """Detecta el estado de financiación: contado, hipoteca_aprobada, necesita o desconocido."""
    if any(w in msg for w in ("al contado", "pago al contado", "sin hipoteca",
                              "no necesito financiacion", "dispongo del", "tengo el dinero",
                              "liquidez", "en efectivo")):
        return "contado"
    if any(w in msg for w in ("hipoteca aprobada", "hipoteca preaprobada", "hipoteca concedida",
                              "financiacion aprobada", "preaprobada", "banco me ha concedido",
                              "tengo la hipoteca")):
        return "hipoteca_aprobada"
    if any(w in msg for w in ("necesito hipoteca", "necesito financiacion", "pedir hipoteca",
                              "solicitar hipoteca", "me podeis financiar", "necesitaria financiacion",
                              "opciones de financiacion")):
        return "necesita"
    return "desconocido"


# Topónimos frecuentes (no exhaustivo, solo señal de zona concreta)
TOPONIMOS = (
    "madrid", "barcelona", "valencia", "sevilla", "malaga", "bilbao", "zaragoza",
    "alicante", "murcia", "palma", "vigo", "gijon", "marbella", "granada", "cordoba",
    "valladolid", "santander", "donostia", "san sebastian", "pamplona", "logrono",
    "salamanca", "leon", "burgos", "albacete", "tarragona", "girona", "lleida",
    "getafe", "alcala", "mostoles", "fuenlabrada", "pozuelo", "majadahonda",
    "hospitalet", "badalona", "sabadell", "terrassa", "cornella",
)


def _detectar_zona(message: str, msg_norm: str) -> bool:
    """
    ¿El contacto especifica una zona/ubicación concreta?
    Evita falsos positivos: la mera palabra "zona" o "barrio" no cuenta;
    exige un topónimo conocido, un área reconocible o un nombre propio tras preposición.
    """
    # 1) Topónimo conocido
    if any(t in msg_norm for t in TOPONIMOS):
        return True
    # 2) Áreas reconocibles por sí mismas
    if any(w in msg_norm for w in ("centro", "casco antiguo", "casco historico", "ensanche")):
        return True
    # 3) Preposición/locución de lugar seguida de un nombre propio (Capitalizado) en el original
    patron = (
        r"\b(?:en|por|cerca de|junto a|zona de|zona del|barrio de|barrio del|"
        r"distrito de|distrito del|en la calle|calle|avenida)\s+"
        r"(?:el\s+|la\s+|los\s+|las\s+|del\s+|de la\s+)?"
        r"[A-ZÁÉÍÓÚÑ][\wáéíóúñ]{2,}"
    )
    return bool(re.search(patron, message))


def _detectar_habitaciones(msg: str) -> int | None:
    """Detecta nº de habitaciones/dormitorios mencionados."""
    m = re.search(r"(\d+)\s*(?:hab|habitacion|habitaciones|dormitor|cuarto)", msg)
    if m:
        return int(m.group(1))
    palabras = {"una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5}
    for palabra, num in palabras.items():
        if re.search(rf"\b{palabra}\s+(?:hab|habitacion|dormitor)", msg):
            return num
    return None


def analyze_intent(message: str, name: str) -> dict:
    """
    Analiza el mensaje del contacto inmobiliario y extrae todas las señales relevantes
    para cualificarlo: operación, tipo de inmueble, zona, presupuesto, plazo y financiación.
    Determinista y rápido (sin llamadas extra a Claude).
    """
    logger.info("🔍 Analizando intención inmobiliaria del mensaje de %s", name)

    msg = _normalizar(message)

    # ── Operación e inmueble ──
    operacion       = _detectar_operacion(msg)
    tipo_inmueble   = _detectar_tipo_inmueble(msg)
    presupuesto     = _detectar_presupuesto(message)
    financiacion    = _detectar_financiacion(msg)
    tiene_zona      = _detectar_zona(message, msg)
    habitaciones    = _detectar_habitaciones(msg)

    # ── Urgencia / plazo ──
    urgency_high = any(w in msg for w in (
        "urgente", "urgencia", "inmediatamente", "cuanto antes", "lo antes posible",
        "esta semana", "hoy", "ya mismo", "rapido", "con prisa", "me mudo",
        "antes de fin de mes", "esta misma semana", "asap",
    ))
    urgency_medium = any(w in msg for w in (
        "proximamente", "en breve", "este mes", "proximos meses", "este ano",
        "estoy mirando", "estamos mirando", "valorando", "planeando", "pensando en",
    ))
    urgency = "alta" if urgency_high else ("media" if urgency_medium else "baja")

    # ── Palabras clave inmobiliarias (señal de concreción) ──
    keyword_indicators = [
        "comprar", "vender", "alquilar", "invertir", "hipoteca", "contado",
        "presupuesto", "financiacion", "visita", "ver el", "reforma", "obra nueva",
        "segunda mano", "exterior", "ascensor", "terraza", "garaje", "metros",
        "m2", "habitaciones", "dormitorios", "zona", "barrio", "tasar", "valorar",
    ]
    keywords = [w for w in keyword_indicators if w in msg]

    # ── Calidad del mensaje ──
    word_count = len(message.split())
    señales_clave = sum([
        operacion != "INFORMACION",
        tipo_inmueble is not None,
        presupuesto is not None,
        tiene_zona,
        habitaciones is not None,
    ])
    if word_count < 8 and señales_clave == 0:
        quality = "muy_vago"
    elif señales_clave <= 1 and word_count < 25:
        quality = "vago"
    else:
        quality = "claro"

    # Vaguedad explícita: el contacto está indeciso ("un poco de todo", "lo que sea"…),
    # aunque haya marcado operación o presupuesto. No es un lead caliente todavía.
    VAGAS = (
        "un poco de todo", "de todo un poco", "lo que sea", "cualquier cosa",
        "me da igual", "no lo tengo claro", "no tengo claro", "todavia no lo se",
        "aun no lo se", "aun no lo tengo claro", "estoy abierto", "sin preferencia",
        "indiferente", "lo que haya", "no se que quiero", "no se muy bien",
        "varias opciones", "abierto a opciones",
    )
    if any(v in msg for v in VAGAS):
        quality = "muy_vago"

    # Texto de relleno / pruebas ("prueba", "test", "asdf"…): aunque el
    # formulario guiado haya añadido operación y presupuesto, el mensaje libre
    # no aporta nada real → no puede puntuar como un encargo claro.
    if len(message.split()) < 20 and re.search(
        r"\b(prueba|pruebas|testing|test|asdf\w*|qwerty|lorem|xxx+|aaa+)\b", msg
    ):
        quality = "muy_vago"

    # ── Etiqueta legible de la intención ──
    etiquetas_op = {
        "VENTA":       "Quiere vender su inmueble",
        "TASACION":    "Solicita tasación/valoración de su inmueble",
        "COMPRA":      "Busca comprar un inmueble",
        "ALQUILER":    "Busca alquiler",
        "INVERSION":   "Interés en inversión inmobiliaria",
        "INFORMACION": "Consulta general sin operación definida",
    }
    intention = etiquetas_op.get(operacion, "Consulta inmobiliaria")
    if tipo_inmueble and operacion in ("COMPRA", "ALQUILER", "INVERSION"):
        intention += f" ({tipo_inmueble})"

    result = {
        "intention":        intention,
        "operation":        operacion,
        "property_type":    tipo_inmueble,
        "has_zone":         tiene_zona,
        "rooms":            habitaciones,
        "budget":           presupuesto["valor"] if presupuesto else None,
        "budget_text":      presupuesto["texto"] if presupuesto else None,
        "financing":        financiacion,
        "urgency":          urgency,
        "keywords":         keywords,
        "message_quality":  quality,
        "word_count":       word_count,
    }

    logger.info(
        "  → Op: %s | Inmueble: %s | Presupuesto: %s | Financiación: %s | Urgencia: %s | Calidad: %s",
        operacion, tipo_inmueble, result["budget"], financiacion, urgency, quality,
    )
    return result


def lookup_company(email: str) -> dict:
    """
    Infiere el PERFIL del contacto a partir del email.
    En vivienda, el correo personal es lo normal: NUNCA penaliza.
    Un correo corporativo del sector puede señalar un inversor o profesional (mayor valor).
    """
    logger.info("👤 Analizando perfil del contacto: %s", email)

    domain = email.split("@")[-1].lower() if "@" in email else ""
    is_personal = domain in PERSONAL_EMAIL_DOMAINS
    es_sector = any(h in domain for h in SECTOR_DOMAIN_HINTS)

    if is_personal:
        result = {
            "domain": domain,
            "is_personal_email": True,
            "profile": "particular",
            "company_name": None,
            "notes": "Correo personal — perfil particular, lo habitual en vivienda. No penaliza.",
        }
        logger.info("  → Perfil: particular (%s)", domain)
        return result

    company_name = domain.split(".")[0].capitalize() if domain else None

    if es_sector:
        profile = "profesional_inmobiliario"
        notes = f"Correo corporativo del sector ({domain}) — posible inversor o profesional. Alto valor recurrente."
    else:
        profile = "empresa"
        notes = f"Correo corporativo ({domain}) — empresa u organización. Posible inversor o empleado buscando vivienda."

    result = {
        "domain": domain,
        "is_personal_email": False,
        "profile": profile,
        "company_name": company_name,
        "notes": notes,
    }

    logger.info("  → Perfil: %s (%s)", profile, domain)
    return result


def score_lead(intent_analysis: dict, company_info: dict) -> dict:
    """
    Puntúa y clasifica el lead inmobiliario.
    Rúbrica determinista pensada para el mercado español de vivienda:
    premia intención de transacción, presupuesto, financiación resuelta, plazo y concreción.
    """
    logger.info("📊 Calculando puntuación del lead inmobiliario")

    score = 5.0
    reasons = []
    actions = []

    operation    = intent_analysis.get("operation", "INFORMACION")
    quality      = intent_analysis.get("message_quality", "vago")
    urgency      = intent_analysis.get("urgency", "baja")
    budget       = intent_analysis.get("budget")
    financing    = intent_analysis.get("financing", "desconocido")
    has_zone     = intent_analysis.get("has_zone", False)
    rooms        = intent_analysis.get("rooms")
    prop_type    = intent_analysis.get("property_type")

    # ── Factor 1: Operación (lo que más pesa) ──
    # Vendedores e inversores son intrínsecamente valiosos (inventario / recurrencia).
    if operation in ("VENTA", "TASACION"):
        score += 3
        reasons.append("quiere vender/tasar su inmueble (aporta inventario a la agencia)")
        actions.append("Ofrecer valoración gratuita y agendar visita para tasar el inmueble")
    elif operation == "INVERSION":
        score += 2.5
        reasons.append("perfil inversor (operaciones recurrentes y de mayor importe)")
        actions.append("Enviar oportunidades con rentabilidad estimada")
    elif operation == "COMPRA":
        score += 1.5
        reasons.append("intención de compra")
        actions.append("Preparar selección de inmuebles que encajen con su búsqueda")
    elif operation == "ALQUILER":
        score += 1
        reasons.append("interés en alquiler")
        actions.append("Enviar disponibilidad de alquiler en su zona")
    else:
        score -= 1
        reasons.append("operación no definida en el mensaje")
        actions.append("Llamar para identificar qué busca exactamente")

    # ── Factor 2: Presupuesto explícito (señal fuerte de seriedad) ──
    if budget:
        score += 2
        reasons.append(f"presupuesto definido (~{budget:,} €)".replace(",", "."))
    elif operation in ("COMPRA", "INVERSION"):
        actions.append("Confirmar presupuesto disponible")

    # ── Factor 3: Financiación resuelta (señal fuerte de capacidad) ──
    if financing == "contado":
        score += 2
        reasons.append("compra al contado (máxima capacidad y rapidez de cierre)")
    elif financing == "hipoteca_aprobada":
        score += 2
        reasons.append("hipoteca ya aprobada (listo para cerrar)")
    elif financing == "necesita":
        score += 0.5
        reasons.append("necesita financiación")
        actions.append("Ofrecer ayuda con la financiación / contacto con su banco")

    # ── Factor 4: Concreción del encargo ──
    # El tipo de inmueble apenas pesa (casi todos lo mencionan); zona y habitaciones sí.
    concrecion = 0.0
    if has_zone:           concrecion += 1.0
    if rooms is not None:  concrecion += 0.5
    if prop_type:          concrecion += 0.5
    if concrecion:
        score += concrecion
        if has_zone and rooms is not None:
            reasons.append("encargo concreto (zona y nº de habitaciones)")

    # ── Factor 5: Urgencia / plazo ──
    if urgency == "alta":
        score += 1.5
        reasons.append("plazo corto / urgencia explícita")
        actions.insert(0, "Llamar HOY: el lead quiere avanzar de inmediato")
    elif urgency == "media":
        score += 0.5
        reasons.append("plazo a medio plazo")

    # ── Factor 6: Calidad del mensaje ──
    if quality == "muy_vago":
        score -= 2
        reasons.append("mensaje muy vago — falta contexto")
        actions.append("Hacer 1-2 preguntas concretas (zona, presupuesto, plazo)")
    elif quality == "vago":
        score -= 0.5

    # ── Factor 7: Perfil del contacto (el correo personal NUNCA penaliza) ──
    if company_info.get("profile") == "profesional_inmobiliario":
        score += 0.5
        reasons.append("perfil profesional/inversor del sector")

    # Redondear y acotar 1-10
    score = int(round(max(1.0, min(10.0, score))))

    # ── Regla de capacidad (readiness) ──
    # Un comprador/inquilino solo es CALIENTE si demuestra capacidad real:
    # presupuesto, financiación resuelta o urgencia explícita. Si no, es un buen
    # lead que hay que cualificar primero (TIBIO), no se marca como caliente.
    readiness = bool(budget) or financing in ("contado", "hipoteca_aprobada") or urgency == "alta"
    if operation in ("COMPRA", "ALQUILER") and not readiness and score > 7:
        score = 7
        reasons.append("falta confirmar capacidad (presupuesto/financiación/plazo) antes de priorizar")
        actions.append("Cualificar capacidad de compra antes de dedicar visitas")

    # ── Regla de concreción del encargo ──
    # Tener presupuesto (p. ej. elegido en un desplegable del formulario) no
    # basta para CALIENTE si no se sabe QUÉ busca: sin zona, tipo de inmueble
    # ni habitaciones, primero hay que concretar el encargo.
    concreto = has_zone or (rooms is not None) or bool(prop_type)
    if operation in ("COMPRA", "ALQUILER") and not concreto and score > 7:
        score = 7
        reasons.append("sin detalles del inmueble buscado (zona/tipo/habitaciones) — confirmar el encargo")
        actions.append("Concretar zona y tipo de inmueble antes de priorizar")

    # ── Clasificación ──
    if score >= 8:
        classification = "CALIENTE"
    elif score >= 5:
        classification = "TIBIO"
    else:
        classification = "FRÍO"

    # Acción de cierre según clasificación
    if classification == "CALIENTE":
        actions.append("Priorizar: contactar en menos de 1 hora")
    elif classification == "TIBIO":
        actions.append("Hacer seguimiento esta semana con opciones concretas")
    else:
        actions.append("Incluir en seguimiento periódico (newsletter de novedades)")

    reasoning = "; ".join(reasons) if reasons else "Evaluación estándar sin factores destacados"

    result = {
        "score": score,
        "classification": classification,
        "reasoning": reasoning,
        "recommended_actions": list(dict.fromkeys(actions))[:5],  # sin duplicados, máx 5
    }

    logger.info("  → Score: %d/10 | Clasificación: %s", score, classification)
    return result


