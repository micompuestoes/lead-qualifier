"""Configuración IMAP del tenant (bandeja de entrada → leads). Solo Pro y Agencia."""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.database import disable_imap, get_imap_config, save_imap_config
from deps import get_tenant_id, require_plan
from security import cifrar
from services.email_imap import detectar_servidor_imap, verificar_conexion

logger = logging.getLogger(__name__)

router = APIRouter(tags=["imap"])


class ImapConfigInput(BaseModel):
    email: str
    password: str
    host: Optional[str] = None   # None → autodetectar por dominio
    port: int = 993


@router.get("/me/imap")
async def get_imap(tenant_id: str = Depends(get_tenant_id)):
    """Devuelve la config IMAP del tenant (sin contraseña)."""
    cfg = get_imap_config(tenant_id)
    if not cfg:
        return {"configured": False}
    return {
        "configured": True,
        "host": cfg["host"],
        "port": cfg["port"],
        "user": cfg["user"],
        "enabled": cfg["enabled"],
        "last_sync": cfg["last_sync"],
    }


@router.post("/me/imap")
async def save_imap(
    data: ImapConfigInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Guarda y verifica la configuración IMAP del tenant.
    Si host está vacío se autodetecta por el dominio del email.
    Disponible solo para planes Pro y Agencia.
    """
    require_plan(tenant_id, "pro")

    host = (data.host or "").strip()
    port = data.port

    if not host:
        host, port = detectar_servidor_imap(data.email)
        if not host:
            raise HTTPException(
                status_code=400,
                detail="No se pudo detectar el servidor IMAP. Introdúcelo manualmente.",
            )

    # Verificar credenciales antes de guardar
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None, verificar_conexion, host, port, data.email, data.password
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    password_enc = cifrar(data.password)
    save_imap_config(tenant_id, host, port, data.email, password_enc)
    logger.info("IMAP guardado para tenant %s → %s", tenant_id, host)

    return {"ok": True, "host": host, "port": port, "user": data.email}


@router.delete("/me/imap", status_code=204)
async def delete_imap(tenant_id: str = Depends(get_tenant_id)):
    """Desconecta y borra la config IMAP del tenant. Solo Pro y Agencia."""
    require_plan(tenant_id, "pro")
    disable_imap(tenant_id)
