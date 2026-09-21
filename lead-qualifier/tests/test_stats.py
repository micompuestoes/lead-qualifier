"""
Test del endpoint general GET /stats: gate de plan y presencia/forma de la
sección `feedback` (precisión de la IA reportada por el agente vía 👍/👎),
que ya calculaba `get_feedback_stats` en el backend pero que hasta ahora
no consumía ningún cliente — quedaba huérfana.
"""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import text

from core.database import (
    engine, save_lead, set_lead_feedback, set_tenant_plan, update_lead_status,
)

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


def test_stats_incluye_desglose_por_fuente(client):
    """
    Bug/carencia real de auditoría: `source` (formulario/email/api) se guarda
    en cada lead desde el principio pero ningún endpoint lo agregaba — "qué
    canal convierte mejor" se calculaba y se tiraba.
    """
    set_tenant_plan(T, "agencia")
    save_lead(lead_id="SF1", tenant_id=T, name="L1", email="sf1@test.com", phone=None,
              message="m", classification="CALIENTE", score=9, reasoning="r",
              generated_email="x", recommended_actions=[], intent_analysis={},
              company_info={}, email_sent=1, source="formulario")
    save_lead(lead_id="SF2", tenant_id=T, name="L2", email="sf2@test.com", phone=None,
              message="m", classification="FRÍO", score=2, reasoning="r",
              generated_email="x", recommended_actions=[], intent_analysis={},
              company_info={}, email_sent=1, source="formulario")
    save_lead(lead_id="SF3", tenant_id=T, name="L3", email="sf3@test.com", phone=None,
              message="m", classification="CALIENTE", score=8, reasoning="r",
              generated_email="x", recommended_actions=[], intent_analysis={},
              company_info={}, email_sent=1, source="email")

    body = client.get("/stats").json()
    assert "por_fuente" in body
    fuente = body["por_fuente"]
    assert fuente["formulario"]["total"] >= 2
    assert fuente["formulario"]["calientes"] >= 1
    assert fuente["email"]["total"] >= 1
    assert fuente["email"]["calientes"] >= 1


def test_stats_incluye_embudo_de_conversion_y_tiempo_de_cierre(client):
    """
    Carencia real de auditoría: nada calculaba "de los leads CALIENTE,
    cuántos se cierran de verdad" ni "cuánto se tarda en cerrar" — la
    pregunta que un dueño de agencia paga el plan Agencia por poder
    responder, con datos (classification, status, created_at, closed_at)
    que ya existían.
    """
    set_tenant_plan(T, "agencia")
    save_lead(lead_id="CV1", tenant_id=T, name="L1", email="cv1@test.com", phone=None,
              message="m", classification="CALIENTE", score=9, reasoning="r",
              generated_email="x", recommended_actions=[], intent_analysis={},
              company_info={}, email_sent=1)
    save_lead(lead_id="CV2", tenant_id=T, name="L2", email="cv2@test.com", phone=None,
              message="m", classification="CALIENTE", score=8, reasoning="r",
              generated_email="x", recommended_actions=[], intent_analysis={},
              company_info={}, email_sent=1)

    # CV1 se cierra: forzamos 4 días exactos entre creación y cierre.
    update_lead_status("CV1", "CERRADO", tenant_id=T, deal_value=1000)
    hace_4_dias = (datetime.now(timezone.utc) - timedelta(days=4)).isoformat()
    ahora = datetime.now(timezone.utc).isoformat()
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE leads SET created_at = :c, closed_at = :z WHERE id = 'CV1'"),
            {"c": hace_4_dias, "z": ahora},
        )

    body = client.get("/stats").json()
    assert "conversion" in body
    conv = body["conversion"]
    assert conv["calientes"] >= 2
    assert conv["calientes_cerrados"] >= 1
    assert conv["tasa_conversion"] is not None
    assert conv["tiempo_medio_cierre_dias"] is not None
    assert conv["tiempo_medio_cierre_dias"] >= 3.9  # ~4 días, con margen


def test_leaderboard_dueno_en_solitario_no_sale_a_cero(client):
    """
    Bug real de auditoría: sin equipo invitado, pick_next_agent nunca reparte
    (no hay a quién), así que assigned_to se queda NULL en todos los leads del
    dueño — su fila en el ranking salía siempre a cero (todo caía en
    "sin_asignar"), y el frontend ocultaba la sección entera al parecer vacía,
    pese a que Agencia ya cobra un mínimo de 2 asientos sin necesitar equipo.
    """
    set_tenant_plan(T, "agencia")
    save_lead(lead_id="LB1", tenant_id=T, name="L1", email="lb1@test.com", phone=None,
              message="m", classification="CALIENTE", score=9, reasoning="r",
              generated_email="x", recommended_actions=[], intent_analysis={},
              company_info={}, email_sent=1)

    body = client.get("/stats/agents").json()
    assert len(body["agents"]) == 1
    dueno = body["agents"][0]
    assert dueno["agent_id"] == T
    assert dueno["total"] >= 1
    assert body["sin_asignar"] == 0


def test_since_for_periodo_calcula_el_limite_en_hora_de_espana():
    """
    Bug real de auditoría: _since_for_periodo calculaba "inicio de mes/semana/
    año" con datetime.now(timezone.utc), así que en las primeras horas del
    día 1 en España (UTC+1/+2) el límite se quedaba todavía en el periodo
    anterior — el filtro "Mes" de Operaciones Cerradas podía excluir cierres
    de hoy mismo. El resultado (convertido de vuelta a hora de Madrid) debe
    caer justo en la medianoche del día 1, no una o dos horas más tarde.
    """
    from routers.stats import _since_for_periodo

    since = _since_for_periodo("mes")
    dt_madrid = datetime.fromisoformat(since).astimezone(ZoneInfo("Europe/Madrid"))
    assert (dt_madrid.day, dt_madrid.hour, dt_madrid.minute) == (1, 0, 0)

    assert _since_for_periodo("siempre") is None
