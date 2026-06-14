"""Suscripciones y facturación con Stripe (checkout, portal, cancelación, webhook)."""

import json
import logging
import os
from typing import Literal

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.database import (
    add_notification, disable_imap, ensure_tenant, get_agent_ids, get_tenant,
    get_tenant_by_stripe_customer, set_tenant_plan,
)
from deps import get_tenant_id

logger = logging.getLogger(__name__)

router = APIRouter(tags=["billing"])


class CheckoutInput(BaseModel):
    plan: Literal["pro", "agencia"]


def _stripe_configured() -> bool:
    return bool(os.getenv("STRIPE_SECRET_KEY"))


def _get_price_id(plan: str) -> str:
    key = "STRIPE_PRICE_PRO" if plan == "pro" else "STRIPE_PRICE_AGENCIA"
    price_id = os.getenv(key, "")
    if not price_id:
        raise HTTPException(status_code=503, detail=f"Price ID para '{plan}' no configurado en variables de entorno")
    return price_id


def _seat_count(tenant_id: str) -> int:
    """Asientos facturables = nº de agentes (dueño + miembros del equipo)."""
    return max(1, len(get_agent_ids(tenant_id)))


def sync_agency_seats(tenant_id: str) -> None:
    """
    Ajusta la cantidad (asientos) de la suscripción de Stripe al nº de agentes.
    Pensado para llamar al añadir/quitar miembros. Solo actúa en agencias de pago
    con Stripe configurado; cualquier fallo se loguea sin romper la operación.

    NOTA: requiere que STRIPE_PRICE_AGENCIA sea un precio recurrente POR UNIDAD
    (por asiento). La cantidad se cobra prorrateada.
    """
    if not _stripe_configured():
        return
    tenant = get_tenant(tenant_id)
    if not tenant or tenant.get("plan") != "agencia":
        return
    sub_id = tenant.get("stripe_subscription_id")
    if not sub_id:
        return
    try:
        sub = stripe.Subscription.retrieve(sub_id)
        items = sub.get("items", {}).get("data", [])
        if not items:
            return
        seats = _seat_count(tenant_id)
        stripe.SubscriptionItem.modify(
            items[0]["id"], quantity=seats, proration_behavior="create_prorations",
        )
        logger.info("Asientos de la agencia %s sincronizados a %d", tenant_id, seats)
    except Exception as exc:
        logger.warning("No se pudieron sincronizar asientos de %s: %s", tenant_id, exc)


@router.post("/billing/checkout")
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

    # Agencia se factura por asiento (nº de agentes); Pro es un único usuario.
    cantidad = _seat_count(tenant_id) if data.plan == "agencia" else 1

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": cantidad}],
        mode="subscription",
        success_url=f"{dashboard_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{dashboard_url}/pricing",
        metadata={"tenant_id": tenant_id, "plan": data.plan},
    )
    logger.info("Checkout creado: tenant %s → plan %s", tenant_id, data.plan)
    return {"url": session.url}


@router.post("/billing/portal")
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


@router.delete("/me/subscription")
async def cancel_subscription(tenant_id: str = Depends(get_tenant_id)):
    """
    Cancela la suscripción del tenant al final del período actual.
    El plan baja a 'free' automáticamente vía webhook cuando Stripe confirme.
    """
    if not _stripe_configured():
        raise HTTPException(status_code=503, detail="Pagos no configurados")

    tenant = get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    if tenant.get("plan", "free") == "free":
        raise HTTPException(status_code=400, detail="No tienes ninguna suscripción de pago activa")

    sub_id = tenant.get("stripe_subscription_id")
    if not sub_id:
        raise HTTPException(
            status_code=404,
            detail="No se encontró el ID de suscripción. Usa el portal para cancelar.",
        )

    try:
        # cancel_at_period_end=True → el usuario conserva acceso hasta el fin del período
        sub = stripe.Subscription.modify(sub_id, cancel_at_period_end=True)
        cancel_date = sub.get("current_period_end")
        try:
            add_notification(tenant_id, "plan", "Cancelación programada",
                             "Tu suscripción se cancelará al final del período. Mantienes el acceso hasta entonces.")
        except Exception:
            pass
        logger.info(
            "Suscripción %s marcada para cancelar al final del período (tenant %s, fecha: %s)",
            sub_id, tenant_id, cancel_date,
        )
        return {
            "ok": True,
            "cancel_at_period_end": True,
            "current_period_end": cancel_date,
            "message": "Tu suscripción se cancelará al final del período. Seguirás con acceso hasta entonces.",
        }
    except Exception as e:
        # Cualquier fallo (Stripe u otro) se devuelve como error manejado (4xx),
        # no como 500 — así el navegador recibe cabeceras CORS y el mensaje real.
        logger.error("Error cancelando suscripción %s: %s", sub_id, e)
        raise HTTPException(status_code=400, detail=f"No se pudo cancelar la suscripción: {str(e)}")


@router.post("/billing/webhook")
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
            try:
                add_notification(tenant_id, "plan", f"¡Bienvenido al plan {plan.capitalize()}!",
                                 "Tu suscripción se ha activado. Ya tienes acceso a todas las funciones.")
            except Exception:
                pass
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
                # Al bajar a free, la conexión IMAP deja de estar disponible: la desactivamos
                try:
                    disable_imap(tenant["id"])
                except Exception as exc:
                    logger.warning("No se pudo desactivar IMAP al degradar %s: %s", tenant["id"], exc)
                try:
                    add_notification(tenant["id"], "plan", "Tu plan ha pasado a Gratuito",
                                     "Tu suscripción ha finalizado. Puedes volver a mejorar cuando quieras.")
                except Exception:
                    pass
                logger.info("Suscripción cancelada: tenant %s → free", tenant["id"])

    elif etype == "invoice.payment_failed":
        # Pago fallido: avisamos para que actualice la tarjeta (evita baja involuntaria).
        customer_id = obj.get("customer")
        if customer_id:
            tenant = get_tenant_by_stripe_customer(customer_id)
            if tenant:
                try:
                    add_notification(tenant["id"], "pago", "Problema con tu pago",
                                     "No hemos podido cobrar tu suscripción. Actualiza tu tarjeta para no perder el acceso.")
                except Exception:
                    pass
                email = tenant.get("notify_email") or tenant.get("email")
                if email:
                    try:
                        from services.email_sender import send_payment_failed
                        send_payment_failed(email, tenant.get("name", ""), os.getenv("DASHBOARD_URL", ""))
                        logger.info("Aviso de pago fallido enviado a tenant %s", tenant["id"])
                    except Exception as exc:
                        logger.warning("No se pudo avisar de pago fallido (tenant %s): %s", tenant["id"], exc)

    return {"ok": True}
