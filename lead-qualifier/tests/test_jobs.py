"""
Tests del lock de jobs del scheduler: con varias instancias, solo la primera
que reclama un (job, periodo) lo ejecuta; el resto se retira sin duplicar
emails a los clientes.
"""

from datetime import datetime, timedelta, timezone

from core.database import acquire_job_lock, ensure_tenant, get_notifications
from jobs import _alertar_imap_caido_si_procede


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


# ── Aviso de sync IMAP caído (bug real de auditoría: antes era silencioso) ────

def test_alerta_imap_caido_tras_umbral_y_no_se_repite(client):
    ensure_tenant("agencia-imap-1", "o@test.com", "Agencia IMAP")
    from core.database import engine
    from sqlalchemy import text
    hace_mucho = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE tenants SET imap_last_sync = :ts WHERE id = :id"),
            {"ts": hace_mucho, "id": "agencia-imap-1"},
        )

    _alertar_imap_caido_si_procede("agencia-imap-1")
    notifs = get_notifications("agencia-imap-1")
    assert any(n["type"] == "imap_sync_error" for n in notifs)

    # Un segundo fallo poco después NO duplica el aviso.
    _alertar_imap_caido_si_procede("agencia-imap-1")
    assert len([n for n in get_notifications("agencia-imap-1") if n["type"] == "imap_sync_error"]) == 1


def test_sin_alerta_imap_si_sincronizo_hace_poco(client):
    ensure_tenant("agencia-imap-2", "o2@test.com", "Agencia IMAP 2")
    from core.database import engine
    from sqlalchemy import text
    hace_poco = datetime.now(timezone.utc).isoformat()
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE tenants SET imap_last_sync = :ts WHERE id = :id"),
            {"ts": hace_poco, "id": "agencia-imap-2"},
        )

    _alertar_imap_caido_si_procede("agencia-imap-2")
    assert get_notifications("agencia-imap-2") == []
