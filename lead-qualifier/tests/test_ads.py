"""
Test del gate de plan del generador de anuncios: debe requerir Pro (no Agencia
en exclusiva) — free se rechaza, pro y agencia pasan el guard.
"""

import json
from types import SimpleNamespace

from core.database import set_tenant_plan

T = "dev-tenant"


class _FakeTextBlock:
    def __init__(self, text):
        self.type = "text"
        self.text = text


class _FakeMessages:
    def __init__(self, texto):
        self._texto = texto

    def create(self, **kwargs):
        return SimpleNamespace(content=[_FakeTextBlock(self._texto)])


class _FakeClient:
    def __init__(self, texto):
        self.messages = _FakeMessages(texto)


PAYLOAD = {
    "tipo": "Piso", "op": "Venta", "ubi": "Calle Mayor 12, Madrid",
    "m2": "80", "hab": "3", "ban": "2", "precio": "250000",
    "extras": [], "notas": "", "canales": ["idealista"],
}


def test_generate_ad_rechaza_plan_free(client):
    set_tenant_plan(T, "free")
    r = client.post("/generate-ad", json=PAYLOAD)
    assert r.status_code == 403
    assert r.json()["detail"]["plan_required"] == "pro"


def test_generate_ad_permite_plan_pro(client):
    set_tenant_plan(T, "pro")
    r = client.post("/generate-ad", json=PAYLOAD)
    # Sin API key real de Anthropic el test no puede completar la generación,
    # pero lo importante aquí es que YA NO lo bloquea el guard de plan (403
    # con PLAN_REQUIRED) — eso confirmaría que Pro sigue exigiendo Agencia.
    assert not (r.status_code == 403 and r.json().get("detail", {}).get("code") == "PLAN_REQUIRED")


def test_generate_ad_permite_plan_agencia(client):
    set_tenant_plan(T, "agencia")
    r = client.post("/generate-ad", json=PAYLOAD)
    assert not (r.status_code == 403 and r.json().get("detail", {}).get("code") == "PLAN_REQUIRED")


def test_generate_ad_rechaza_notas_demasiado_largas(client):
    """
    Bug de auditoría: notas se interpola directo en el prompt sin ningún
    límite (ni cliente ni servidor), a diferencia de todos los demás campos
    de texto libre de la sesión (name/message del formulario público).
    """
    set_tenant_plan(T, "pro")
    payload = {**PAYLOAD, "notas": "x" * 1001}
    r = client.post("/generate-ad", json=payload)
    assert r.status_code == 422


def test_generate_ad_avisa_de_canales_que_faltan(client, monkeypatch):
    """
    Bug de auditoría: si Claude no sigue la instrucción "incluye solo las
    claves solicitadas" y omite un canal, la respuesta debe decirlo — antes
    se devolvían en silencio solo los borradores que sí llegaron.
    """
    import routers.ads as ads_router

    set_tenant_plan(T, "pro")
    texto = json.dumps({"drafts": {"idealista": {"titulo": "t", "body": "b"}}})
    monkeypatch.setattr(ads_router, "get_anthropic_client", lambda: _FakeClient(texto))

    payload = {**PAYLOAD, "canales": ["idealista", "rrss"]}
    r = client.post("/generate-ad", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert "idealista" in body["drafts"]
    assert body["canales_faltantes"] == ["rrss"]


def test_generate_ad_no_avisa_si_llegan_todos_los_canales(client, monkeypatch):
    import routers.ads as ads_router

    set_tenant_plan(T, "pro")
    texto = json.dumps({"drafts": {"idealista": {"titulo": "t", "body": "b"}}})
    monkeypatch.setattr(ads_router, "get_anthropic_client", lambda: _FakeClient(texto))

    r = client.post("/generate-ad", json=PAYLOAD)  # solo pide "idealista"
    assert r.status_code == 200
    assert "canales_faltantes" not in r.json()


def test_generate_ad_respeta_el_limite_de_peticiones(client):
    """
    Bug de auditoría: /generate-ad no tenía ningún límite de peticiones, a
    diferencia de todos los demás endpoints que llaman a Claude — cada
    llamada cuesta un uso real de la API, sin ningún tope de coste.
    """
    from config import RATE_AD_TENANT_PER_HOUR, RATE_AD_TENANT_PER_MIN
    from security import rate_limited

    set_tenant_plan(T, "pro")
    bucket = f"ad:{T}"
    # Se rellena directamente el contador (sin pasar por el endpoint) para no
    # depender de llamadas reales a Anthropic en el test.
    for _ in range(RATE_AD_TENANT_PER_MIN):
        rate_limited(bucket, RATE_AD_TENANT_PER_MIN, RATE_AD_TENANT_PER_HOUR)

    r = client.post("/generate-ad", json=PAYLOAD)
    assert r.status_code == 429

    set_tenant_plan(T, "free")  # dejar el estado limpio
