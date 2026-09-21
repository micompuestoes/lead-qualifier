"""
Tests de integración de la API (TestClient) — la red de seguridad de los flujos
completos: cualificación con borradores, feedback, filtros y búsqueda, export
CSV, equipo/asignación, intake público y webhook de Stripe (idempotencia).

Sin CLERK_JWKS_URL la auth entra en modo dev: todas las peticiones actúan como
el dueño 'dev-tenant'. La visibilidad de los miembros del equipo se cubre en la
capa de BD (impersonar un miembro exigiría un JWT real de Clerk).

Los tests de este archivo son SECUENCIALES (comparten estado de BD en orden).
"""

from core.database import (
    delete_lead, get_lead_by_id, get_leads_by_email, get_recent_leads, get_tenant,
    save_lead, set_tenant_plan, update_lead_status,
)

T = "dev-tenant"


def _semilla(lid, name, email, msg, clasif, score, status="PENDIENTE"):
    save_lead(lead_id=lid, tenant_id=T, name=name, email=email, phone=None,
              message=msg, classification=clasif, score=score, reasoning="r",
              generated_email="x", recommended_actions=[], intent_analysis={},
              company_info={}, email_sent=1)
    if status != "PENDIENTE":
        update_lead_status(lid, status, tenant_id=T)


# ── Salud y ajustes ───────────────────────────────────────────────────────────

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_ai_settings_roundtrip(client):
    r = client.post("/me/ai-settings",
                    json={"auto_send": False, "brand_voice": "tono cercano", "followup_enabled": True})
    assert r.status_code == 200
    me = client.get("/me").json()
    assert me["auto_send_email"] is False
    assert me["brand_voice"] == "tono cercano"
    assert me["followup_enabled"] is True


# ── Cualificación: borradores, envío manual y feedback ────────────────────────

def test_qualify_en_modo_revision_deja_borrador(client):
    r = client.post("/qualify-lead", json={
        "name": "Borrador Uno", "email": "b1@test.com", "phone": None,
        "message": "Busco un piso de 3 habitaciones en Madrid con 300.000 euros de presupuesto",
    })
    assert r.status_code == 200
    out = r.json()
    assert out["email_sent"] is False
    lead = get_lead_by_id(out["lead_id"], T)
    assert lead["email_sent"] == 0
    assert lead["generated_email"], "el borrador debe generarse aunque no se envíe"


def test_enviar_borrador_sin_smtp_da_502_y_no_marca(client):
    lead = get_recent_leads(tenant_id=T)[0]
    r = client.post(f"/leads/{lead['id']}/send-email", json={"email_body": "Hola, editado."})
    assert r.status_code == 502
    assert get_lead_by_id(lead["id"], T)["email_sent"] == 0


def test_feedback_up_y_borrado(client):
    lead = get_recent_leads(tenant_id=T)[0]
    r = client.patch(f"/leads/{lead['id']}/feedback", json={"feedback": "up"})
    assert r.status_code == 200 and r.json()["score_feedback"] == 1
    r = client.patch(f"/leads/{lead['id']}/feedback", json={"feedback": None})
    assert r.status_code == 200 and r.json()["score_feedback"] is None


def test_recalcular_puntuacion_reaplica_score_lead(client):
    """Un lead con señales guardadas se puede repuntuar con la fórmula vigente
    sin re-leer el mensaje ni redactar un email nuevo."""
    from core.tools import score_lead

    lead = get_recent_leads(tenant_id=T)[0]
    # Deja una valoración previa — recalcular debe borrarla, ya no aplica a la
    # puntuación nueva.
    client.patch(f"/leads/{lead['id']}/feedback", json={"feedback": "up"})

    r = client.post(f"/leads/{lead['id']}/rescore")
    assert r.status_code == 200
    body = r.json()
    esperado = score_lead(lead["intent_analysis"], lead["company_info"])
    assert body["score"] == esperado["score"]
    assert body["classification"] == esperado["classification"]
    assert body["score_feedback"] is None


