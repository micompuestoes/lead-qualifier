"""
Primitivas de seguridad: cifrado de credenciales, verificación de JWT de Clerk
y rate limiting en memoria del formulario público.
"""

import base64
import hashlib
import logging
import os
import threading
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
# Rate limiting en memoria para el formulario público
# ─────────────────────────────────────────────

_rate_hits: dict[str, list[float]] = {}
_rate_lock = threading.Lock()


def client_ip(request: Request) -> str:
    """IP real del cliente, respetando el proxy de Render/Vercel (X-Forwarded-For)."""
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limited(bucket: str, per_min: int, per_hour: int) -> bool:
    """Sliding window simple en memoria. Devuelve True si se supera el límite."""
    now = time.time()
    with _rate_lock:
        hits = [t for t in _rate_hits.get(bucket, []) if t > now - 3600]
        if len(hits) >= per_hour or sum(1 for t in hits if t > now - 60) >= per_min:
            _rate_hits[bucket] = hits
            return True
        hits.append(now)
        _rate_hits[bucket] = hits
        # Limpieza ocasional para que el dict no crezca sin control
        if len(_rate_hits) > 5000:
            for k in [k for k, v in _rate_hits.items() if not v or v[-1] < now - 3600]:
                _rate_hits.pop(k, None)
        return False
