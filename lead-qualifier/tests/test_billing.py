"""
Tests de facturación con Stripe ([routers/billing.py]) — antes sin cobertura.
Stripe se simula por completo con monkeypatch: estos tests nunca llaman a la
API real de Stripe.
"""

from types import SimpleNamespace

import stripe
from sqlalchemy import text

from core.database import engine, get_tenant, set_tenant_plan

T = "dev-tenant"


def _limpiar_customer_id():
    """El customer_id de Stripe se conserva con COALESCE en set_tenant_plan
    (no se puede borrar pasando None) — se limpia directo en BD para poder
    probar la rama de checkout que crea un customer nuevo."""
    with engine.begin() as conn:
        conn.execute(text("UPDATE tenants SET stripe_customer_id = NULL WHERE id = :id"), {"id": T})


# ── Checkout ────────────────────────────────────────────────────────────────

def test_checkout_sin_stripe_configurado_da_503(client, monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    r = client.post("/billing/checkout", json={"plan": "pro"})
    assert r.status_code == 503


def test_checkout_sin_price_id_da_503(client, monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.delenv("STRIPE_PRICE_PRO", raising=False)
    r = client.post("/billing/checkout", json={"plan": "pro"})
    assert r.status_code == 503


def test_checkout_crea_customer_nuevo_si_no_tiene(client, monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.setenv("STRIPE_PRICE_PRO", "price_pro_test")
    _limpiar_customer_id()

    llamadas = {}

    def _fake_customer_create(**kw):
        llamadas["customer_kw"] = kw
        return SimpleNamespace(id="cus_new_123")

    def _fake_session_create(**kw):
        llamadas["session_kw"] = kw
        return SimpleNamespace(url="https://checkout.stripe.com/fake")

    monkeypatch.setattr(stripe.Customer, "create", _fake_customer_create)
    monkeypatch.setattr(stripe.checkout.Session, "create", _fake_session_create)

    r = client.post("/billing/checkout", json={"plan": "pro"})
    assert r.status_code == 200
    assert r.json()["url"] == "https://checkout.stripe.com/fake"
    assert llamadas["customer_kw"]["metadata"]["tenant_id"] == T
    # Pro es de un único usuario: cantidad 1 aunque el tenant tenga equipo.
    assert llamadas["session_kw"]["line_items"][0]["quantity"] == 1
    assert get_tenant(T)["stripe_customer_id"] == "cus_new_123"


def test_checkout_reutiliza_customer_existente(client, monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.setenv("STRIPE_PRICE_PRO", "price_pro_test")
    set_tenant_plan(T, "free", None, "cus_ya_existente")

    def _no_deberia_crear(**kw):
        raise AssertionError("no debería crear un customer si ya hay uno")

    monkeypatch.setattr(stripe.Customer, "create", _no_deberia_crear)
    monkeypatch.setattr(
        stripe.checkout.Session, "create",
        lambda **kw: SimpleNamespace(url="https://checkout.stripe.com/fake2"),
    )
    r = client.post("/billing/checkout", json={"plan": "pro"})
    assert r.status_code == 200


def test_checkout_agencia_factura_por_asientos(client, monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.setenv("STRIPE_PRICE_AGENCIA", "price_agencia_test")
    set_tenant_plan(T, "free", None, "cus_ya_existente")

    from routers.billing import _seat_count
    capturado = {}

    def _fake_session_create(**kw):
        capturado["kw"] = kw
        return SimpleNamespace(url="https://checkout.stripe.com/fake3")

    monkeypatch.setattr(stripe.checkout.Session, "create", _fake_session_create)
    r = client.post("/billing/checkout", json={"plan": "agencia"})
    assert r.status_code == 200
    assert capturado["kw"]["line_items"][0]["quantity"] == _seat_count(T)


# ── Cancelación ─────────────────────────────────────────────────────────────

def test_cancelar_sin_stripe_configurado_da_503(client, monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    assert client.delete("/me/subscription").status_code == 503


def test_cancelar_sin_plan_de_pago_da_400(client, monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    set_tenant_plan(T, "free")
    assert client.delete("/me/subscription").status_code == 400


def test_cancelar_sin_subscription_id_da_404(client, monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    set_tenant_plan(T, "pro", None, "cus_x")
    assert client.delete("/me/subscription").status_code == 404


def _fake_subscription(**campos) -> stripe.Subscription:
    """
    Construye un stripe.Subscription REAL (no un dict) como el que devuelve
    la API de Stripe. Es deliberado: un dict soporta .get() y un StripeObject
    NO — usar un dict aquí habría ocultado el bug real de producción donde
    sub.get(...) lanzaba "'get' is a dict method, but a Subscription is not
    a dict" porque el mock no se parecía a la respuesta real de Stripe.
    """
    return stripe.Subscription.construct_from(campos, "sk_test_dummy")


def test_cancelar_marca_cancel_at_period_end(client, monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    set_tenant_plan(T, "pro", "sub_cancel_test", "cus_cancel_test")

    monkeypatch.setattr(
        stripe.Subscription, "modify",
        lambda sub_id, **kw: _fake_subscription(current_period_end=1999999999),
    )
    r = client.delete("/me/subscription")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["cancel_at_period_end"] is True
    assert body["current_period_end"] == 1999999999


def test_cancelar_error_de_stripe_da_400_no_500(client, monkeypatch):
    """Un fallo de Stripe al cancelar se traduce a 4xx manejado, no a un 500
    (así el navegador recibe CORS y el mensaje real, según el propio código)."""
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    set_tenant_plan(T, "pro", "sub_error_test", "cus_error_test")

    def _falla(sub_id, **kw):
        raise RuntimeError("Stripe caído")

    monkeypatch.setattr(stripe.Subscription, "modify", _falla)
    r = client.delete("/me/subscription")
    assert r.status_code == 400

    set_tenant_plan(T, "free")  # dejar el estado limpio


# ── Sincronización de asientos (Agencia) ───────────────────────────────────
# Bug real encontrado en producción: sync_agency_seats usaba sub.get(...) sobre
# un stripe.Subscription de verdad, que no soporta .get() como un dict — el
# fallo quedaba silenciado (se loguea y no rompe la petición) así que nadie lo
# veía hasta mirar los logs. Por eso aquí SIEMPRE se simula con un
# stripe.Subscription real via construct_from, nunca con un dict plano.

def test_sync_agency_seats_actualiza_la_cantidad_en_stripe(client, monkeypatch):
    from routers.billing import sync_agency_seats

    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    set_tenant_plan(T, "agencia", "sub_seats_test", "cus_seats_test")

    monkeypatch.setattr(
        stripe.Subscription, "retrieve",
        lambda sub_id: _fake_subscription(items={
            "object": "list",
            "data": [{"id": "si_seats_test"}],
        }),
    )
    capturado = {}

    def _fake_modify(item_id, **kw):
        capturado["item_id"] = item_id
        capturado["kw"] = kw
        return _fake_subscription()

    monkeypatch.setattr(stripe.SubscriptionItem, "modify", _fake_modify)

    sync_agency_seats(T)

    assert capturado["item_id"] == "si_seats_test"
    assert capturado["kw"]["quantity"] == 2  # dev-tenant sin miembros → mínimo
    assert capturado["kw"]["proration_behavior"] == "create_prorations"

    set_tenant_plan(T, "free")  # dejar el estado limpio


def test_sync_agency_seats_no_hace_nada_si_no_es_agencia(client, monkeypatch):
    from routers.billing import sync_agency_seats

    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    set_tenant_plan(T, "pro", "sub_no_agencia", "cus_no_agencia")

    def _no_deberia_llamar(sub_id):
        raise AssertionError("no debería consultar Stripe para un plan que no es agencia")

    monkeypatch.setattr(stripe.Subscription, "retrieve", _no_deberia_llamar)
    sync_agency_seats(T)  # no debe lanzar ni llamar a Stripe

    set_tenant_plan(T, "free")  # dejar el estado limpio


def test_sync_agency_seats_absorbe_errores_de_stripe(client, monkeypatch):
    """Si Stripe falla (o el SDK cambia de forma incompatible, como pasó de
    verdad), sync_agency_seats no debe romper la petición que la llama
    (añadir/quitar un miembro del equipo)."""
    from routers.billing import sync_agency_seats

    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    set_tenant_plan(T, "agencia", "sub_seats_error", "cus_seats_error")

    def _falla(sub_id):
        raise RuntimeError("Stripe caído")

    monkeypatch.setattr(stripe.Subscription, "retrieve", _falla)
    sync_agency_seats(T)  # no debe propagar la excepción

    set_tenant_plan(T, "free")  # dejar el estado limpio
