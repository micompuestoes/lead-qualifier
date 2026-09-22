"""Gestión del equipo del tenant (plan agencia)."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.database import (
    accept_team_invite, add_team_member, decline_team_invite, get_owner_for_member,
    get_pending_invites_for_member, get_team_members, remove_team_member,
)
from deps import Caller, get_caller, get_tenant_id, require_plan
from routers.billing import sync_agency_seats

logger = logging.getLogger(__name__)

router = APIRouter(tags=["equipo"])


class TeamMemberInput(BaseModel):
    member_id: str
    member_name: str = ""
    member_email: str = ""
    member_whatsapp: str = ""


@router.get("/me/team")
async def listar_equipo(tenant_id: str = Depends(get_tenant_id)):
    """Lista los miembros del equipo del tenant — solo plan agencia."""
    require_plan(tenant_id, "agencia")
    members = get_team_members(tenant_id)
    return {"members": members, "total": len(members)}


@router.post("/me/team", status_code=201)
async def agregar_miembro(
    body: TeamMemberInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Invita a un miembro al equipo por su Clerk user_id — solo plan agencia.
    Queda 'pending': no se vincula la cuenta del invitado hasta que él mismo
    la acepte desde /me/team/invites (ver accept_team_invite). El asiento
    solo se factura cuando acepta.
    """
    require_plan(tenant_id, "agencia")
    if body.member_id == tenant_id:
        raise HTTPException(status_code=400, detail="No puedes añadirte a ti mismo")
    # Verificar que el member_id no sea ya miembro ACTIVO de otra cuenta
    existing_owner = get_owner_for_member(body.member_id)
    if existing_owner and existing_owner != tenant_id:
        raise HTTPException(status_code=409, detail="Este usuario ya pertenece a otro equipo")
    from services.whatsapp import normalize_phone
    wa = normalize_phone(body.member_whatsapp) or "" if body.member_whatsapp.strip() else ""
    add_team_member(
        tenant_id, body.member_id, body.member_name.strip(),
        body.member_email.strip(), wa,
    )
    logger.info("Invitación enviada a %s para el equipo de %s", body.member_id, tenant_id)
    return {
        "ok": True, "status": "pending", "member_id": body.member_id,
        "member_name": body.member_name.strip(),
        "member_email": body.member_email.strip(), "member_whatsapp": wa,
    }


@router.delete("/me/team/{member_id}", status_code=204)
async def eliminar_miembro(
    member_id: str,
    tenant_id: str = Depends(get_tenant_id),
):
    """Elimina un miembro (o cancela una invitación pendiente) — solo plan agencia."""
    require_plan(tenant_id, "agencia")
    remove_team_member(tenant_id, member_id)
    logger.info("Miembro/invitación %s eliminado del equipo de %s", member_id, tenant_id)
    sync_agency_seats(tenant_id)   # -1 asiento facturable si era activo


@router.get("/me/team/invites")
async def listar_invitaciones(caller: Caller = Depends(get_caller)):
    """Invitaciones de equipo pendientes de aceptar/rechazar por el usuario autenticado."""
    return {"invites": get_pending_invites_for_member(caller.user_id)}


@router.post("/me/team/invites/{owner_id}/accept")
async def aceptar_invitacion(owner_id: str, caller: Caller = Depends(get_caller)):
    """
    El usuario autenticado acepta unirse al equipo de owner_id. Este es el
    único paso que de verdad vincula su cuenta — sin su acción explícita,
    una invitación 'pending' no tiene ningún efecto sobre él.
    """
    ok = accept_team_invite(owner_id, caller.user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="No hay ninguna invitación pendiente de esa agencia")
    sync_agency_seats(owner_id)   # +1 asiento facturable, ahora que es real
    logger.info("%s aceptó la invitación de equipo de %s", caller.user_id, owner_id)
    return {"ok": True, "tenant_id": owner_id}


@router.post("/me/team/invites/{owner_id}/decline")
async def rechazar_invitacion(owner_id: str, caller: Caller = Depends(get_caller)):
    """El usuario autenticado rechaza la invitación de owner_id."""
    ok = decline_team_invite(owner_id, caller.user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="No hay ninguna invitación pendiente de esa agencia")
    return {"ok": True}


@router.delete("/me/membership", status_code=204)
async def salir_del_equipo(caller: Caller = Depends(get_caller)):
    """
    El miembro autenticado abandona el equipo del que forma parte — antes no
    existía ninguna forma de autoservicio para esto: solo el dueño del
    equipo (o alguien con acceso de admin) podía revertir una vinculación.
    """
    if caller.is_owner:
        raise HTTPException(status_code=400, detail="No perteneces al equipo de otra agencia")
    remove_team_member(caller.tenant_id, caller.user_id)
    sync_agency_seats(caller.tenant_id)
    logger.info("%s abandonó el equipo de %s", caller.user_id, caller.tenant_id)
