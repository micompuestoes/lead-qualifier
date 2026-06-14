"""
Dependencias de FastAPI compartidas por los routers:
autenticación multi-tenant (Clerk) y guards de plan y de administración.
"""

import logging
import os

import anthropic
from fastapi import HTTPException, Request
from jose import JWTError, jwt

import runtime
from core.database import get_owner_for_member, get_tenant
from security import obtener_jwks

logger = logging.getLogger(__name__)


async def get_tenant_id(request: Request) -> str:
    """
    Dependency de FastAPI que extrae el tenant_id del JWT de Clerk
    y verifica que el tenant esté activo.

    Si CLERK_JWKS_URL no está configurada (entorno local sin auth),
    devuelve 'dev-tenant' para no bloquear el desarrollo.
    """
    if not os.getenv("CLERK_JWKS_URL"):
        return "dev-tenant"  # modo desarrollo sin auth

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

        # Si es miembro del equipo de otra empresa, usar el tenant del propietario
        owner_id = get_owner_for_member(user_id)
        tenant_id = owner_id if owner_id else user_id

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

        return tenant_id

    except HTTPException:
        raise  # re-lanzar HTTPExceptions sin envolverlas
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token inválido: {str(e)}")


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
