"""
Primitivas de seguridad: cifrado de credenciales, verificación de JWT de Clerk
y rate limiting (persistido en BD) del formulario público.
"""

import base64
import hashlib
import logging
import os
import time

import httpx
from cryptography.fernet import Fernet
from fastapi import Request

logger = logging.getLogger(__name__)


def is_dev_mode() -> bool:
    """
    Modo desarrollo EXPLÍCITO (DEV_MODE=1): relaja auth y cifrado para trabajar
    en local sin configurar Clerk ni claves. Nunca debe estar activo en
    producción — por eso es opt-in y no se infiere de la ausencia de otras
    variables (una variable borrada por accidente no debe abrir la API).
    """
    return os.getenv("DEV_MODE", "").strip().lower() in ("1", "true", "yes")


# ─────────────────────────────────────────────
# Cifrado Fernet para contraseñas IMAP
# ─────────────────────────────────────────────

def _fernet() -> Fernet:
    """
    Clave Fernet para cifrar contraseñas IMAP.
    Usa FERNET_KEY si está definida (recomendado en producción).
    Si no, deriva una del ADMIN_SECRET_KEY por compatibilidad con instalaciones antiguas.
    IMPORTANTE: si cambias ADMIN_SECRET_KEY, define FERNET_KEY con el valor antiguo
    antes de rotar, o las contraseñas IMAP almacenadas quedarán ilegibles.

    Sin ninguna de las dos, solo en DEV_MODE se usa una clave insegura de
    desarrollo; fuera de dev se rechaza (cifrar con una clave pública conocida
    equivale a guardar las contraseñas en claro).
    """
    fernet_key = os.getenv("FERNET_KEY", "").strip()
    if fernet_key:
        return Fernet(fernet_key.encode())
    secret = os.getenv("ADMIN_SECRET_KEY", "").strip()
    if not secret:
        if not is_dev_mode():
            raise RuntimeError(
                "Cifrado no configurado: define FERNET_KEY (recomendado) o "
                "ADMIN_SECRET_KEY en las variables de entorno."
            )
        secret = "dev-insecure-key-change-in-prod"
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)


def cifrar(texto: str) -> str:
    return _fernet().encrypt(texto.encode()).decode()


def descifrar(enc: str) -> str:
    return _fernet().decrypt(enc.encode()).decode()


# ─────────────────────────────────────────────
# Verificación JWT de Clerk (multi-tenant)
# ─────────────────────────────────────────────

# Caché del JWKS — se refresca cada hora para no hacer fetch en cada petición.
_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}


async def obtener_jwks() -> dict:
    """Obtiene y cachea el JWKS de Clerk (1h de TTL)."""
    global _jwks_cache
    ahora = time.time()
    if _jwks_cache["keys"] and ahora - _jwks_cache["fetched_at"] < 3600:
        return _jwks_cache["keys"]

    jwks_url = os.getenv("CLERK_JWKS_URL")
    if not jwks_url:
        raise RuntimeError("CLERK_JWKS_URL no está definida en las variables de entorno")

    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url, timeout=10)
        resp.raise_for_status()

    _jwks_cache = {"keys": resp.json(), "fetched_at": ahora}
    logger.info("JWKS de Clerk actualizado")
    return _jwks_cache["keys"]


# ─────────────────────────────────────────────
# Rate limiting del formulario público
# ─────────────────────────────────────────────

def client_ip(request: Request) -> str:
    """
    IP real del cliente a partir de X-Forwarded-For.

    Se toma el ÚLTIMO valor de la cabecera, no el primero: nuestro proxy
    (Render/Vercel/Railway) añade la IP real al final de la cadena que ve;
    cualquier valor anterior a ese lo puede haber puesto el propio cliente
    y no es de fiar (permitiría falsear la IP para saltarse el rate limit).
    """
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def rate_limited(bucket: str, per_min: int, per_hour: int, per_day: int | None = None) -> bool:
    """
    Devuelve True si `bucket` ha superado el límite. Persistido en BD (ver
    core.database.check_rate_limit) para que el límite sea el mismo sin
    importar a qué instancia del backend llega la petición.

    per_day es opcional: úsalo en un bucket "global" (no por IP) para poner
    un techo de coste diario a un endpoint público sin autenticación.
    """
    from core.database import check_rate_limit
    return check_rate_limit(bucket, per_min, per_hour, per_day)
