"""Endpoints de cualificación y gestión de leads."""

import json
import logging
from typing import Literal, Optional

import anthropic
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from config import FREE_LEAD_LIMIT
from core.agent import qualify_lead
from core.database import (
    assign_lead, delete_lead, ensure_tenant, get_agent_ids, get_lead_by_id,
    get_lead_count_this_month, get_lead_counts, get_leads_by_email,
    get_recent_leads, get_tenant, mark_lead_email_sent, set_lead_feedback,
    update_lead_status,
)
from deps import Caller, get_anthropic_client, get_caller, get_tenant_id, require_plan
from models import LeadInput, LeadOutput
from notifications import notificar_tenant
from services.email_sender import send_lead_response_email

logger = logging.getLogger(__name__)

router = APIRouter(tags=["leads"])

EstadoLiteral = Literal["PENDIENTE", "CONTACTADO", "CERRADO", "DESCARTADO"]


class ActualizarEstadoInput(BaseModel):
    status: EstadoLiteral


class AsignarLeadInput(BaseModel):
    agent_id: Optional[str] = None  # None → dejar sin asignar


class EnviarEmailInput(BaseModel):
    # None → enviar el borrador guardado tal cual; con texto → versión editada
    email_body: Optional[str] = None


class FeedbackInput(BaseModel):
    feedback: Optional[Literal["up", "down"]] = None  # None → borrar valoración


def _serializar_lead(lead: dict) -> dict:
    """Normaliza un lead para enviarlo al dashboard."""
    lead = dict(lead)
    lead.setdefault("status", "PENDIENTE")
    acciones = lead.get("recommended_actions")
    if isinstance(acciones, str):
        try:
            lead["recommended_actions"] = json.loads(acciones)
        except Exception:
            lead["recommended_actions"] = [acciones]
    return lead


@router.post("/qualify-lead", response_model=LeadOutput, status_code=200)
async def qualify_lead_endpoint(
    lead: LeadInput,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(get_tenant_id),
):
    """Procesa un lead entrante con el agente de IA."""
    logger.info("POST /qualify-lead — %s <%s> (tenant: %s)", lead.name, lead.email, tenant_id)

    # Garantizar que el tenant existe en la BD
    ensure_tenant(tenant_id)

    # Límite de leads para plan free
    tenant = get_tenant(tenant_id)
    if tenant and tenant.get("plan", "free") == "free":
        count = get_lead_count_this_month(tenant_id)
        if count >= FREE_LEAD_LIMIT:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "LEAD_LIMIT_REACHED",
                    "message": f"Has alcanzado el límite de {FREE_LEAD_LIMIT} leads del plan gratuito este mes.",
                    "upgrade_url": "/pricing",
                },
            )

    # Ajustes de respuesta del tenant: envío automático (o borrador) y voz de marca
    av = tenant.get("auto_send_email") if tenant else None
    auto_send = True if av is None else bool(av)
    brand_voice = (tenant.get("brand_voice") or None) if tenant else None

    try:
        client = get_anthropic_client()
        result = qualify_lead(
            name=lead.name,
            email=lead.email,
            phone=lead.phone,
            message=lead.message,
            anthropic_client=client,
            tenant_id=tenant_id,
            agency_name=tenant.get("name") if tenant else None,
            brand_voice=brand_voice,
            auto_send=auto_send,
        )

        # Envío y avisos en segundo plano: la respuesta HTTP no espera al SMTP.
        if auto_send:
            background_tasks.add_task(
                send_lead_response_email,
                lead_email=lead.email,
                lead_name=lead.name,
                generated_email_body=result["generated_email"],
                reply_to=(tenant.get("notify_email") or tenant.get("email")) if tenant else None,
                from_name=tenant.get("name") if tenant else None,
            )
        background_tasks.add_task(notificar_tenant, tenant_id, lead, result)

        return LeadOutput(**result)

    except anthropic.AuthenticationError:
        raise HTTPException(status_code=500, detail="API key de Anthropic inválida")
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Rate limit alcanzado. Intenta en unos segundos.")
    except Exception as e:
        logger.exception("Error al procesar lead: %s", str(e))
        raise HTTPException(status_code=500, detail="Error interno al procesar el lead")


@router.get("/leads")
async def list_leads(
    limit: int = 100,
    offset: int = 0,
    caller: Caller = Depends(get_caller),
):
    """
    Lista los leads, ordenados por fecha desc, con paginación.
    El dueño ve todos; un agente del equipo solo ve los suyos ("mis leads").
    """
    ensure_tenant(caller.tenant_id)
    if limit > 500:
        limit = 500
    if offset < 0:
        offset = 0
    agente = caller.agent_filter
    leads = get_recent_leads(limit, tenant_id=caller.tenant_id, offset=offset, agent_id=agente)
    counts = get_lead_counts(caller.tenant_id, agent_id=agente)
    return {
        "leads": [_serializar_lead(l) for l in leads],
        "total": counts["total"],
        "counts": counts,
        "scope": "mine" if agente else "all",
    }


