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
import stripe
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from cryptography.fernet import Fernet
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from pydantic import BaseModel

from database import (
    add_team_member, count_leads_for_tenant, delete_lead, disable_imap,
    ensure_tenant, get_all_tenants, get_imap_config, get_lead_by_id,
    get_lead_count_this_month, get_leads_by_email, get_owner_for_member,
    get_recent_leads, get_stats, get_team_members, get_tenant,
    get_tenant_by_api_key, get_tenant_by_stripe_customer, get_tenants_with_imap,
    init_db, remove_team_member, save_imap_config, set_tenant_plan,
    set_tenant_status, update_imap_last_sync, update_lead_status,
    update_tenant_profile,
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

class CheckoutInput(BaseModel):
    plan: Literal["pro", "agencia"]

class AdInput(BaseModel):
    tipo:   str
    op:     str
    ubi:    str
    m2:     Optional[str] = None
    hab:    Optional[str] = None
    ban:    Optional[str] = None
    precio: Optional[str] = None
    extras: list[str] = []
    notas:  Optional[str] = None
    canales: list[str] = ["idealista", "rrss", "email"]

class TeamMemberInput(BaseModel):
    member_id: str


# ─────────────────────────────────────────────
# Stripe
# ─────────────────────────────────────────────

FREE_LEAD_LIMIT = 10

def _stripe_configured() -> bool:
    return bool(os.getenv("STRIPE_SECRET_KEY"))

def _get_price_id(plan: str) -> str:
    key = "STRIPE_PRICE_PRO" if plan == "pro" else "STRIPE_PRICE_AGENCIA"
    price_id = os.getenv(key, "")
    if not price_id:
        raise HTTPException(status_code=503, detail=f"Price ID para '{plan}' no configurado en variables de entorno")
    return price_id


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

    # Stripe
    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    if stripe_key:
        stripe.api_key = stripe_key
        logger.info("Stripe configurado")
    else:
        logger.warning("STRIPE_SECRET_KEY no definida — pagos desactivados")

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


# ─────────────────────────────────────────────
# Billing (Stripe)
# ─────────────────────────────────────────────

@app.post("/billing/checkout")
async def create_checkout(
    data: CheckoutInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """Crea una sesión de Stripe Checkout y devuelve la URL de pago."""
    if not _stripe_configured():
        raise HTTPException(status_code=503, detail="Pagos no configurados")

    price_id = _get_price_id(data.plan)
    ensure_tenant(tenant_id)
    tenant = get_tenant(tenant_id)
    dashboard_url = os.getenv("DASHBOARD_URL", "http://localhost:3000")

    # Crear o reutilizar customer de Stripe
    customer_id = tenant.get("stripe_customer_id") if tenant else None
    if not customer_id:
        customer = stripe.Customer.create(
            email=tenant.get("email", ""),
            metadata={"tenant_id": tenant_id},
        )
        customer_id = customer.id
        set_tenant_plan(tenant_id, tenant.get("plan", "free"), None, customer_id)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{dashboard_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{dashboard_url}/pricing",
        metadata={"tenant_id": tenant_id, "plan": data.plan},
    )
    logger.info("Checkout creado: tenant %s → plan %s", tenant_id, data.plan)
    return {"url": session.url}


@app.post("/billing/portal")
async def customer_portal(tenant_id: str = Depends(get_tenant_id)):
    """Abre el portal de Stripe para gestionar la suscripción (cancelar, cambiar tarjeta…)."""
    if not _stripe_configured():
        raise HTTPException(status_code=503, detail="Pagos no configurados")

    tenant = get_tenant(tenant_id)
    customer_id = tenant.get("stripe_customer_id") if tenant else None
    if not customer_id:
        raise HTTPException(status_code=404, detail="No tienes ninguna suscripción activa")

    dashboard_url = os.getenv("DASHBOARD_URL", "http://localhost:3000")
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{dashboard_url}/perfil",
    )
    return {"url": session.url}


@app.post("/billing/webhook")
async def stripe_webhook(request: Request):
    """
    Webhook de Stripe — actualiza el plan del tenant al pagar o cancelar.
    Verifica la firma si STRIPE_WEBHOOK_SECRET está configurado.
    """
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    try:
        if webhook_secret:
            # Verificar firma con la librería de Stripe (lanza excepción si no coincide)
            stripe.Webhook.construct_event(payload, sig, webhook_secret)
        # Siempre parsear como dict plano para acceso seguro con .get()
        event = json.loads(payload)
    except ValueError as exc:
        logger.warning("Webhook payload inválido: %s", exc)
        raise HTTPException(status_code=400, detail="Payload inválido")
    except stripe.SignatureVerificationError as exc:
        logger.warning("Firma de webhook inválida: %s", exc)
        raise HTTPException(status_code=400, detail="Firma inválida")

    etype = event.get("type", "")
    obj   = event.get("data", {}).get("object", {})

    if etype == "checkout.session.completed":
        tenant_id   = obj.get("metadata", {}).get("tenant_id")
        plan        = obj.get("metadata", {}).get("plan", "pro")
        sub_id      = obj.get("subscription")
        customer_id = obj.get("customer")
        if tenant_id:
            set_tenant_plan(tenant_id, plan, sub_id, customer_id)
            logger.info("Pago completado: tenant %s → %s", tenant_id, plan)

    elif etype in ("customer.subscription.updated", "customer.subscription.deleted"):
        status      = obj.get("status", "")
        customer_id = obj.get("customer")
        sub_id      = obj.get("id")
        cancelado   = etype == "customer.subscription.deleted" or status in ("canceled", "unpaid", "incomplete_expired")
        if cancelado and customer_id:
            tenant = get_tenant_by_stripe_customer(customer_id)
            if tenant:
                set_tenant_plan(tenant["id"], "free", None, customer_id)
                logger.info("Suscripción cancelada: tenant %s → free", tenant["id"])

    return {"ok": True}


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "lead-qualifier", "version": "2.0.0"}