def test_recalcular_puntuacion_sin_senales_guardadas_da_400(client):
    """Un lead sembrado sin intent_analysis (p. ej. de antes de esta función)
    no se puede recalcular — no hay señales de las que partir."""
    _semilla("SR1", "Sin Señales", "sinsenales@test.com", "x", "TIBIO", 5)
    r = client.post("/leads/SR1/rescore")
    assert r.status_code == 400
    delete_lead("SR1", T)


def test_qualify_automatico_sin_smtp_queda_como_borrador(client):
    """Si el envío automático falla (aquí: sin SMTP), el lead NUNCA debe figurar
    como enviado — queda en borrador para que el agente lo envíe a mano."""
    client.post("/me/ai-settings", json={"auto_send": True, "brand_voice": "", "followup_enabled": False})
    r = client.post("/qualify-lead", json={
        "name": "Auto Uno", "email": "a1@test.com", "phone": None,
        "message": "Quiero vender mi piso en Sevilla",
    })
    assert r.status_code == 200 and r.json()["email_sent"] is True   # modo auto anunciado
    assert get_lead_by_id(r.json()["lead_id"], T)["email_sent"] == 0  # …pero no se envió


def test_qualify_automatico_marca_enviado_si_el_envio_confirma(client, monkeypatch):
    """Con el backend de email funcionando, el background task marca email_sent=1."""
    import services.email_sender as es
    monkeypatch.setattr(es, "send_email", lambda **kw: True)
    r = client.post("/qualify-lead", json={
        "name": "Auto Dos", "email": "a2@test.com", "phone": None,
        "message": "Quiero comprar un ático en Bilbao con 400.000 euros",
    })
    assert r.status_code == 200
    assert get_lead_by_id(r.json()["lead_id"], T)["email_sent"] == 1
    assert get_lead_by_id(r.json()["lead_id"], T)["source"] == "api"


def test_qualify_lead_duplicado_da_409_y_no_crea_otro(client):
    """Un doble clic / reintento de red no debe gastar una segunda llamada a
    Claude ni crear un segundo lead — mismo tenant, email y mensaje.
    Borra el lead creado al terminar: no debe consumir la cuota mensual del
    plan free que el test de rate limit, más adelante, deja ajustada al límite."""
    payload = {
        "name": "Doble Clic", "email": "doble@test.com", "phone": None,
        "message": "Busco piso en Málaga, presupuesto 200.000 euros",
    }
    r1 = client.post("/qualify-lead", json=payload)
    assert r1.status_code == 200
    antes = client.get("/leads").json()["total"]

    r2 = client.post("/qualify-lead", json=payload)
    assert r2.status_code == 409
    assert client.get("/leads").json()["total"] == antes

    delete_lead(r1.json()["lead_id"], T)


# ── Listado: counts reales, búsqueda y filtros en servidor ────────────────────

def test_lista_counts_reales_y_filtros(client):
    _semilla("S1", "María García", "maria@test.com", "Piso en Chamberí", "CALIENTE", 9)
    _semilla("S2", "Javier Ruiz", "jruiz@test.com", "Alquiler céntrico", "TIBIO", 6, "CONTACTADO")
    _semilla("S3", "Sofía Romero", "sofia@test.com", "Información 100% general", "FRÍO", 3, "DESCARTADO")

    r = client.get("/leads").json()
    assert r["scope"] == "all"
    assert r["counts"]["total"] == r["total"] >= 5   # 2 cualificados + 3 semillas

    # Búsqueda case-insensitive en nombre
    r = client.get("/leads", params={"q": "garcía"}).json()
    assert {l["id"] for l in r["leads"]} == {"S1"}
    # …y los counts siguen siendo del pipeline completo aunque haya filtros
    assert r["counts"]["total"] >= 5

    # Los comodines del usuario se escapan (100% no es "match todo")
    r = client.get("/leads", params={"q": "100%"}).json()
    assert {l["id"] for l in r["leads"]} == {"S3"}

    r = client.get("/leads", params={"classification": "CALIENTE"}).json()
    assert "S1" in {l["id"] for l in r["leads"]}
    r = client.get("/leads", params={"status": "CONTACTADO"}).json()
    assert {l["id"] for l in r["leads"]} == {"S2"}

    # Un filtro con valor desconocido se ignora en vez de romper
    assert client.get("/leads", params={"classification": "HACKER"}).json()["total"] >= 5


