"""Perfil del tenant autenticado y notificaciones de sistema."""

import logging
import os

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.database import (
    count_unread_notifications, ensure_tenant, get_notifications, get_tenant,
    mark_notifications_read, update_tenant_profile,
)
from deps import get_tenant_id

logger = logging.getLogger(__name__)

router = APIRouter(tags=["perfil"])


class ActualizarPerfilInput(BaseModel):
    name: str
    notify_email: str


@router.get("/me")
async def get_my_profile(tenant_id: str = Depends(get_tenant_id)):
    """Devuelve el perfil del tenant autenticado (nombre, email, api_key, etc.)."""
    ensure_tenant(tenant_id)
    tenant = get_tenant(tenant_id)
    # No exponer campos sensibles innecesarios
    admin_id = os.getenv("SUPER_ADMIN_USER_ID", "")
    return {
        "id":           tenant["id"],
        "name":         tenant.get("name", ""),
        "email":        tenant.get("email", ""),
        "notify_email": tenant.get("notify_email", ""),
        "api_key":      tenant.get("api_key", ""),
        "plan":         tenant.get("plan", "free"),
        "status":       tenant.get("status", "active"),
        "created_at":   tenant.get("created_at", ""),
        "is_admin":     bool(admin_id and tenant_id == admin_id),
    }


@router.patch("/me")
async def update_my_profile(
    body: ActualizarPerfilInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """Actualiza el nombre comercial y el email de notificaciones."""
    ensure_tenant(tenant_id)
    update_tenant_profile(tenant_id, body.name.strip(), body.notify_email.strip())
    return await get_my_profile(tenant_id)


@router.get("/me/notifications")
async def list_notifications(tenant_id: str = Depends(get_tenant_id)):
    """Notificaciones de sistema del tenant + contador de no leídas."""
    return {
        "notifications": get_notifications(tenant_id, limit=20),
        "unread": count_unread_notifications(tenant_id),
    }


@router.post("/me/notifications/read")
async def read_notifications(tenant_id: str = Depends(get_tenant_id)):
    """Marca todas las notificaciones de sistema como leídas."""
    mark_notifications_read(tenant_id)
    return {"ok": True}
