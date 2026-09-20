"""
Tests de /demo/qualify — la demo pública sin registro de la landing.

Con ANTHROPIC_API_KEY=test-dummy (ver conftest.py) la llamada a Claude falla
siempre, así que estos tests ejercitan la ruta de respaldo determinista
(analyze_intent + email plantilla) — es la misma garantía que ya cubre el
resto de endpoints de cualificación: nunca hay un 500 solo porque la IA no
esté disponible.
"""

from sqlalchemy import text

from core.database import engine, get_lead_count_this_month


def _limpiar_bucket(bucket: str) -> None:
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM rate_hits WHERE bucket = :b"), {"b": bucket})


def test_demo_qualify_devuelve_resultado_sin_guardar_nada(client):
    _limpiar_bucket("demoip:testclient")
    _limpiar_bucket("demo:global")

    antes = get_lead_count_this_month("dev-tenant")
    r = client.post("/demo/qualify", json={
        "message": "Busco un piso de 3 habitaciones en Madrid con 300.000 euros de presupuesto.",
        "name": "Visitante Demo",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["classification"] in ("CALIENTE", "TIBIO", "FRÍO")
    assert isinstance(body["score"], int)
    assert body["reasoning"]
    assert body["generated_email"]
    # No debe existir ningún efecto secundario: ni lead guardado en BD...
    assert get_lead_count_this_month("dev-tenant") == antes


def test_demo_qualify_mensaje_demasiado_corto_da_422(client):
    r = client.post("/demo/qualify", json={"message": "hola"})
    assert r.status_code == 422


def test_demo_qualify_honeypot_relleno_da_400(client):
    r = client.post("/demo/qualify", json={
        "message": "Busco piso en Valencia con 250.000 euros de presupuesto.",
        "website": "http://bot.example.com",
    })
    assert r.status_code == 400


def test_demo_qualify_rate_limit_por_ip(client, monkeypatch):
    _limpiar_bucket("demoip:testclient")
    _limpiar_bucket("demo:global")
    monkeypatch.setattr("routers.demo.RATE_DEMO_IP_PER_MIN", 1)
    monkeypatch.setattr("routers.demo.RATE_DEMO_IP_PER_HOUR", 100)

    payload = {"message": "Quiero vender mi piso en Sevilla, tasación gratuita por favor."}
    assert client.post("/demo/qualify", json=payload).status_code == 200
    r2 = client.post("/demo/qualify", json=payload)
    assert r2.status_code == 429


def test_demo_qualify_rate_limit_global(client, monkeypatch):
    _limpiar_bucket("demoip:testclient")
    _limpiar_bucket("demo:global")
    # IP generosa para que solo salte el límite global.
    monkeypatch.setattr("routers.demo.RATE_DEMO_IP_PER_MIN", 100)
    monkeypatch.setattr("routers.demo.RATE_DEMO_IP_PER_HOUR", 1000)
    monkeypatch.setattr("routers.demo.RATE_DEMO_GLOBAL_PER_MIN", 1)
    monkeypatch.setattr("routers.demo.RATE_DEMO_GLOBAL_PER_HOUR", 1000)
    monkeypatch.setattr("routers.demo.RATE_DEMO_GLOBAL_PER_DAY", 1000)

    payload = {"message": "Necesito alquilar un piso en Bilbao lo antes posible."}
    assert client.post("/demo/qualify", json=payload).status_code == 200
    r2 = client.post("/demo/qualify", json=payload)
    assert r2.status_code == 429
    assert "solicitada" in r2.json()["detail"].lower()
