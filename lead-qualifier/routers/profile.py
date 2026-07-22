"""Perfil del tenant autenticado y notificaciones de sistema."""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.database import (
    count_unread_notifications, ensure_tenant, get_notifications, get_tenant,
    mark_notifications_read, update_ai_settings, update_tenant_profile,
    update_whatsapp_config,
)
from deps import get_tenant_id
from services.whatsapp import normalize_phone

logger = logging.getLogger(__name__)

router = APIRouter(tags=["perfil"])


class ActualizarPerfilInput(BaseModel):
    name: str
    notify_email: str


class WhatsappConfigInput(BaseModel):
    number: str = ""
    enabled: bool = False


class AiSettingsInput(BaseModel):
    auto_send: bool = True
    brand_voice: str = ""
    followup_enabled: bool = False


@router.get("/me")
async def get_my_profile(tenant_id: str = Depends(get_tenant_id)):
    """Devuelve el perfil del tenant autenticado (nombre, email, api_key, etc.)."""
    ensure_tenant(tenant_id)
    tenant = get_tenant(tenant_id)
    # No exponer campos sensibles innecesarios
    admin_id = os.getenv("SUPER_ADMIN_USER_ID", "").strip()
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
        "whatsapp_number":  tenant.get("whatsapp_number", "") or "",
        "whatsapp_enabled": bool(tenant.get("whatsapp_enabled")),
        "auto_send_email":  True if tenant.get("auto_send_email") is None else bool(tenant.get("auto_send_email")),
        "brand_voice":      tenant.get("brand_voice") or "",
        "followup_enabled": bool(tenant.get("followup_enabled")),
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


@router.post("/me/ai-settings")
async def save_ai_settings(
    body: AiSettingsInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Configura las respuestas con IA:
    - auto_send: True → el email al lead se envía solo; False → queda como
      borrador para revisarlo/editarlo antes de enviar desde el dashboard.
    - brand_voice: preferencias de estilo que la IA respeta al redactar.
    """
    ensure_tenant(tenant_id)
    voz = body.brand_voice.strip()[:500]  # límite defensivo para el prompt
    update_ai_settings(tenant_id, body.auto_send, voz, body.followup_enabled)
    return {
        "ok": True, "auto_send_email": body.auto_send, "brand_voice": voz,
        "followup_enabled": body.followup_enabled,
    }


@router.post("/me/whatsapp")
async def save_whatsapp(
    body: WhatsappConfigInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Configura el aviso por WhatsApp de leads calientes.
    Normaliza el número al formato internacional; si se activa, exige uno válido.
    """
    ensure_tenant(tenant_id)
    numero = normalize_phone(body.number) if body.number.strip() else None

    if body.enabled and not numero:
        raise HTTPException(
            status_code=400,
            detail="Introduce un número de WhatsApp válido (con prefijo, p. ej. +34 600 11 22 33).",
        )

    update_whatsapp_config(tenant_id, numero, body.enabled and bool(numero))
    logger.info("WhatsApp configurado para tenant %s (enabled=%s)", tenant_id, body.enabled)
    return {"ok": True, "whatsapp_number": numero or "", "whatsapp_enabled": body.enabled and bool(numero)}
