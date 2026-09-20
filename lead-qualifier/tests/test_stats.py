"""
Test del endpoint general GET /stats: gate de plan y presencia/forma de la
sección `feedback` (precisión de la IA reportada por el agente vía 👍/👎),
que ya calculaba `get_feedback_stats` en el backend pero que hasta ahora
no consumía ningún cliente — quedaba huérfana.
"""

from core.database import save_lead, set_lead_feedback, set_tenant_plan

T = "dev-tenant"


def _semilla(lid, classification="CALIENTE"):
    save_lead(lead_id=lid, tenant_id=T, name="Lead Test", email=f"{lid}@test.com", phone=None,
              message="m", classification=classification, score=8, reasoning="r",
              generated_email="x", recommended_actions=[], intent_analysis={},
              company_info={}, email_sent=1)


def test_stats_requiere_plan_agencia(client):
    set_tenant_plan(T, "free")
    assert client.get("/stats").status_code == 403
    set_tenant_plan(T, "agencia")


def test_stats_incluye_precision_de_feedback(client):
    set_tenant_plan(T, "agencia")
    _semilla("ST1", "CALIENTE")
    _semilla("ST2", "CALIENTE")
    set_lead_feedback("ST1", T, 1)   # acierto
    set_lead_feedback("ST2", T, -1)  # fallo

    body = client.get("/stats").json()
    assert "feedback" in body

    fb = body["feedback"]
    assert fb["total_valorados"] >= 2
    assert fb["precision"] is not None
    assert "CALIENTE" in fb["por_clasificacion"]
    assert fb["por_clasificacion"]["CALIENTE"]["aciertos"] >= 1
    assert fb["por_clasificacion"]["CALIENTE"]["fallos"] >= 1


def test_stats_feedback_sin_valoraciones_da_precision_nula(client):
    set_tenant_plan(T, "agencia")
    body = client.get("/stats").json()
    fb = body["feedback"]
    if fb["total_valorados"] == 0:
        assert fb["precision"] is None
