"""
Tests del valor de operaciones cerradas por periodo (semana/mes/año/siempre):
closed_at se fija solo al entrar en CERRADO, se limpia al salir, y el
endpoint /stats/deal-value filtra correctamente por periodo de calendario.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from core.database import (
    engine, get_closed_deals_value, get_lead_by_id, save_lead,
    set_tenant_plan, update_lead_status,
)

T = "dev-tenant"


def _semilla(lid, name="Lead Test"):
    save_lead(lead_id=lid, tenant_id=T, name=name, email=f"{lid}@test.com", phone=None,
              message="m", classification="CALIENTE", score=8, reasoning="r",
              generated_email="x", recommended_actions=[], intent_analysis={},
              company_info={}, email_sent=1)


def _forzar_closed_at(lead_id, iso):
    with engine.begin() as conn:
        conn.execute(text("UPDATE leads SET closed_at = :ca WHERE id = :id"), {"ca": iso, "id": lead_id})


def test_closed_at_se_fija_al_entrar_en_cerrado_y_se_limpia_al_salir(client):
    _semilla("CA1")
    update_lead_status("CA1", "CERRADO", tenant_id=T, deal_value=1000)
    lead = get_lead_by_id("CA1", tenant_id=T)
    assert lead["closed_at"] is not None
    primer_cierre = lead["closed_at"]

    # Re-guardar mientras sigue CERRADO (p. ej. editar el importe) no mueve la fecha
    update_lead_status("CA1", "CERRADO", tenant_id=T, deal_value=2000)
    lead = get_lead_by_id("CA1", tenant_id=T)
    assert lead["closed_at"] == primer_cierre
    assert lead["deal_value"] == 2000

    # Salir de CERRADO limpia closed_at
    update_lead_status("CA1", "CONTACTADO", tenant_id=T)
    lead = get_lead_by_id("CA1", tenant_id=T)
    assert lead["closed_at"] is None


def test_get_closed_deals_value_filtra_por_periodo():
    _semilla("CA2")
    _semilla("CA3")
    update_lead_status("CA2", "CERRADO", tenant_id=T, deal_value=100000)
    update_lead_status("CA3", "CERRADO", tenant_id=T, deal_value=50000)

    # CA3 se cerró hace más de un año — no debe contar en "año actual"
    hace_2_anos = (datetime.now(timezone.utc) - timedelta(days=800)).isoformat()
    _forzar_closed_at("CA3", hace_2_anos)

    inicio_ano = datetime.now(timezone.utc).replace(
        month=1, day=1, hour=0, minute=0, second=0, microsecond=0,
    ).isoformat()
    resultado = get_closed_deals_value(T, since=inicio_ano)
    assert resultado["total_value"] >= 100000
    assert resultado["total_value"] < 150000  # CA3 no debe sumar aquí

    total_siempre = get_closed_deals_value(T)
    assert total_siempre["total_value"] >= 150000  # sin filtro, cuentan las dos


def test_endpoint_stats_deal_value_respeta_plan_y_periodos(client):
    set_tenant_plan(T, "free")
    assert client.get("/stats/deal-value").status_code == 403

    set_tenant_plan(T, "agencia")
    for periodo in ("semana", "mes", "año", "siempre"):
        r = client.get("/stats/deal-value", params={"periodo": periodo})
        assert r.status_code == 200
        body = r.json()
        assert "total_value" in body and "count" in body

    assert client.get("/stats/deal-value", params={"periodo": "invalido"}).status_code == 422
