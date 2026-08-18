"""Endpoints de administración, protegidos por la cabecera X-Admin-Key."""

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.database import (
    admin_override_plan, count_leads_for_tenant, get_all_tenants, get_tenant,
    set_tenant_status,
)
from deps import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

EstadoTenantLiteral = Literal["active", "cancelled"]
PlanTenantLiteral = Literal["free", "pro", "agencia"]


class ActualizarEstadoTenantInput(BaseModel):
    status: EstadoTenantLiteral


class ActualizarPlanTenantInput(BaseModel):
    plan: PlanTenantLiteral


@router.get("/tenants")
async def admin_list_tenants(request: Request):
    """
    Lista todos los tenants con su estado y número de leads.
    Requiere cabecera: X-Admin-Key: <ADMIN_SECRET_KEY>
    """
    require_admin(request)

    tenants = get_all_tenants()
    resultado = []
    for t in tenants:
        t["lead_count"] = count_leads_for_tenant(t["id"])
        resultado.append(t)

    activos    = sum(1 for t in resultado if t.get("status") == "active")
    cancelados = sum(1 for t in resultado if t.get("status") == "cancelled")

    return {
        "total": len(resultado),
        "activos": activos,
        "cancelados": cancelados,
        "tenants": resultado,
    }


@router.get("/tenants/{tenant_id}")
async def admin_get_tenant(tenant_id: str, request: Request):
    """Detalle de un tenant concreto. Requiere X-Admin-Key."""
    require_admin(request)

    tenant = get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant {tenant_id} no encontrado")

    tenant["lead_count"] = count_leads_for_tenant(tenant_id)
    return tenant


@router.patch("/tenants/{tenant_id}/status")
async def admin_set_tenant_status(
    tenant_id: str,
    body: ActualizarEstadoTenantInput,
    request: Request,
):
    """
    Activa o cancela un tenant.
    - 'cancelled': bloquea acceso pero conserva todos sus leads.
    - 'active':    reactiva la cuenta, sus leads siguen intactos.
    Requiere X-Admin-Key.
    """
    require_admin(request)

    tenant = get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant {tenant_id} no encontrado")

    set_tenant_status(tenant_id, body.status)
    logger.info("Admin: tenant %s → %s", tenant_id, body.status)

    actualizado = get_tenant(tenant_id)
    actualizado["lead_count"] = count_leads_for_tenant(tenant_id)
    return actualizado


@router.patch("/tenants/{tenant_id}/plan")
async def admin_set_tenant_plan(
    tenant_id: str,
    body: ActualizarPlanTenantInput,
    request: Request,
):
    """
    Cambia el plan de un tenant a mano (free/pro/agencia).
    Red de seguridad para cuando el webhook de Stripe falla o no llega: permite
    corregir el plan sin tocar la vinculación con Stripe (no borra los IDs de
    suscripción/cliente). Requiere X-Admin-Key.
    """
    require_admin(request)

    tenant = get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant {tenant_id} no encontrado")

    admin_override_plan(tenant_id, body.plan)
    logger.info("Admin: tenant %s → plan %s (override manual)", tenant_id, body.plan)

    actualizado = get_tenant(tenant_id)
    actualizado["lead_count"] = count_leads_for_tenant(tenant_id)
    return actualizado
