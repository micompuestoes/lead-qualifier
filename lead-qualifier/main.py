"""
FastAPI app principal — multi-tenant con autenticación via JWT de Clerk.

Variables de entorno necesarias:
  ANTHROPIC_API_KEY   → clave de la API de Anthropic
  CLERK_JWKS_URL      → URL del JWKS de Clerk para verificar tokens
                        Ejemplo: https://tu-instancia.clerk.accounts.dev/.well-known/jwks.json
  DATABASE_URL        → (opcional) PostgreSQL en producción. Sin ella usa SQLite local.
"""

import asyncio
import base64
import hashlib
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal, Optional

import anthropic
import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from cryptography.fernet import Fernet
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from pydantic import BaseModel

from database import (
    count_leads_for_tenant, delete_lead, disable_imap, ensure_tenant,
    get_all_tenants, get_imap_config, get_lead_by_id, get_leads_by_email,
    get_recent_leads, get_tenant, get_tenant_by_api_key, get_tenants_with_imap,
    init_db, save_imap_config, set_tenant_status, update_imap_last_sync,
    update_lead_status, update_tenant_profile,
)
from email_imap import detectar_servidor_imap, obtener_no_leidos, verificar_conexion
from email_sender import send_lead_response_email, send_tenant_notification
from models import LeadInput, LeadOutput
from agent import qualify_lead, _make_anthropic_client

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)


# ─────────────────────────────────────────────
# Modelos Pydantic
# ─────────────────────────────────────────────
EstadoLiteral = Literal["PENDIENTE", "CONTACTADO", "CERRADO", "DESCARTADO"]
EstadoTenantLiteral = Literal["active", "cancelled"]

class ActualizarEstadoInput(BaseModel):
    status: EstadoLiteral

class ActualizarEstadoTenantInput(BaseModel):
    status: EstadoTenantLiteral

class ActualizarPerfilInput(BaseModel):
    name: str
    notify_email: str

class ImapConfigInput(BaseModel):
    email: str
    password: str
    host: Optional[str] = None   # None → autodetectar por dominio
    port: int = 993


# ─────────────────────────────────────────────
# Cifrado Fernet para contraseñas IMAP
# ─────────────────────────────────────────────

def _fernet() -> Fernet:
    """Deriva una clave Fernet del ADMIN_SECRET_KEY (ya obligatorio en prod)."""
    secret = os.getenv("ADMIN_SECRET_KEY", "dev-insecure-key-change-in-prod")
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)

def cifrar(texto: str) -> str:
    return _fernet().encrypt(texto.encode()).decode()

def descifrar(enc: str) -> str:
    return _fernet().decrypt(enc.encode()).decode()


# ─────────────────────────────────────────────
# Scheduler IMAP
# ─────────────────────────────────────────────

_scheduler = AsyncIOScheduler(timezone="UTC")


# ─────────────────────────────────────────────
# Verificación JWT de Clerk (multi-tenant)
# ─────────────────────────────────────────────

# Caché del JWKS — se refresca cada hora para no hacer fetch en cada petición
_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}


