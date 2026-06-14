"""
Tests del pipeline determinista de cualificación ([core/tools.py]).

Son rápidos y NO gastan API: cubren la extracción de señales (operación,
presupuesto, financiación, zona, habitaciones, calidad) y la rúbrica de
`score_lead`, que es el corazón del producto y lo que más se retoca.

Solo importan `core.tools` (stdlib pura), así que no necesitan fastapi,
anthropic ni base de datos.
"""

import pytest

from core.tools import analyze_intent, lookup_company, score_lead


# ─────────────────────────────────────────────
# Detección de operación
# ─────────────────────────────────────────────

@pytest.mark.parametrize("mensaje, esperado", [
    ("Quiero vender mi piso en Madrid, está en buen estado.", "VENTA"),
    ("Me gustaría tasar mi vivienda, ¿cuánto vale mi casa?",  "TASACION"),
    ("Quiero invertir en varios inmuebles por rentabilidad.", "INVERSION"),
    ("Quiero alquilar un apartamento céntrico.",              "ALQUILER"),
    ("Quiero comprar un piso de obra nueva.",                 "COMPRA"),
    ("Busco un piso de 2 habitaciones en Valencia.",          "COMPRA"),
    ("Hola, ¿me podéis dar información sobre vuestros servicios?", "INFORMACION"),
])
def test_deteccion_operacion(mensaje, esperado):
    assert analyze_intent(mensaje, "Test")["operation"] == esperado


# La venta tiene prioridad sobre la compra cuando aparecen ambas señales.
def test_venta_tiene_prioridad_sobre_compra():
    intent = analyze_intent("Quiero vender mi casa para comprar un piso más grande.", "Test")
    assert intent["operation"] == "VENTA"


# ─────────────────────────────────────────────
# Detección de presupuesto
# ─────────────────────────────────────────────

@pytest.mark.parametrize("mensaje, valor", [
    ("Tengo un presupuesto de 300.000 €.",        300_000),
    ("Mi tope son 300000 euros.",                 300_000),
    ("Dispongo de unos 450 mil.",                 450_000),
    ("Puedo llegar a 300k.",                      300_000),
    ("Mi presupuesto es de 1,2 millones.",        1_200_000),
    ("Tengo cerca de un millón para invertir.",   1_000_000),
])
def test_deteccion_presupuesto(mensaje, valor):
    assert analyze_intent(mensaje, "Test")["budget"] == valor


def test_sin_presupuesto_devuelve_none():
    assert analyze_intent("Busco un piso en Madrid.", "Test")["budget"] is None


def test_presupuesto_absurdo_se_descarta():
    # Cifras por debajo de 10.000 € se filtran (suelen ser m², años, etc.)
    assert analyze_intent("Tengo 5.000 € ahorrados de momento.", "Test")["budget"] is None


# ─────────────────────────────────────────────
# Detección de financiación
# ─────────────────────────────────────────────

@pytest.mark.parametrize("mensaje, esperado", [
    ("Pago al contado, tengo el dinero.",          "contado"),
    ("Tengo la hipoteca preaprobada por el banco.", "hipoteca_aprobada"),
    ("Necesito financiación para la compra.",       "necesita"),
    ("Busco un piso de tres habitaciones.",         "desconocido"),
])
def test_deteccion_financiacion(mensaje, esperado):
    assert analyze_intent(mensaje, "Test")["financing"] == esperado


# ─────────────────────────────────────────────
# Detección de zona, habitaciones y urgencia
# ─────────────────────────────────────────────

def test_zona_por_toponimo():
    assert analyze_intent("Busco piso en Sevilla.", "Test")["has_zone"] is True


def test_zona_por_nombre_propio_tras_preposicion():
    # "cerca de Chamberí" — Chamberí no es topónimo conocido, pero el patrón lo capta.
    assert analyze_intent("Quiero un piso cerca de Chamberí.", "Test")["has_zone"] is True


def test_sin_zona():
    assert analyze_intent("Busco un piso luminoso.", "Test")["has_zone"] is False


@pytest.mark.parametrize("mensaje, rooms", [
    ("Busco un piso de 3 habitaciones.", 3),
    ("Quiero algo de tres dormitorios.", 3),
    ("Busco un piso luminoso.",          None),
])
def test_deteccion_habitaciones(mensaje, rooms):
    assert analyze_intent(mensaje, "Test")["rooms"] == rooms


@pytest.mark.parametrize("mensaje, urgencia", [
    ("Necesito mudarme lo antes posible.", "alta"),
    ("Estamos mirando opciones tranquilamente.", "media"),
    ("Busco un piso en Madrid.", "baja"),
])
def test_deteccion_urgencia(mensaje, urgencia):
    assert analyze_intent(mensaje, "Test")["urgency"] == urgencia


# ─────────────────────────────────────────────
# Calidad del mensaje y vaguedad explícita
# ─────────────────────────────────────────────