# ─────────────────────────────────────────────
# Estadísticas avanzadas (plan agencia)
# ─────────────────────────────────────────────

def _require_plan(tenant_id: str, plan_requerido: str) -> None:
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


@app.get("/stats")
async def get_estadisticas(tenant_id: str = Depends(get_tenant_id)):
    """Estadísticas avanzadas de leads — solo plan agencia."""
    _require_plan(tenant_id, "agencia")
    return get_stats(tenant_id)


# ─────────────────────────────────────────────
# Generador de anuncios IA (plan agencia)
# ─────────────────────────────────────────────

@app.post("/generate-ad")
async def generate_ad(
    data: AdInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """Genera anuncios inmobiliarios para Idealista, RRSS y Email — solo plan agencia."""
    _require_plan(tenant_id, "agencia")

    canales_validos = [c for c in data.canales if c in ("idealista", "rrss", "email")]
    if not canales_validos:
        raise HTTPException(status_code=400, detail="Selecciona al menos un canal")

    reglas = {
        "idealista": "tono profesional y descriptivo. Body máximo 1700 caracteres.",
        "rrss":      "tono dinámico y cercano, puede usar emojis con moderación. Body máximo 450 caracteres.",
        "email":     "tono consultivo/comercial, claro y directo. Body máximo 450 caracteres.",
    }
    reglas_texto = "\n".join(
        f"- {c}: {reglas[c]}" for c in canales_validos
    )

    extras_str = ", ".join(data.extras) if data.extras else "ninguno"
    prompt = f"""Eres un redactor inmobiliario senior especializado en el mercado español.
Genera borradores para cada canal solicitado, con estilo específico y límites de longitud.

Devuelve EXCLUSIVAMENTE un JSON válido, sin markdown, sin comentarios, sin texto extra.
Estructura esperada:
{{
  "drafts": {{
    "idealista": {{"titulo": "string", "body": "string"}},
    "rrss":      {{"titulo": "string", "body": "string"}},
    "email":     {{"titulo": "string", "body": "string"}}
  }}
}}
Incluye solo las claves de canales solicitados.

Reglas por canal:
{reglas_texto}

Datos del inmueble:
Tipo: {data.tipo or "no definido"}
Operación: {data.op or "no definido"}
Ubicación: {data.ubi or "no definida"}
m2: {data.m2 or "no definido"}
Habitaciones: {data.hab or "no definido"}
Baños: {data.ban or "no definido"}
Precio: {data.precio or "no definido"}
Extras: {extras_str}
Notas del agente: {data.notas or "sin notas adicionales"}
Canales solicitados: {", ".join(canales_validos)}
"""

    try:
        client = get_anthropic_client()
        message = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()

        # Extraer JSON aunque venga envuelto en markdown
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        result = json.loads(raw)
        return result

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Error al parsear respuesta de IA: {str(e)}")
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=500, detail="API key de Anthropic inválida")
    except Exception as e:
        logger.exception("Error en generador de anuncios: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


# ─────────────────────────────────────────────
# Gestión del equipo (plan agencia)
# ─────────────────────────────────────────────

@app.get("/me/team")
async def listar_equipo(tenant_id: str = Depends(get_tenant_id)):
    """Lista los miembros del equipo del tenant — solo plan agencia."""
    _require_plan(tenant_id, "agencia")
    members = get_team_members(tenant_id)
    return {"members": members, "total": len(members)}


@app.post("/me/team", status_code=201)
async def agregar_miembro(
    body: TeamMemberInput,
    tenant_id: str = Depends(get_tenant_id),
):
    """Añade un miembro al equipo por su Clerk user_id — solo plan agencia."""
    _require_plan(tenant_id, "agencia")
    if body.member_id == tenant_id:
        raise HTTPException(status_code=400, detail="No puedes añadirte a ti mismo")
    # Verificar que el member_id no sea ya propietario de otra cuenta
    existing_owner = get_owner_for_member(body.member_id)
    if existing_owner and existing_owner != tenant_id:
        raise HTTPException(status_code=409, detail="Este usuario ya pertenece a otro equipo")
    add_team_member(tenant_id, body.member_id)
    logger.info("Miembro %s añadido al equipo de %s", body.member_id, tenant_id)
    return {"ok": True, "member_id": body.member_id}


@app.delete("/me/team/{member_id}", status_code=204)
async def eliminar_miembro(
    member_id: str,
    tenant_id: str = Depends(get_tenant_id),
):
    """Elimina un miembro del equipo — solo plan agencia."""
    _require_plan(tenant_id, "agencia")
    remove_team_member(tenant_id, member_id)
    logger.info("Miembro %s eliminado del equipo de %s", member_id, tenant_id)


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