async def _obtener_jwks() -> dict:
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
        jwks = await _obtener_jwks()
        # options: no verificar audiencia (Clerk no siempre la incluye en tokens de sesión)
        payload = jwt.decode(
            token, jwks,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        tenant_id: str = payload.get("sub", "")
        if not tenant_id:
            raise HTTPException(status_code=401, detail="Token sin subject (sub)")

        # Verificar estado del tenant si ya existe en la BD
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


def _require_admin(request: Request) -> None:
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


# ─────────────────────────────────────────────
# Lifecycle: inicializar BD al arrancar
# ─────────────────────────────────────────────
async def _sync_imap_todos() -> None:
    """Job del scheduler: procesa la bandeja IMAP de cada tenant activo."""
    tenants = get_tenants_with_imap()
    if not tenants:
        return
    logger.info("IMAP sync — %d tenant(s)", len(tenants))
    for t in tenants:
        try:
            await _sync_imap_tenant(t)
        except Exception as exc:
            logger.error("IMAP sync error (tenant %s): %s", t["id"], exc)


async def _sync_imap_tenant(t: dict) -> None:
    """Descarga emails no leídos del tenant y los cualifica como leads."""
    password = descifrar(t["password_enc"])
    loop = asyncio.get_event_loop()

    # La I/O IMAP es bloqueante → correr en thread pool
    emails = await loop.run_in_executor(
        None, obtener_no_leidos, t["host"], t["port"], t["user"], password
    )

    if emails:
        logger.info("IMAP tenant %s — %d email(s) nuevos", t["id"], len(emails))

    client = get_anthropic_client()
    for datos in emails:
        try:
            lead_input = LeadInput(**datos)
            result = qualify_lead(
                name=lead_input.name,
                email=lead_input.email,
                phone=None,
                message=lead_input.message,
                anthropic_client=client,
                tenant_id=t["id"],
            )
            _notificar_tenant(t["id"], lead_input, result)
            logger.info(
                "Lead IMAP cualificado: %s — score %s (%s)",
                datos["email"], result.get("score"), result.get("classification"),
            )
        except Exception as exc:
            logger.error("Error cualificando email de %s: %s", datos.get("email"), exc)

    update_imap_last_sync(t["id"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Arrancando Lead Qualifier API (multi-tenant)")
    init_db()

    if not os.getenv("ANTHROPIC_API_KEY"):
        logger.error("ANTHROPIC_API_KEY no definida en .env")
        raise RuntimeError("ANTHROPIC_API_KEY es obligatoria")

    if not os.getenv("CLERK_JWKS_URL"):
        logger.warning("CLERK_JWKS_URL no definida — modo dev sin autenticación")
    else:
        logger.info("Auth: Clerk JWT activo")

    logger.info("API key de Anthropic detectada")

    # Arrancar scheduler IMAP (cada 10 minutos)
    _scheduler.add_job(_sync_imap_todos, "interval", minutes=10, id="imap_sync")
    _scheduler.start()
    logger.info("Scheduler IMAP arrancado (cada 10 min)")

    yield

    _scheduler.shutdown(wait=False)
    logger.info("Cerrando Lead Qualifier API")


# ─────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────
app = FastAPI(
    title="Lead Qualifier API",
    description="Agente de IA multi-tenant para cualificación de leads",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_anthropic_client() -> anthropic.Anthropic:
    return _make_anthropic_client(os.getenv("ANTHROPIC_API_KEY"))


def _notificar_tenant(tenant_id: str, lead: LeadInput, result: dict) -> None:
    """Envía email al tenant si el lead tiene score >= 6."""
    try:
        tenant = get_tenant(tenant_id)
        if not tenant:
            return
        notify_email = tenant.get("notify_email") or tenant.get("email", "")
        if not notify_email:
            return
        dashboard_url = os.getenv("DASHBOARD_URL", "")
        send_tenant_notification(
            tenant_email=notify_email,
            tenant_name=tenant.get("name", ""),
            lead_name=lead.name,
            lead_email=lead.email,
            lead_phone=lead.phone,
            lead_message=lead.message,
            score=result.get("score", 0),
            classification=result.get("classification", ""),
            dashboard_url=dashboard_url,
        )
    except Exception as e:
        logger.warning("No se pudo enviar notificación al tenant %s: %s", tenant_id, str(e))


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


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.post("/qualify-lead", response_model=LeadOutput, status_code=200)
async def qualify_lead_endpoint(
    lead: LeadInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """Procesa un lead entrante con el agente de IA."""
    logger.info("POST /qualify-lead — %s <%s> (tenant: %s)", lead.name, lead.email, tenant_id)

    # Garantizar que el tenant existe en la BD
    ensure_tenant(tenant_id)

    try:
        client = get_anthropic_client()
        result = qualify_lead(
            name=lead.name,
            email=lead.email,
            phone=lead.phone,
            message=lead.message,
            anthropic_client=client,
            tenant_id=tenant_id,
        )

        email_sent = send_lead_response_email(
            lead_email=lead.email,
            lead_name=lead.name,
            generated_email_body=result["generated_email"],
        )
        if email_sent:
            logger.info("Email de respuesta enviado a %s", lead.email)

        # Notificar a la inmobiliaria/empresa si el lead es bueno
        _notificar_tenant(tenant_id, lead, result)

        return LeadOutput(**result)

    except anthropic.AuthenticationError:
        raise HTTPException(status_code=500, detail="API key de Anthropic inválida")
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Rate limit alcanzado. Intenta en unos segundos.")
    except Exception as e:
        logger.exception("Error al procesar lead: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@app.get("/leads")
async def list_leads(
    limit: int = 100,
    tenant_id: str = Depends(get_tenant_id),
):
    """Lista los leads del tenant, ordenados por fecha descendente."""
    ensure_tenant(tenant_id)
    if limit > 500:
        limit = 500
    leads = get_recent_leads(limit, tenant_id=tenant_id)
    return {"leads": [_serializar_lead(l) for l in leads], "total": len(leads)}


@app.get("/leads/{lead_id}")
async def get_lead(
    lead_id: str,
    tenant_id: str = Depends(get_tenant_id),
):
    """Recupera un lead completo por ID (solo si pertenece al tenant)."""
    lead = get_lead_by_id(lead_id, tenant_id=tenant_id)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")
    return _serializar_lead(lead)


@app.patch("/leads/{lead_id}/status")
async def patch_lead_status(
    lead_id: str,
    body: ActualizarEstadoInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """Actualiza el estado de un lead del tenant."""
    lead = get_lead_by_id(lead_id, tenant_id=tenant_id)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")

    update_lead_status(lead_id, body.status, tenant_id=tenant_id)
    logger.info("Lead %s → estado %s (tenant: %s)", lead_id, body.status, tenant_id)

    actualizado = get_lead_by_id(lead_id, tenant_id=tenant_id)
    return _serializar_lead(actualizado)


@app.delete("/leads/{lead_id}", status_code=204)
async def delete_lead_endpoint(
    lead_id: str,
    tenant_id: str = Depends(get_tenant_id),
):
    """Elimina un lead del tenant."""
    lead = get_lead_by_id(lead_id, tenant_id=tenant_id)
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} no encontrado")

    delete_lead(lead_id, tenant_id=tenant_id)
    logger.info("Lead %s eliminado (tenant: %s)", lead_id, tenant_id)


@app.get("/leads/by-email/{email}")
async def leads_by_email(
    email: str,
    tenant_id: str = Depends(get_tenant_id),
):
    """Historial de leads de un email concreto para el tenant."""
    leads = get_leads_by_email(email, tenant_id=tenant_id)
    return {"email": email, "total": len(leads), "leads": [_serializar_lead(l) for l in leads]}


@app.get("/me")
async def get_my_profile(tenant_id: str = Depends(get_tenant_id)):
    """Devuelve el perfil del tenant autenticado (nombre, email, api_key, etc.)."""
    ensure_tenant(tenant_id)
    tenant = get_tenant(tenant_id)
    # No exponer campos sensibles innecesarios
    return {
        "id":           tenant["id"],
        "name":         tenant.get("name", ""),
        "email":        tenant.get("email", ""),
        "notify_email": tenant.get("notify_email", ""),
        "api_key":      tenant.get("api_key", ""),
        "plan":         tenant.get("plan", "free"),
        "status":       tenant.get("status", "active"),
        "created_at":   tenant.get("created_at", ""),
    }


@app.patch("/me")
async def update_my_profile(
    body: ActualizarPerfilInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """Actualiza el nombre comercial y el email de notificaciones."""
    ensure_tenant(tenant_id)
    update_tenant_profile(tenant_id, body.name.strip(), body.notify_email.strip())
    return await get_my_profile(tenant_id)


# ─────────────────────────────────────────────
# Endpoints IMAP (bandeja de entrada del tenant)
# ─────────────────────────────────────────────

@app.get("/me/imap")
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


@app.post("/me/imap")
async def save_imap(
    data: ImapConfigInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Guarda y verifica la configuración IMAP del tenant.
    Si host está vacío se autodetecta por el dominio del email.
    """
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


@app.delete("/me/imap", status_code=204)
async def delete_imap(tenant_id: str = Depends(get_tenant_id)):
    """Desconecta y borra la config IMAP del tenant."""
    disable_imap(tenant_id)


# ─────────────────────────────────────────────
# Endpoint público de intake (sin autenticación JWT)
# Usa la api_key del tenant como identificador
# ─────────────────────────────────────────────

@app.post("/intake/{api_key}", status_code=200)
async def public_intake(api_key: str, lead: LeadInput):
    """
    Endpoint público para recibir leads desde formularios externos.
    No requiere autenticación — usa la api_key del tenant.

    La inmobiliaria pone en su web:
      POST https://tu-api.render.com/intake/lq_xxxxxxxxxxxx
    """
    tenant = get_tenant_by_api_key(api_key)
    if not tenant:
        raise HTTPException(status_code=404, detail="API key no válida")

    if tenant.get("status") == "cancelled":
        raise HTTPException(status_code=403, detail="Cuenta desactivada")

    tenant_id = tenant["id"]
    logger.info("Intake público — %s <%s> (tenant: %s)", lead.name, lead.email, tenant_id)

    try:
        client = get_anthropic_client()
        result = qualify_lead(
            name=lead.name,
            email=lead.email,
            phone=lead.phone,
            message=lead.message,
            anthropic_client=client,
            tenant_id=tenant_id,
        )

        # Email de respuesta al lead
        send_lead_response_email(
            lead_email=lead.email,
            lead_name=lead.name,
            generated_email_body=result["generated_email"],
        )

        # Notificación a la inmobiliaria
        _notificar_tenant(tenant_id, lead, result)

        return {
            "ok": True,
            "score": result.get("score"),
            "classification": result.get("classification"),
            "message": "Tu consulta ha sido recibida. En breve nos pondremos en contacto contigo.",
        }

    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Servicio temporalmente saturado. Inténtalo en unos segundos.")
    except Exception as e:
        logger.exception("Error en intake público: %s", str(e))
        raise HTTPException(status_code=500, detail="Error interno")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "lead-qualifier", "version": "2.0.0"}


# ─────────────────────────────────────────────
# Endpoints de administración (protegidos por X-Admin-Key)
# ─────────────────────────────────────────────

@app.get("/admin/tenants")
async def admin_list_tenants(request: Request):
    """
    Lista todos los tenants con su estado y número de leads.
    Requiere cabecera: X-Admin-Key: <ADMIN_SECRET_KEY>
    """
    _require_admin(request)

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


@app.get("/admin/tenants/{tenant_id}")
async def admin_get_tenant(tenant_id: str, request: Request):
    """Detalle de un tenant concreto. Requiere X-Admin-Key."""
    _require_admin(request)

    tenant = get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant {tenant_id} no encontrado")

    tenant["lead_count"] = count_leads_for_tenant(tenant_id)
    return tenant


@app.patch("/admin/tenants/{tenant_id}/status")
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
    _require_admin(request)

    tenant = get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant {tenant_id} no encontrado")

    set_tenant_status(tenant_id, body.status)
    logger.info("Admin: tenant %s → %s", tenant_id, body.status)

    actualizado = get_tenant(tenant_id)
    actualizado["lead_count"] = count_leads_for_tenant(tenant_id)
    return actualizado


# ─────────────────────────────────────────────
# Manejador global de errores
# ─────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Error en %s: %s", request.url, str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor", "error": str(exc)},
    )
