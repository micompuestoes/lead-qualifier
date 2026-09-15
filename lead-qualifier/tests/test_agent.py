"""
Tests de core/agent.py: la extracción de señales + redacción del email vía
Claude (_extraer_y_redactar) y su respaldo determinista cuando la IA falla.

No se llama nunca a la API real de Anthropic: se usan dobles de prueba que
imitan la forma de anthropic.types.Message (bloque tool_use con .input, y
.usage con input_tokens/output_tokens).
"""

from types import SimpleNamespace

from core.agent import _extraer_y_redactar, CUALIFICAR_TOOL
from core.tools import score_lead, lookup_company


class _FakeToolUseBlock:
    def __init__(self, input_dict):
        self.type = "tool_use"
        self.input = input_dict


class _FakeTextBlock:
    def __init__(self, text):
        self.type = "text"
        self.text = text


class _FakeMessages:
    def __init__(self, respuesta=None, excepcion=None):
        self._respuesta = respuesta
        self._excepcion = excepcion

    def create(self, **kwargs):
        if self._excepcion is not None:
            raise self._excepcion
        return self._respuesta


class _FakeClient:
    def __init__(self, respuesta=None, excepcion=None):
        self.messages = _FakeMessages(respuesta, excepcion)


def _respuesta_con_tool_use(datos: dict, input_tokens=120, output_tokens=80):
    return SimpleNamespace(
        content=[_FakeToolUseBlock(datos)],
        usage=SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens),
    )


DATOS_OK = {
    "operation": "COMPRA",
    "property_type": "piso",
    "has_zone": True,
    "rooms": 3,
    "budget": 250_000,
    "financing": "necesita",
    "urgency": "baja",
    "urgency_explicit_low": True,
    "message_quality": "claro",
    "email": "Hola Ana,\n\nGracias por tu mensaje...\n\nUn saludo,\nla agencia",
}


def _llamar(client, brand_voice=None):
    return _extraer_y_redactar(
        client, "Ana García", "Ana", "la agencia", "ana@example.com",
        "Busco piso de 3 habitaciones. No tengo el dinero, necesito pedir una hipoteca. "
        "No es urgente, tengo tiempo de sobra.",
        brand_voice=brand_voice,
    )


def test_extraccion_exitosa_mapea_los_campos_para_score_lead():
    client = _FakeClient(respuesta=_respuesta_con_tool_use(DATOS_OK))
    resultado = _llamar(client)

    assert resultado is not None
    intent = resultado["intent"]
    assert intent["operation"] == "COMPRA"
    assert intent["property_type"] == "piso"
    assert intent["has_zone"] is True
    assert intent["rooms"] == 3
    assert intent["budget"] == 250_000
    assert intent["financing"] == "necesita"
    assert intent["urgency"] == "baja"
    assert intent["urgency_explicit_low"] is True
    assert intent["message_quality"] == "claro"
    assert resultado["email_text"] == "Hola Ana,\n\nGracias por tu mensaje...\n\nUn saludo,\nla agencia"
    assert resultado["input_tokens"] == 120
    assert resultado["output_tokens"] == 80

    # El dict resultante debe ser directamente compatible con score_lead —
    # es la garantía de que cambiar el extractor no rompe la puntuación.
    scoring = score_lead(intent, lookup_company("ana@example.com"))
    assert scoring["classification"] in ("CALIENTE", "TIBIO", "FRÍO")
    # Con financiación pendiente y sin prisa explícita, nunca debería ser CALIENTE.
    assert scoring["classification"] != "CALIENTE"


def test_email_envuelto_en_comillas_o_markdown_se_limpia():
    datos = dict(DATOS_OK, email='```\n"Hola Ana,\n\nTexto.\n\nUn saludo,\nla agencia"\n```')
    client = _FakeClient(respuesta=_respuesta_con_tool_use(datos))
    resultado = _llamar(client)
    assert resultado is not None
    assert resultado["email_text"].startswith("Hola Ana,")
    assert "```" not in resultado["email_text"]


def test_budget_y_rooms_no_numericos_no_rompen_la_extraccion():
    datos = dict(DATOS_OK, budget="no numérico", rooms="tres")
    client = _FakeClient(respuesta=_respuesta_con_tool_use(datos))
    resultado = _llamar(client)
    assert resultado is not None
    assert resultado["intent"]["budget"] is None
    assert resultado["intent"]["rooms"] is None


def test_sin_bloque_tool_use_devuelve_none():
    respuesta = SimpleNamespace(
        content=[_FakeTextBlock("no debería responder así")],
        usage=SimpleNamespace(input_tokens=10, output_tokens=5),
    )
    client = _FakeClient(respuesta=respuesta)
    assert _llamar(client) is None


def test_contenido_vacio_devuelve_none():
    respuesta = SimpleNamespace(content=[], usage=None)
    client = _FakeClient(respuesta=respuesta)
    assert _llamar(client) is None


def test_email_vacio_en_la_respuesta_devuelve_none():
    datos = dict(DATOS_OK, email="   ")
    client = _FakeClient(respuesta=_respuesta_con_tool_use(datos))
    assert _llamar(client) is None


def test_api_caida_devuelve_none_sin_lanzar_excepcion():
    client = _FakeClient(excepcion=RuntimeError("Anthropic API caída (simulado)"))
    assert _llamar(client) is None


def test_qualify_lead_end_to_end_usa_la_extraccion_de_claude(client, monkeypatch):
    """Integración completa vía el endpoint real: con un cliente de Anthropic
    simulado que devuelve señales correctamente entendidas (negación de
    financiación + negación de urgencia), el lead guardado debe reflejar esa
    extracción — no el respaldo regex — y el email debe ser el redactado.

    routers.leads llama a get_anthropic_client() directamente (no vía
    Depends), así que se parchea la referencia importada en ese módulo en
    vez de usar app.dependency_overrides."""
    import routers.leads as leads_router
    from core.database import get_lead_by_id, delete_lead

    fake_client = _FakeClient(respuesta=_respuesta_con_tool_use(DATOS_OK))
    monkeypatch.setattr(leads_router, "get_anthropic_client", lambda: fake_client)

    r = client.post("/qualify-lead", json={
        "name": "Ana García E2E", "email": "ana.e2e@example.com", "phone": None,
        "message": ("Busco piso de 3 habitaciones. No tengo el dinero, necesito pedir "
                    "una hipoteca. No es urgente, tengo tiempo de sobra."),
    })
    assert r.status_code == 200
    out = r.json()
    assert out["classification"] != "CALIENTE"
    assert out["generated_email"] == DATOS_OK["email"]

    lead = get_lead_by_id(out["lead_id"], "dev-tenant")
    assert lead["classification"] == out["classification"]
    delete_lead(out["lead_id"], "dev-tenant")


def test_esquema_de_la_herramienta_declara_los_campos_criticos():
    props = CUALIFICAR_TOOL["input_schema"]["properties"]
    for campo in ("operation", "financing", "urgency", "urgency_explicit_low", "message_quality", "email"):
        assert campo in props
    # Las descripciones de financiación/urgencia son el mecanismo real contra
    # negaciones mal interpretadas — que no desaparezcan en un refactor futuro.
    assert "negacion" in props["financing"]["description"].lower().replace("ó", "o")
    assert "negacion" in props["urgency"]["description"].lower().replace("ó", "o")
