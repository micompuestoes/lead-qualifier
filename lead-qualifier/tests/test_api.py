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
    get_lead_by_id, get_recent_leads, get_tenant, save_lead, set_tenant_plan,
    update_lead_status,
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


def test_qualify_en_modo_automatico(client):
    client.post("/me/ai-settings", json={"auto_send": True, "brand_voice": "", "followup_enabled": False})
    r = client.post("/qualify-lead", json={
        "name": "Auto Uno", "email": "a1@test.com", "phone": None,
        "message": "Quiero vender mi piso en Sevilla",
    })
    assert r.status_code == 200 and r.json()["email_sent"] is True
    assert get_lead_by_id(r.json()["lead_id"], T)["email_sent"] == 1


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