# ── Valor de operación al cerrar un lead (ROI real para la agencia) ──────────

def test_cerrar_lead_con_valor_de_operacion(client):
    _semilla("S4", "Pablo Núñez", "pablo@test.com", "Compra ático", "CALIENTE", 8)

    r = client.patch("/leads/S4/status", json={"status": "CERRADO", "deal_value": 250000})
    assert r.status_code == 200
    assert r.json()["status"] == "CERRADO"
    assert r.json()["deal_value"] == 250000

    # El total agregado del tenant refleja la operación cerrada
    counts = client.get("/leads").json()["counts"]
    assert counts["deal_value_total"] >= 250000

    # Un importe negativo se rechaza (422 de validación, no un 500)
    r = client.patch("/leads/S4/status", json={"status": "CERRADO", "deal_value": -1})
    assert r.status_code == 422

    # Cambiar de estado sin mandar deal_value no borra el valor ya guardado
    r = client.patch("/leads/S4/status", json={"status": "CONTACTADO"})
    assert r.status_code == 200
    assert r.json()["deal_value"] == 250000


# ── Export CSV: gate de plan + filtros ────────────────────────────────────────

def test_export_csv_respeta_plan_y_filtros(client):
    set_tenant_plan(T, "free")
    assert client.get("/leads/export").status_code == 403

    set_tenant_plan(T, "pro")
    r = client.get("/leads/export")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers["content-disposition"]
    assert r.text.startswith("﻿") and "María García" in r.text

    r = client.get("/leads/export", params={"classification": "CALIENTE"})
    assert "María García" in r.text and "Sofía Romero" not in r.text


# ── Equipo, asignación y leaderboard (plan agencia) ───────────────────────────

def test_equipo_asignacion_y_leaderboard(client):
    set_tenant_plan(T, "agencia")
    r = client.post("/me/team", json={"member_id": "user_ana", "member_name": "Ana",
                                      "member_email": "ana@test.com", "member_whatsapp": "600112233"})
    assert r.status_code == 201
    assert r.json()["member_whatsapp"] == "34600112233"   # normalizado a formato Meta

    r = client.patch("/leads/S1/assign", json={"agent_id": "user_ana"})
    assert r.status_code == 200 and r.json()["assigned_to"] == "user_ana"
    # Un agente que no es del equipo se rechaza
    assert client.patch("/leads/S1/assign", json={"agent_id": "user_nadie"}).status_code == 400

    r = client.get("/stats/agents").json()
    assert {a["agent_id"] for a in r["agents"]} == {T, "user_ana"}


def test_asientos_agencia_con_minimo(client):
    """Agencia factura por asiento con mínimo 2: nunca más barata que Pro."""
    from routers.billing import _seat_count
    # dev-tenant tiene 1 miembro (user_ana) + dueño = 2 asientos
    assert _seat_count(T) == 2
    # Un tenant sin equipo también factura el mínimo de 2
    assert _seat_count("tenant-sin-equipo") == 2


def test_visibilidad_por_agente_en_bd(client):
    visibles_ana = get_recent_leads(tenant_id=T, agent_id="user_ana")
    assert {l["id"] for l in visibles_ana} == {"S1"}
    assert get_lead_by_id("S2", T, agent_id="user_ana") is None   # el lead de otro no existe para ella


# ── Intake público: sin fuga de datos, honeypot y api_key ─────────────────────

