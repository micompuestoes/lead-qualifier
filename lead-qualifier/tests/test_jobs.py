"""
Tests del lock de jobs del scheduler: con varias instancias, solo la primera
que reclama un (job, periodo) lo ejecuta; el resto se retira sin duplicar
emails a los clientes.
"""

from core.database import acquire_job_lock


def test_job_lock_solo_gana_la_primera_instancia(client):
    assert acquire_job_lock("resumen_semanal", "2026-W99") is True
    # Otra instancia (u otro worker) llega después → no ejecuta
    assert acquire_job_lock("resumen_semanal", "2026-W99") is False


def test_job_lock_por_periodo_y_por_job(client):
    # Un periodo nuevo del mismo job sí se ejecuta
    assert acquire_job_lock("seguimientos", "2099-01-01") is True
    assert acquire_job_lock("seguimientos", "2099-01-02") is True
    # Y otro job en el mismo periodo no interfiere
    assert acquire_job_lock("leads_sin_contactar", "2099-01-01") is True
