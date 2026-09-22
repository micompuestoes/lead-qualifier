"""
Invitaciones de equipo: bug crítico de auditoría corregido.

Antes, POST /me/team vinculaba la cuenta del member_id indicado de forma
INMEDIATA, sin ningún consentimiento del invitado — bastaba con conocer su
user_id de Clerk (que no es secreto: aparece en JWTs, en su propio panel...)
para secuestrar su acceso (dejaba de ver sus propios leads, sin ningún
endpoint de autoservicio para revertirlo). Ahora una invitación queda
'pending' y solo cuenta como miembro real (tenant, reparto, facturación)
tras aceptar explícitamente.

Los tests que necesitan "ser" el invitado usan las funciones de BD
directamente (impersonar un user_id distinto de dev-tenant por HTTP exigiría
un JWT real de Clerk — mismo patrón que el resto de tests de equipo en
test_api.py). Los endpoints HTTP se prueban con dev-tenant como INVITADO
(alguien más lo invita) usando solo acciones que no cambian su identidad
para el resto de la sesión de tests (listar, rechazar) — nunca `accept` por
HTTP, que sí la cambiaría.
"""

from core.database import (
    accept_team_invite, add_team_member, decline_team_invite, ensure_tenant,
    get_agent_ids, get_owner_for_member, get_pending_invites_for_member,
    get_team_members, remove_team_member,
)

T = "dev-tenant"


def test_invitacion_pendiente_no_vincula_hasta_aceptar():
    ensure_tenant("agencia-inv-1", "owner1@test.com", "Agencia Uno")
    add_team_member("agencia-inv-1", "user-inv-1", "Invitado Uno", "u1@test.com", "")

    # Pendiente de aceptar: NO vincula todavía.
    assert get_owner_for_member("user-inv-1") is None
    miembros = get_team_members("agencia-inv-1")
    assert any(m["member_id"] == "user-inv-1" and m["status"] == "pending" for m in miembros)
    assert "user-inv-1" not in get_agent_ids("agencia-inv-1")

    assert accept_team_invite("agencia-inv-1", "user-inv-1") is True
    assert get_owner_for_member("user-inv-1") == "agencia-inv-1"
    assert "user-inv-1" in get_agent_ids("agencia-inv-1")

    # Aceptar otra vez no repite el efecto (no queda invitación pendiente).
    assert accept_team_invite("agencia-inv-1", "user-inv-1") is False


def test_aceptar_descarta_otras_invitaciones_pendientes():
    ensure_tenant("agencia-inv-a", "a@test.com", "Agencia A")
    ensure_tenant("agencia-inv-b", "b@test.com", "Agencia B")
    add_team_member("agencia-inv-a", "user-inv-2", "", "", "")
    add_team_member("agencia-inv-b", "user-inv-2", "", "", "")

    pendientes = {i["owner_id"] for i in get_pending_invites_for_member("user-inv-2")}
    assert pendientes == {"agencia-inv-a", "agencia-inv-b"}

    assert accept_team_invite("agencia-inv-a", "user-inv-2") is True
    # No se puede estar activo en dos equipos: la otra invitación desaparece.
    assert get_pending_invites_for_member("user-inv-2") == []
    assert get_owner_for_member("user-inv-2") == "agencia-inv-a"


def test_rechazar_invitacion():
    ensure_tenant("agencia-inv-3", "o3@test.com", "Agencia Tres")
    add_team_member("agencia-inv-3", "user-inv-3", "", "", "")

    assert decline_team_invite("agencia-inv-3", "user-inv-3") is True
    assert get_pending_invites_for_member("user-inv-3") == []
    assert get_owner_for_member("user-inv-3") is None
    # No queda nada que rechazar dos veces.
    assert decline_team_invite("agencia-inv-3", "user-inv-3") is False


def test_miembro_pendiente_no_cuenta_para_reparto_ni_asientos():
    ensure_tenant("agencia-inv-4", "o4@test.com", "Agencia Cuatro")
    add_team_member("agencia-inv-4", "user-inv-4a", "", "", "")
    add_team_member("agencia-inv-4", "user-inv-4b", "", "", "")
    # Ninguna aceptada todavía: solo el dueño cuenta como agente.
    assert get_agent_ids("agencia-inv-4") == ["agencia-inv-4"]

    accept_team_invite("agencia-inv-4", "user-inv-4a")
    agentes = get_agent_ids("agencia-inv-4")
    assert set(agentes) == {"agencia-inv-4", "user-inv-4a"}   # 4b sigue pending, no cuenta


def test_eliminar_miembro_cancela_invitacion_pendiente():
    ensure_tenant("agencia-inv-5", "o5@test.com", "Agencia Cinco")
    add_team_member("agencia-inv-5", "user-inv-5", "", "", "")
    assert get_pending_invites_for_member("user-inv-5") != []

    remove_team_member("agencia-inv-5", "user-inv-5")
    assert get_pending_invites_for_member("user-inv-5") == []
    assert get_owner_for_member("user-inv-5") is None


# ── Endpoints HTTP — dev-tenant como INVITADO (nunca `accept`: cambiaría su
#    identidad para el resto de la sesión de tests) ────────────────────────

def test_endpoint_listar_y_rechazar_invitacion(client):
    ensure_tenant("agencia-inv-http", "oh@test.com", "Agencia HTTP")
    add_team_member("agencia-inv-http", T, "", "", "")

    r = client.get("/me/team/invites")
    assert r.status_code == 200
    assert any(i["owner_id"] == "agencia-inv-http" for i in r.json()["invites"])

    r = client.post("/me/team/invites/agencia-inv-http/decline")
    assert r.status_code == 200 and r.json()["ok"] is True

    r = client.get("/me/team/invites")
    assert not any(i["owner_id"] == "agencia-inv-http" for i in r.json()["invites"])

    # Ya no hay nada que rechazar: 404.
    assert client.post("/me/team/invites/agencia-inv-http/decline").status_code == 404
    assert client.post("/me/team/invites/agencia-inv-http/accept").status_code == 404


def test_endpoint_salir_del_equipo_solo_para_no_propietarios(client):
    # dev-tenant es siempre is_owner=True en modo dev: no puede "salir" de su
    # propia cuenta con este endpoint.
    r = client.delete("/me/membership")
    assert r.status_code == 400