def test_intake_publico_sin_fuga_y_honeypot(client):
    api_key = get_tenant(T)["api_key"]

    r = client.post(f"/intake/{api_key}", json={
        "name": "Ana Cliente", "email": "cliente@test.com", "phone": None,
        "message": "Busco piso de dos habitaciones en Valencia", "website": None,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    # La cualificación es información interna: jamás se devuelve al remitente
    assert "score" not in body and "classification" not in body

    # Honeypot relleno → ok falso y NO se crea el lead
    antes = client.get("/leads").json()["total"]
    r = client.post(f"/intake/{api_key}", json={
        "name": "Bot", "email": "bot@test.com", "phone": None,
        "message": "spam spam spam", "website": "http://bot.com",
    })
    assert r.status_code == 200
    assert client.get("/leads").json()["total"] == antes

    assert client.post("/intake/lq_invalida", json={
        "name": "Xavi", "email": "x@test.com", "phone": None, "message": "hola, info", "website": None,
    }).status_code == 404


def test_intake_publico_marca_source_formulario(client):
    api_key = get_tenant(T)["api_key"]
    r = client.post(f"/intake/{api_key}", json={
        "name": "Origen Test", "email": "origen@test.com", "phone": None,
        "message": "Quiero alquilar un piso en Bilbao", "website": None,
    })
    assert r.status_code == 200
    lead = get_leads_by_email("origen@test.com", T)[0]
    assert lead["source"] == "formulario"
    delete_lead(lead["id"], T)  # no consumir cuota mensual del plan free


def test_intake_publico_duplicado_se_ignora_silenciosamente(client):
    """Igual que en /qualify-lead, pero el visitante nunca debe ver un error:
    responde 'ok' sin volver a cualificar ni crear un segundo lead."""
    api_key = get_tenant(T)["api_key"]
    payload = {
        "name": "Doble Envio Form", "email": "dobleform@test.com", "phone": None,
        "message": "Busco chalet en Marbella con 3 habitaciones", "website": None,
    }
    assert client.post(f"/intake/{api_key}", json=payload).status_code == 200
    antes = client.get("/leads").json()["total"]

    r2 = client.post(f"/intake/{api_key}", json=payload)
    assert r2.status_code == 200 and r2.json()["ok"] is True
    assert client.get("/leads").json()["total"] == antes

    delete_lead(get_leads_by_email("dobleform@test.com", T)[0]["id"], T)


def test_form_branding_y_config_publica(client):
    # Guardar la marca del formulario.
    r = client.post("/me/form-branding", json={
        "brand_color": "#1a73e8", "logo_url": "https://x.es/logo.png",
        "form_title": "Vende con nosotros", "form_subtitle": "Te llamamos hoy",
    })
    assert r.status_code == 200 and r.json()["brand_color"] == "#1a73e8"

    # Color inválido → 400 (no debe llegar CSS raro al formulario).
    assert client.post("/me/form-branding", json={"brand_color": "azul"}).status_code == 400
    # Logo que no es URL → 400.
    assert client.post("/me/form-branding", json={"logo_url": "javascript:alert(1)"}).status_code == 400

    # El endpoint publico del formulario refleja la marca por api_key.
    ak = get_tenant(T)["api_key"]
    fc = client.get(f"/form-config/{ak}").json()
    assert fc["found"] is True
    assert fc["brand_color"] == "#1a73e8"
    assert fc["form_title"] == "Vende con nosotros"

    # api_key inexistente → found False (el formulario usa la marca por defecto).
    assert client.get("/form-config/lq_inexistente").json()["found"] is False


# ── Webhook de Stripe: procesa una vez, ignora reintentos ─────────────────────

def test_webhook_stripe_idempotente(client):
    evento = {
        "id": "evt_test_123",
        "type": "checkout.session.completed",
        "data": {"object": {
            "metadata": {"tenant_id": T, "plan": "pro"},
            "subscription": "sub_test", "customer": "cus_test",
        }},
    }
    antes = client.get("/me/notifications").json()["unread"]

    r = client.post("/billing/webhook", json=evento)
    assert r.status_code == 200
    tras_primero = client.get("/me/notifications").json()["unread"]
    assert tras_primero == antes + 1                      # notificación de bienvenida al plan
    assert get_tenant(T)["plan"] == "pro"

    # Reintento de Stripe con el mismo id → no se reprocesa nada
    r = client.post("/billing/webhook", json=evento)
    assert r.status_code == 200 and r.json().get("duplicate") is True
    assert client.get("/me/notifications").json()["unread"] == tras_primero


def test_webhook_subscription_updated_reconcilia_cambio_de_plan_fuera_de_checkout(client, monkeypatch):
    """
    Bug real de auditoría: un cambio de plan hecho fuera de /billing/checkout
    (p. ej. desde el Portal de Cliente de Stripe, si permite cambiar de precio)
    no pasa por checkout.session.completed, así que el plan local se quedaba
    desincronizado de lo que Stripe cobra de verdad. customer.subscription.updated
    debe reconciliarlo comparando el price real de la suscripción.
    """
    monkeypatch.setenv("STRIPE_PRICE_AGENCIA", "price_agencia_test")
    set_tenant_plan(T, "pro", "sub_reconcile_test", "cus_reconcile_test")

    evento = {
        "id": "evt_reconcile_1",
        "type": "customer.subscription.updated",
        "data": {"object": {
            "id": "sub_reconcile_test",
            "customer": "cus_reconcile_test",
            "status": "active",
            "items": {"data": [{"price": {"id": "price_agencia_test"}}]},
        }},
    }
    r = client.post("/billing/webhook", json=evento)
    assert r.status_code == 200
    assert get_tenant(T)["plan"] == "agencia"

    set_tenant_plan(T, "free")  # dejar el estado limpio


def test_webhook_subscription_updated_no_toca_nada_si_el_precio_no_cambia(client, monkeypatch):
    """Si el plan reportado ya coincide con el guardado, no hay nada que
    reconciliar (evita escrituras/logs innecesarios en cada webhook normal)."""
    monkeypatch.setenv("STRIPE_PRICE_PRO", "price_pro_test")
    set_tenant_plan(T, "pro", "sub_sin_cambio", "cus_sin_cambio")

    llamadas = {"set_plan": 0}
    import routers.billing as billing_mod
    original = billing_mod.set_tenant_plan

    def _contador(*a, **kw):
        llamadas["set_plan"] += 1
        return original(*a, **kw)

    monkeypatch.setattr(billing_mod, "set_tenant_plan", _contador)

    evento = {
        "id": "evt_reconcile_2",
        "type": "customer.subscription.updated",
        "data": {"object": {
            "id": "sub_sin_cambio",
            "customer": "cus_sin_cambio",
            "status": "active",
            "items": {"data": [{"price": {"id": "price_pro_test"}}]},
        }},
    }
    r = client.post("/billing/webhook", json=evento)
    assert r.status_code == 200
    assert llamadas["set_plan"] == 0
    assert get_tenant(T)["plan"] == "pro"

    set_tenant_plan(T, "free")  # dejar el estado limpio


def test_webhook_fail_closed_con_stripe_activo_sin_secret(client, monkeypatch):
    """Con pagos activos (STRIPE_SECRET_KEY) pero sin STRIPE_WEBHOOK_SECRET, el
    webhook debe rechazar todo: aceptar eventos sin firma permitiría falsear
    un checkout y regalarse un plan de pago."""
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    r = client.post("/billing/webhook", json={
        "id": "evt_fake", "type": "checkout.session.completed",
        "data": {"object": {"metadata": {"tenant_id": T, "plan": "agencia"}}},
    })
    assert r.status_code == 503


# ── Auth: sin configurar, la API se cierra (no se abre) ───────────────────────

def test_auth_fail_closed_sin_dev_mode(client, monkeypatch):
    """Sin CLERK_JWKS_URL, el modo dev solo entra con DEV_MODE=1 explícito.
    Si ambas faltan (p. ej. variable borrada en un deploy), la API responde 503
    en vez de tratar a todo el mundo como 'dev-tenant'."""
    monkeypatch.delenv("DEV_MODE", raising=False)
    assert client.get("/leads").status_code == 503
    assert client.get("/me").status_code == 503


# ── Admin: cambio de plan manual (red de seguridad si el webhook falla) ───────

def test_admin_override_plan_conserva_stripe(client, monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET_KEY", "clave-admin-larga-de-test")
    # El tenant tiene una suscripción de Stripe vinculada.
    set_tenant_plan(T, "pro", "sub_manual", "cus_manual")

    # Sin la clave de admin → 403.
    r = client.patch(f"/admin/tenants/{T}/plan", json={"plan": "agencia"})
    assert r.status_code == 403

    # Con la clave → cambia el plan y NO borra los IDs de Stripe.
    h = {"X-Admin-Key": "clave-admin-larga-de-test"}
    r = client.patch(f"/admin/tenants/{T}/plan", json={"plan": "agencia"}, headers=h)
    assert r.status_code == 200
    t = get_tenant(T)
    assert t["plan"] == "agencia"
    assert t["stripe_subscription_id"] == "sub_manual"
    assert t["stripe_customer_id"] == "cus_manual"

    # Plan inválido → 422 (lo rechaza el Literal de Pydantic).
    r = client.patch(f"/admin/tenants/{T}/plan", json={"plan": "premium"}, headers=h)
    assert r.status_code == 422

    set_tenant_plan(T, "free", None, "cus_manual")  # dejar el estado limpio


def test_admin_lista_y_detalle_de_tenants(client, monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET_KEY", "clave-admin-larga-de-test")
    h = {"X-Admin-Key": "clave-admin-larga-de-test"}

    # Sin la clave → 403 (ya cubierto para /plan; aquí para /tenants).
    assert client.get("/admin/tenants").status_code == 403

    r = client.get("/admin/tenants", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    assert any(t["id"] == T and "lead_count" in t for t in body["tenants"])

    r = client.get(f"/admin/tenants/{T}", headers=h)
    assert r.status_code == 200 and r.json()["id"] == T

    assert client.get("/admin/tenants/tenant-inexistente", headers=h).status_code == 404


def test_admin_lista_expone_coste_de_ia_por_tenant(client, monkeypatch):
    """
    ai_cost_mes se calculaba dentro de GET /stats (Estadísticas, de cara a la
    agencia) pero ningún cliente lo mostraba — es el COGS de IA de Daniel, no
    algo que le interese a la agencia. Se traslada al panel de admin, que es
    donde de verdad hace falta.
    """
    monkeypatch.setenv("ADMIN_SECRET_KEY", "clave-admin-larga-de-test")
    h = {"X-Admin-Key": "clave-admin-larga-de-test"}

    r = client.get("/admin/tenants", headers=h)
    assert r.status_code == 200
    tenant = next(t for t in r.json()["tenants"] if t["id"] == T)
    assert "ai_cost_mes" in tenant
    assert isinstance(tenant["ai_cost_mes"], (int, float))


def test_admin_lista_expone_asientos_reales_de_agencia(client, monkeypatch):
    """El MRR del panel admin depende de esto: Agencia se factura por asiento,
    no a precio plano, así que el backend debe exponer cuántos asientos tiene
    de verdad cada tenant Agencia (mínimo MIN_AGENCY_SEATS)."""
    from config import MIN_AGENCY_SEATS

    monkeypatch.setenv("ADMIN_SECRET_KEY", "clave-admin-larga-de-test")
    h = {"X-Admin-Key": "clave-admin-larga-de-test"}
    set_tenant_plan(T, "agencia", "sub_admin_seats_test", "cus_admin_seats_test")

    r = client.get("/admin/tenants", headers=h)
    tenant = next(t for t in r.json()["tenants"] if t["id"] == T)
    assert tenant["seats"] == MIN_AGENCY_SEATS  # dev-tenant sin miembros → mínimo

    set_tenant_plan(T, "free")  # dejar el estado limpio


def test_admin_cambia_estado_de_tenant(client, monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET_KEY", "clave-admin-larga-de-test")
    h = {"X-Admin-Key": "clave-admin-larga-de-test"}

    # El check de tenant cancelado vive en get_caller() (deps.py) y solo se
    # ejercita en el flujo de JWT real; en DEV_MODE se salta por diseño (así
    # que no se puede probar aquí sin un JWT de Clerk real). Se verifica en
    # su lugar que el admin sí cambia el estado en BD.
    r = client.patch(f"/admin/tenants/{T}/status", json={"status": "cancelled"}, headers=h)
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert get_tenant(T)["status"] == "cancelled"

    # Reactivar — deja el estado limpio para el resto de la suite.
    r = client.patch(f"/admin/tenants/{T}/status", json={"status": "active"}, headers=h)
    assert r.status_code == 200 and r.json()["status"] == "active"
    assert get_tenant(T)["status"] == "active"


def test_admin_overview_requiere_clave_y_devuelve_embudo(client, monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET_KEY", "clave-admin-larga-de-test")
    assert client.get("/admin/overview").status_code == 403

    h = {"X-Admin-Key": "clave-admin-larga-de-test"}
    r = client.get("/admin/overview", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert "altas_por_semana" in body and "por_plan" in body and "adopcion" in body


# ── Perfil: actualizar datos y WhatsApp ────────────────────────────────────────

def test_perfil_actualizar_nombre_y_email_de_aviso(client):
    r = client.patch("/me", json={"name": "Nueva Agencia SL", "notify_email": "avisos@test.com"})
    assert r.status_code == 200
    assert r.json()["name"] == "Nueva Agencia SL"
    assert r.json()["notify_email"] == "avisos@test.com"


def test_perfil_webhook_valida_https_y_hace_roundtrip(client):
    assert client.post("/me/webhook", json={"webhook_url": "http://inseguro.com"}).status_code == 400

    r = client.post("/me/webhook", json={"webhook_url": "https://hooks.crm.com/inmuebia"})
    assert r.status_code == 200
    assert r.json()["webhook_url"] == "https://hooks.crm.com/inmuebia"
    assert client.get("/me").json()["webhook_url"] == "https://hooks.crm.com/inmuebia"

    # Vacío desactiva el reenvío.
    r = client.post("/me/webhook", json={"webhook_url": ""})
    assert r.status_code == 200 and r.json()["webhook_url"] == ""
    assert client.get("/me").json()["webhook_url"] == ""


def test_perfil_whatsapp_exige_numero_valido_si_se_activa(client):
    r = client.post("/me/whatsapp", json={"number": "", "enabled": True})
    assert r.status_code == 400

    r = client.post("/me/whatsapp", json={"number": "+34 600 11 22 33", "enabled": True})
    assert r.status_code == 200
    assert r.json()["whatsapp_enabled"] is True
    assert r.json()["whatsapp_number"] == "34600112233"

    r = client.post("/me/whatsapp", json={"number": "", "enabled": False})
    assert r.status_code == 200 and r.json()["whatsapp_enabled"] is False


# ── Equipo: eliminar miembro y gate de plan ────────────────────────────────────

def test_equipo_requiere_plan_agencia(client):
    set_tenant_plan(T, "pro")
    assert client.get("/me/team").status_code == 403
    assert client.post("/me/team", json={"member_id": "user_x"}).status_code == 403


def test_equipo_eliminar_miembro_libera_el_asiento(client):
    from config import MIN_AGENCY_SEATS
    from routers.billing import _seat_count
    set_tenant_plan(T, "agencia")

    assert client.delete("/me/team/user_ana").status_code == 204
    assert client.get("/me/team").json()["total"] == 0
    # Sin miembros, el asiento factura el mínimo (MIN_AGENCY_SEATS), no 0.
    assert _seat_count(T) == MIN_AGENCY_SEATS

    set_tenant_plan(T, "free")  # dejar el estado limpio


# ── Rate limit por tenant en /qualify-lead (todos los planes) ─────────────────

def test_qualify_lead_rate_limit_por_tenant(client, monkeypatch):
    from sqlalchemy import text
    from core.database import engine

    bucket = f"tenant:{T}"
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM rate_hits WHERE bucket = :b"), {"b": bucket})

    monkeypatch.setattr("routers.leads.RATE_TENANT_PER_MIN", 1)
    monkeypatch.setattr("routers.leads.RATE_TENANT_PER_HOUR", 100)

    payload = {
        "name": "Rate Uno", "email": "rate1@test.com", "phone": None,
        "message": "Quiero información sobre un piso en Madrid",
    }
    assert client.post("/qualify-lead", json=payload).status_code == 200
    r2 = client.post("/qualify-lead", json={**payload, "email": "rate2@test.com"})
    assert r2.status_code == 429
