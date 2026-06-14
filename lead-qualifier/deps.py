"""
Dependencias de FastAPI compartidas por los routers:
autenticación multi-tenant (Clerk) y guards de plan y de administración.
"""

import logging
import os
from dataclasses import dataclass

import anthropic
from fastapi import HTTPException, Request
from jose import JWTError, jwt

import runtime
from core.database import get_owner_for_member, get_tenant
from security import obtener_jwks

logger = logging.getLogger(__name__)


@dataclass
class Caller:
    """Identidad de quien hace la petición.

    tenant_id: la cuenta a la que pertenecen los datos (el dueño).
    user_id:   el usuario concreto de Clerk que llama (el agente).
    is_owner:  True si es el dueño de la cuenta; False si es un miembro del equipo.
    """
    tenant_id: str
    user_id: str
    is_owner: bool

    @property
    def agent_filter(self) -> "str | None":
        """user_id por el que filtrar 'mis leads' (None = ve todo, para el dueño)."""
        return None if self.is_owner else self.user_id


async def get_caller(request: Request) -> Caller:
    """
    Resuelve la identidad del que llama a partir del JWT de Clerk y verifica
    que la cuenta esté activa.

    Sin CLERK_JWKS_URL (entorno local sin auth), devuelve un dueño 'dev-tenant'
    que lo ve todo, para no bloquear el desarrollo.
    """
    if not os.getenv("CLERK_JWKS_URL"):
        return Caller(tenant_id="dev-tenant", user_id="dev-tenant", is_owner=True)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token de autenticación requerido")

    token = auth_header[7:]
    try:
        jwks = await obtener_jwks()
        # options: no verificar audiencia (Clerk no siempre la incluye en tokens de sesión)
        payload = jwt.decode(
            token, jwks,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token sin subject (sub)")

        # Si es miembro del equipo de otra empresa, el tenant es el del propietario.
        owner_id = get_owner_for_member(user_id)
        tenant_id = owner_id if owner_id else user_id
        is_owner = owner_id is None  # no es miembro de nadie → es el dueño

        # Verificar estado del tenant
        tenant = get_tenant(tenant_id)
        if tenant and tenant.get("status") == "cancelled":
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "TENANT_CANCELLED",
                    "message": "Tu cuenta está desactivada. Contacta con soporte para reactivarla.",
                    "cancelled_at": tenant.get("cancelled_at"),
                },
            )

        return Caller(tenant_id=tenant_id, user_id=user_id, is_owner=is_owner)

    except HTTPException:
        raise  # re-lanzar HTTPExceptions sin envolverlas
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token inválido: {str(e)}")


async def get_tenant_id(request: Request) -> str:
    """Atajo: solo el tenant_id de quien llama (la mayoría de endpoints)."""
    return (await get_caller(request)).tenant_id


def get_anthropic_client() -> anthropic.Anthropic:
    """Devuelve el cliente de Anthropic creado en el arranque (ver runtime/lifespan)."""
    if runtime.anthropic_client is None:
        raise HTTPException(status_code=503, detail="Servicio de IA no inicializado")
    return runtime.anthropic_client


def require_admin(request: Request) -> None:
    """
    Protege los endpoints de administración con una clave secreta.
    Configura ADMIN_SECRET_KEY en las variables de entorno.
    """
    admin_key = os.getenv("ADMIN_SECRET_KEY")
    if not admin_key:
        raise HTTPException(status_code=503, detail="Panel de admin no configurado")

    provided = request.headers.get("X-Admin-Key", "")
    if provided != admin_key:
        raise HTTPException(status_code=403, detail="Clave de administrador inválida")


def require_plan(tenant_id: str, plan_requerido: str) -> None:
    """Lanza 403 si el tenant no tiene el plan mínimo requerido."""
    orden = {"free": 0, "pro": 1, "agencia": 2}
    tenant = get_tenant(tenant_id)
    plan_actual = tenant.get("plan", "free") if tenant else "free"
    if orden.get(plan_actual, 0) < orden.get(plan_requerido, 0):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_REQUIRED",
                "plan_required": plan_requerido,
                "message": f"Esta función requiere el plan {plan_requerido}.",
                "upgrade_url": "/pricing",
            },
        )
