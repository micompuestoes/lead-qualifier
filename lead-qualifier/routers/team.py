"""Gestión del equipo del tenant (plan agencia)."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.database import add_team_member, get_owner_for_member, get_team_members, remove_team_member
from deps import get_tenant_id, require_plan
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
    """Añade un miembro al equipo por su Clerk user_id — solo plan agencia."""
    require_plan(tenant_id, "agencia")
    if body.member_id == tenant_id:
        raise HTTPException(status_code=400, detail="No puedes añadirte a ti mismo")
    # Verificar que el member_id no sea ya propietario de otra cuenta
    existing_owner = get_owner_for_member(body.member_id)
    if existing_owner and existing_owner != tenant_id:
        raise HTTPException(status_code=409, detail="Este usuario ya pertenece a otro equipo")
    from services.whatsapp import normalize_phone
    wa = normalize_phone(body.member_whatsapp) or "" if body.member_whatsapp.strip() else ""
    add_team_member(
        tenant_id, body.member_id, body.member_name.strip(),
        body.member_email.strip(), wa,
    )
    logger.info("Miembro %s añadido al equipo de %s", body.member_id, tenant_id)
    sync_agency_seats(tenant_id)   # +1 asiento facturable
    return {
        "ok": True, "member_id": body.member_id, "member_name": body.member_name.strip(),
        "member_email": body.member_email.strip(), "member_whatsapp": wa,
    }


@router.delete("/me/team/{member_id}", status_code=204)
async def eliminar_miembro(
    member_id: str,
    tenant_id: str = Depends(get_tenant_id),
):
    """Elimina un miembro del equipo — solo plan agencia."""
    require_plan(tenant_id, "agencia")
    remove_team_member(tenant_id, member_id)
    logger.info("Miembro %s eliminado del equipo de %s", member_id, tenant_id)
    sync_agency_seats(tenant_id)   # -1 asiento facturable