@router.get("/leads/{lead_id}")
async def get_lead(
    lead_id: str,
    caller: Caller = Depends(get_caller),
):
    """Recupera un lead por ID (un agente solo accede a los suyos)."""
    lead = get_lead_by_id(lead_id, tenant_id=caller.tenant_id, agent_id=caller.agent_filter)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")
    return _serializar_lead(lead)


@router.patch("/leads/{lead_id}/status")
async def patch_lead_status(
    lead_id: str,
    body: ActualizarEstadoInput,
    caller: Caller = Depends(get_caller),
):
    """Actualiza el estado de un lead (un agente solo de los suyos)."""
    lead = get_lead_by_id(lead_id, tenant_id=caller.tenant_id, agent_id=caller.agent_filter)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")

    update_lead_status(lead_id, body.status, tenant_id=caller.tenant_id)
    logger.info("Lead %s → estado %s (tenant: %s)", lead_id, body.status, caller.tenant_id)

    actualizado = get_lead_by_id(lead_id, tenant_id=caller.tenant_id)
    return _serializar_lead(actualizado)


@router.patch("/leads/{lead_id}/assign")
async def patch_lead_assign(
    lead_id: str,
    body: AsignarLeadInput,
    caller: Caller = Depends(get_caller),
):
    """Asigna o reasigna un lead a un agente. Solo el dueño y solo en plan agencia."""
    require_plan(caller.tenant_id, "agencia")
    if not caller.is_owner:
        raise HTTPException(status_code=403, detail="Solo el responsable de la cuenta puede reasignar leads")

    lead = get_lead_by_id(lead_id, tenant_id=caller.tenant_id)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")

    # Validar que el agente pertenece al equipo (o None para desasignar)
    if body.agent_id is not None and body.agent_id not in get_agent_ids(caller.tenant_id):
        raise HTTPException(status_code=400, detail="El agente no pertenece a tu equipo")

    assign_lead(lead_id, tenant_id=caller.tenant_id, agent_id=body.agent_id)
    return _serializar_lead(get_lead_by_id(lead_id, tenant_id=caller.tenant_id))


@router.post("/leads/{lead_id}/send-email")
async def send_lead_email(
    lead_id: str,
    body: EnviarEmailInput,
    caller: Caller = Depends(get_caller),
):
    """
    Envía (o reenvía) el email de respuesta al lead, opcionalmente editado.
    Es el paso final del modo "revisar antes de enviar": el borrador generado
    por la IA se aprueba desde el dashboard.
    """
    lead = get_lead_by_id(lead_id, tenant_id=caller.tenant_id, agent_id=caller.agent_filter)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")

    texto = (body.email_body or "").strip() or (lead.get("generated_email") or "").strip()
    if not texto:
        raise HTTPException(status_code=400, detail="No hay ningún email que enviar para este lead")

    tenant = get_tenant(caller.tenant_id)
    enviado = send_lead_response_email(
        lead_email=lead["email"],
        lead_name=lead["name"],
        generated_email_body=texto,
        reply_to=(tenant.get("notify_email") or tenant.get("email")) if tenant else None,
        from_name=tenant.get("name") if tenant else None,
    )
    if not enviado:
        raise HTTPException(
            status_code=502,
            detail="No se pudo enviar el email. Revisa la configuración de correo del servidor.",
        )

    mark_lead_email_sent(lead_id, caller.tenant_id, body=texto)
    logger.info("Email del lead %s enviado manualmente (tenant: %s)", lead_id, caller.tenant_id)
    return _serializar_lead(get_lead_by_id(lead_id, tenant_id=caller.tenant_id))


@router.patch("/leads/{lead_id}/feedback")
async def patch_lead_feedback(
    lead_id: str,
    body: FeedbackInput,
    caller: Caller = Depends(get_caller),
):
    """Guarda la valoración del agente sobre la clasificación de la IA (👍/👎)."""
    lead = get_lead_by_id(lead_id, tenant_id=caller.tenant_id, agent_id=caller.agent_filter)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")

    valor = {"up": 1, "down": -1}.get(body.feedback) if body.feedback else None
    set_lead_feedback(lead_id, caller.tenant_id, valor)
    return _serializar_lead(get_lead_by_id(lead_id, tenant_id=caller.tenant_id))


@router.delete("/leads/{lead_id}", status_code=204)
async def delete_lead_endpoint(
    lead_id: str,
    caller: Caller = Depends(get_caller),
):
    """Elimina un lead (un agente solo los suyos)."""
    lead = get_lead_by_id(lead_id, tenant_id=caller.tenant_id, agent_id=caller.agent_filter)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")

    delete_lead(lead_id, tenant_id=caller.tenant_id)
    logger.info("Lead %s eliminado (tenant: %s)", lead_id, caller.tenant_id)


@router.get("/leads/by-email/{email}")
async def leads_by_email(
    email: str,
    caller: Caller = Depends(get_caller),
):
    """Historial de leads de un email (un agente solo los suyos)."""
    leads = get_leads_by_email(email, tenant_id=caller.tenant_id, agent_id=caller.agent_filter)
    return {"email": email, "total": len(leads), "leads": [_serializar_lead(l) for l in leads]}
