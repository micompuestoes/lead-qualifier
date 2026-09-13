"""
Tests de los recordatorios de seguimiento por lead: CRUD vía API, aislamiento
por tenant/lead, y la consulta de "tareas de hoy" (get_pending_reminders).
"""

from datetime import date, timedelta

from core.database import save_lead

T = "dev-tenant"


def _semilla_lead(lid, name="Lead Test"):
    save_lead(lead_id=lid, tenant_id=T, name=name, email=f"{lid}@test.com", phone=None,
              message="m", classification="CALIENTE", score=8, reasoning="r",
              generated_email="x", recommended_actions=[], intent_analysis={},
              company_info={}, email_sent=1)


def test_crear_listar_y_completar_recordatorio(client):
    _semilla_lead("R1")
    manana = (date.today() + timedelta(days=1)).isoformat()

    r = client.post("/leads/R1/reminders", json={"note": "Llamar mañana", "due_date": manana})
    assert r.status_code == 201
    body = r.json()
    assert body["note"] == "Llamar mañana"
    assert body["due_date"] == manana
    assert body["done"] is False
    rid = body["id"]

    r = client.get("/leads/R1/reminders")
    assert r.status_code == 200
    assert len(r.json()) == 1

    # Marcar como hecho
    r = client.patch(f"/reminders/{rid}", json={"done": True})
    assert r.status_code == 200
    assert r.json()["done"] is True

    # Un lead que no existe (o no es de este tenant) da 404, no un recordatorio fantasma
    assert client.post(
        "/leads/no-existe/reminders", json={"note": "x", "due_date": manana}
    ).status_code == 404


def test_recordatorios_pendientes_de_hoy_filtra_por_fecha_y_estado(client):
    _semilla_lead("R2", "Lead Hoy")
    hoy = date.today().isoformat()
    ayer = (date.today() - timedelta(days=1)).isoformat()
    manana = (date.today() + timedelta(days=1)).isoformat()

    r_vencido = client.post("/leads/R2/reminders", json={"note": "Vencido", "due_date": ayer}).json()
    client.post("/leads/R2/reminders", json={"note": "De hoy", "due_date": hoy})
    client.post("/leads/R2/reminders", json={"note": "Futuro", "due_date": manana})

    pendientes = client.get("/reminders/pending").json()
    notas = {r["note"] for r in pendientes}
    assert "Vencido" in notas
    assert "De hoy" in notas
    assert "Futuro" not in notas  # aún no vence, no debe aparecer como tarea de hoy
    assert all(r["lead_name"] == "Lead Hoy" for r in pendientes)

    # Al completarlo, desaparece de pendientes
    client.patch(f"/reminders/{r_vencido['id']}", json={"done": True})
    pendientes = client.get("/reminders/pending").json()
    assert "Vencido" not in {r["note"] for r in pendientes}


def test_editar_y_eliminar_recordatorio(client):
    _semilla_lead("R3")
    hoy = date.today().isoformat()
    rid = client.post("/leads/R3/reminders", json={"note": "Nota original", "due_date": hoy}).json()["id"]

    r = client.patch(f"/reminders/{rid}", json={"note": "Nota editada"})
    assert r.status_code == 200
    assert r.json()["note"] == "Nota editada"
    assert r.json()["due_date"] == hoy  # no se toca lo que no se manda

    r = client.delete(f"/reminders/{rid}")
    assert r.status_code == 204
    assert client.patch(f"/reminders/{rid}", json={"done": True}).status_code == 404


def test_recordatorio_rechaza_nota_vacia(client):
    _semilla_lead("R4")
    hoy = date.today().isoformat()
    r = client.post("/leads/R4/reminders", json={"note": "", "due_date": hoy})
    assert r.status_code == 422
