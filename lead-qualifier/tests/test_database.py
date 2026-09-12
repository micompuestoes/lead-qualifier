"""
Tests de core.database: alta de tenants y autocompletado de email.

Cubre el bug donde `ensure_tenant()` se llamaba siempre sin email y las
cuentas se quedaban con "Email de acceso" y el email de notificaciones
vacíos para siempre (ver deps.py: get_caller ahora sí pasa el email).
"""

import uuid

from core.database import (
    ensure_tenant, get_ai_cost_this_month, get_feedback_stats, get_tenant,
    is_duplicate_lead, save_lead, set_lead_feedback, update_tenant_profile,
)


def test_ensure_tenant_crea_con_email(client):
    ensure_tenant("tenant-nuevo-1", "nuevo@test.com", "Agencia Nueva")
    t = get_tenant("tenant-nuevo-1")
    assert t["email"] == "nuevo@test.com"
    assert t["notify_email"] == "nuevo@test.com"


def test_ensure_tenant_autocompleta_email_si_estaba_vacio(client):
    # Cuenta creada sin email (como pasaba antes de que get_caller lo pasara).
    ensure_tenant("tenant-sin-email", "", "")
    assert (get_tenant("tenant-sin-email").get("email") or "") == ""

    # La primera vez que llega un email real (p. ej. el siguiente login), se
    # autocompleta tanto el email de la cuenta como el de notificaciones.
    ensure_tenant("tenant-sin-email", "luego@test.com")
    t = get_tenant("tenant-sin-email")
    assert t["email"] == "luego@test.com"
    assert t["notify_email"] == "luego@test.com"


def test_ensure_tenant_no_pisa_email_ya_existente(client):
    ensure_tenant("tenant-con-email", "original@test.com")
    ensure_tenant("tenant-con-email", "otro@test.com")
    assert get_tenant("tenant-con-email")["email"] == "original@test.com"


def test_ensure_tenant_autocompleta_email_sin_pisar_notify_personalizado(client):
    # El dueño ya había configurado un email de notificaciones distinto al de
    # acceso (p. ej. el buzón compartido de la agencia) antes de que su cuenta
    # tuviera email guardado: el autocompletado no debe sobrescribirlo.
    ensure_tenant("tenant-notify-custom", "", "")
    update_tenant_profile("tenant-notify-custom", "Agencia", "buzon@agencia.com")

    ensure_tenant("tenant-notify-custom", "dueno@test.com")
    t = get_tenant("tenant-notify-custom")
    assert t["email"] == "dueno@test.com"
    assert t["notify_email"] == "buzon@agencia.com"


def _guardar_lead(tenant_id, email, message, classification="TIBIO", score=5, **extra):
    lid = str(uuid.uuid4())
    save_lead(
        lead_id=lid, tenant_id=tenant_id, name="Test", email=email, phone=None,
        message=message, classification=classification, score=score, reasoning="r",
        generated_email="x", recommended_actions=[], intent_analysis={}, company_info={},
        email_sent=1, **extra,
    )
    return lid


# ── Anti-doble-envío ───────────────────────────────────────────────────────────

def test_is_duplicate_lead_detecta_mismo_email_y_mensaje(client):
    _guardar_lead("tenant-dedupe", "dup@test.com", "Busco piso en Valencia")
    assert is_duplicate_lead("tenant-dedupe", "dup@test.com", "Busco piso en Valencia") is True
    # Mensaje distinto → no es duplicado
    assert is_duplicate_lead("tenant-dedupe", "dup@test.com", "Otro mensaje distinto") is False
    # Mismo mensaje pero otro tenant → no es duplicado (aislamiento multi-tenant)
    assert is_duplicate_lead("otro-tenant", "dup@test.com", "Busco piso en Valencia") is False


def test_is_duplicate_lead_fuera_de_ventana_no_cuenta(client):
    _guardar_lead("tenant-dedupe-2", "viejo@test.com", "mensaje repetido")
    # Ventana de 0 segundos: el lead recién guardado ya queda "fuera" de rango
    assert is_duplicate_lead("tenant-dedupe-2", "viejo@test.com", "mensaje repetido", window_seconds=0) is False


# ── Estadísticas de feedback (acierto/fallo del scoring) ───────────────────────

def test_get_feedback_stats_agrega_por_clasificacion(client):
    l1 = _guardar_lead("tenant-feedback", "a@test.com", "m1", classification="CALIENTE")
    l2 = _guardar_lead("tenant-feedback", "b@test.com", "m2", classification="CALIENTE")
    l3 = _guardar_lead("tenant-feedback", "c@test.com", "m3", classification="TIBIO")

    set_lead_feedback(l1, "tenant-feedback", 1)
    set_lead_feedback(l2, "tenant-feedback", -1)
    set_lead_feedback(l3, "tenant-feedback", 1)

    stats = get_feedback_stats("tenant-feedback")
    assert stats["por_clasificacion"]["CALIENTE"] == {"aciertos": 1, "fallos": 1}
    assert stats["por_clasificacion"]["TIBIO"] == {"aciertos": 1, "fallos": 0}
    assert stats["total_valorados"] == 3
    assert stats["precision"] == 0.67


def test_get_feedback_stats_sin_valoraciones_da_precision_none(client):
    stats = get_feedback_stats("tenant-sin-feedback-alguno")
    assert stats["total_valorados"] == 0
    assert stats["precision"] is None


# ── Coste de IA por tenant ──────────────────────────────────────────────────────

def test_get_ai_cost_this_month_suma_tokens_y_coste(client):
    _guardar_lead("tenant-coste", "x@test.com", "m1", input_tokens=1000, output_tokens=200, ai_cost_usd=0.006)
    _guardar_lead("tenant-coste", "y@test.com", "m2", input_tokens=500, output_tokens=100, ai_cost_usd=0.003)
    # Un lead sin IA (fallback, o capturado sin cualificar) no debe contarse.
    _guardar_lead("tenant-coste", "z@test.com", "m3")

    coste = get_ai_cost_this_month("tenant-coste")
    assert coste["leads_con_ia"] == 2
    assert coste["input_tokens"] == 1500
    assert coste["output_tokens"] == 300
    assert coste["coste_usd"] == 0.009