def test_mensaje_corto_es_muy_vago():
    assert analyze_intent("Hola info", "Test")["message_quality"] == "muy_vago"


def test_vaguedad_explicita_marca_muy_vago_aunque_haya_operacion():
    # Tiene operación (comprar) pero el contacto está indeciso → no es caliente.
    intent = analyze_intent(
        "Quiero comprar un piso pero no lo tengo claro, un poco de todo.", "Test"
    )
    assert intent["operation"] == "COMPRA"
    assert intent["message_quality"] == "muy_vago"


# ─────────────────────────────────────────────
# Perfil del contacto (lookup_company)
# ─────────────────────────────────────────────

def test_email_personal_es_particular():
    perfil = lookup_company("maria.garcia@gmail.com")
    assert perfil["is_personal_email"] is True
    assert perfil["profile"] == "particular"


def test_email_del_sector_es_profesional():
    perfil = lookup_company("info@inmobiliariasol.com")
    assert perfil["is_personal_email"] is False
    assert perfil["profile"] == "profesional_inmobiliario"


def test_email_corporativo_generico_es_empresa():
    perfil = lookup_company("juan@acme.com")
    assert perfil["profile"] == "empresa"
    assert perfil["company_name"] == "Acme"


# ─────────────────────────────────────────────
# score_lead — clasificación end to end
# ─────────────────────────────────────────────

def _score(mensaje: str, email: str = "lead@gmail.com") -> dict:
    """Atajo: analiza + perfila + puntúa, como hace el agente real."""
    intent = analyze_intent(mensaje, "Test")
    company = lookup_company(email)
    return score_lead(intent, company)


def test_comprador_listo_es_caliente():
    # Presupuesto + hipoteca aprobada + zona + habitaciones + urgencia → tope.
    res = _score(
        "Busco un piso de 3 habitaciones en el Eixample, Barcelona. "
        "Tengo la hipoteca preaprobada y un presupuesto de hasta 480.000 €. "
        "Quiero visitar opciones esta misma semana."
    )
    assert res["classification"] == "CALIENTE"
    assert res["score"] == 10


def test_vendedor_es_caliente():
    # Los vendedores aportan inventario: se priorizan.
    res = _score("Quiero vender mi piso en Madrid, está en muy buen estado.")
    assert res["classification"] == "CALIENTE"
    assert res["score"] >= 8


def test_comprador_sin_capacidad_se_capa_a_tibio():
    # Buen encargo (zona + habitaciones) pero sin presupuesto, financiación ni
    # urgencia: la regla de readiness lo limita a 7 (TIBIO), no caliente.
    res = _score("Busco un piso de 2 habitaciones en Valencia.")
    assert res["classification"] == "TIBIO"
    assert res["score"] == 7


def test_contado_da_capacidad_y_permite_caliente():
    # El mismo perfil pero pagando al contado sí demuestra capacidad → caliente.
    res = _score("Quiero comprar un piso al contado en Sevilla.")
    assert res["classification"] == "CALIENTE"


def test_consulta_vaga_es_frio():
    res = _score("Hola, quería información.")
    assert res["classification"] == "FRÍO"
    assert res["score"] <= 4


def test_inversor_se_valora_alto():
    res = _score("Quiero invertir en pisos para alquilar después, busco rentabilidad.")
    assert res["classification"] == "CALIENTE"


# ─────────────────────────────────────────────
# Invariantes de score_lead (propiedades que deben cumplirse SIEMPRE)
# ─────────────────────────────────────────────

MENSAJES_VARIADOS = [
    "Hola",
    "Quiero comprar un piso.",
    "Vendo mi casa en Madrid con hipoteca pendiente.",
    "Busco invertir 2 millones en varios inmuebles.",
    "Necesito alquilar urgente un estudio en Bilbao.",
    "No lo tengo claro, un poco de todo.",
]


@pytest.mark.parametrize("mensaje", MENSAJES_VARIADOS)
def test_invariantes_score(mensaje):
    res = _score(mensaje)
    # Score siempre entero en el rango 1..10
    assert isinstance(res["score"], int)
    assert 1 <= res["score"] <= 10
    # Clasificación válida y coherente con el score
    assert res["classification"] in {"CALIENTE", "TIBIO", "FRÍO"}
    if res["score"] >= 8:
        assert res["classification"] == "CALIENTE"
    elif res["score"] >= 5:
        assert res["classification"] == "TIBIO"
    else:
        assert res["classification"] == "FRÍO"
    # Acciones recomendadas: no vacías, sin duplicados, máximo 5
    acciones = res["recommended_actions"]
    assert 1 <= len(acciones) <= 5
    assert len(acciones) == len(set(acciones))
    # Razonamiento siempre presente
    assert isinstance(res["reasoning"], str) and res["reasoning"]
