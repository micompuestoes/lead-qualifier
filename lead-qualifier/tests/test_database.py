"""
Tests de core.database: alta de tenants y autocompletado de email.

Cubre el bug donde `ensure_tenant()` se llamaba siempre sin email y las
cuentas se quedaban con "Email de acceso" y el email de notificaciones
vacíos para siempre (ver deps.py: get_caller ahora sí pasa el email).
"""

from core.database import ensure_tenant, get_tenant, update_tenant_profile


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
