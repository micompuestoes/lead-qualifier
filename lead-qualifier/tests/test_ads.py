"""
Test del gate de plan del generador de anuncios: debe requerir Pro (no Agencia
en exclusiva) — free se rechaza, pro y agencia pasan el guard.
"""

from core.database import set_tenant_plan

T = "dev-tenant"

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
