# 🚀 Guía de despliegue — Inmobia

Checklist para poner Inmobia en producción y empezar a cobrar. Marca cada paso.

> Arquitectura: **backend** FastAPI (Render/Railway) + **dashboard** Next.js (Vercel) +
> **Clerk** (auth) + **Stripe** (pagos) + **PostgreSQL** + proveedor de email.

---

## 0. Seguridad primero (rotar credenciales) 🔴

Si alguna clave se ha compartido alguna vez, rótala antes de lanzar:

- [ ] **Contraseña de la base de datos** → cámbiala en tu proveedor y actualiza `DATABASE_URL`.
- [ ] **Token de GitHub** → GitHub → Settings → Developer settings → revocar y regenerar.
- [ ] **Claves de Clerk** → Clerk Dashboard → API Keys → *Roll keys*.
- [ ] **Claves de Stripe** → Stripe → Developers → API keys → *Roll*.

> El código está limpio: `.env` y `*.db` están en `.gitignore` y no hay secretos en el repo.

---

## 1. Clerk (autenticación)

- [ ] Crear aplicación en [clerk.com](https://clerk.com).
- [ ] Copiar **Publishable key** y **Secret key**.
- [ ] Copiar la **JWKS URL** (`https://<tu-instancia>.clerk.accounts.dev/.well-known/jwks.json`).
- [ ] Apunta tu `user_id` de Clerk (lo verás en tu perfil del dashboard) para `SUPER_ADMIN_USER_ID`.
- [ ] **Renombrar la aplicación en Clerk a "Inmobia"** (Clerk → Settings) — así los emails y pantallas de Clerk no dicen "Lead Qualifier".
- [ ] En Vercel, define `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` y `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` para usar tus propias páginas (no la página alojada de Clerk).

---

## 2. Base de datos (PostgreSQL)

- [ ] Crear una base PostgreSQL en Render/Railway/Neon.
- [ ] Activar **backups automáticos**.
- [ ] Copiar la `DATABASE_URL`.

---

## 3. Stripe (pagos)

- [ ] Activar el modo **Live**.
- [ ] Crear 2 productos con precio recurrente mensual: **Pro (49 €)** y **Agencia (39 €/agente)**.
  - El de Agencia debe ser un precio **por unidad** (per-seat): al crear el precio, cantidad
    ajustable/licencia por unidad. El backend pasa `quantity = nº de agentes` en el checkout
    (mínimo 2 asientos — así Agencia nunca cuesta menos que Pro) y sincroniza los asientos
    (con prorrateo) al añadir o quitar miembros del equipo.
- [ ] Copiar los **Price ID** → `STRIPE_PRICE_PRO` y `STRIPE_PRICE_AGENCIA`.
- [ ] Crear un **webhook** apuntando a `https://<tu-api>/billing/webhook` con los eventos:
  `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_failed` (para avisar de pagos fallidos y reducir bajas involuntarias).
- [ ] Activar **Smart Retries** en Stripe (Settings → Billing → Subscriptions and emails) para reintentar
  pagos fallidos automáticamente.
- [ ] Copiar el **Signing secret** del webhook → `STRIPE_WEBHOOK_SECRET`.

---

## 4. Email + dominio (entregabilidad) 🔴

Sin esto, los emails caen en spam y el producto pierde su valor.

> ⚠️ **`inmobia.es` NO es nuestro** (comprobado 2026-07-22: registrado por un
> tercero en Strato). PROHIBIDO enviar email con remitente `@inmobia.es` —
> sería suplantar un dominio ajeno. Todos los pasos siguientes son con el
> dominio propio `<tudominio>` que se compre.

- [ ] **Comprar el dominio propio** (10-15 €/año en Namecheap, IONOS, Porkbun…).
      Candidatos con `.es` y `.com` libres a 2026-07-22: `inmoagil`, `inmoveloz`.
- [ ] Elegir proveedor de envío: **Resend** (recomendado: gratis hasta 3.000
      emails/mes, verificación de dominio sencilla) o Postmark/SendGrid.
- [ ] En el proveedor: **Add domain** → `<tudominio>` → te dará 3-4 registros DNS.
- [ ] En el panel DNS del registrador, añadir esos registros tal cual:
  - [ ] **SPF** — TXT en `@` o en el subdominio que indique el proveedor
        (p. ej. `v=spf1 include:amazonses.com ~all` en el caso de Resend).
  - [ ] **DKIM** — 1-3 registros TXT/CNAME con nombres tipo `resend._domainkey`.
  - [ ] **DMARC** — TXT en `_dmarc` con valor mínimo:
        `v=DMARC1; p=none; rua=mailto:tu-email-personal` (empezar con `p=none`
        para observar; subir a `p=quarantine` cuando todo llegue bien).
- [ ] Esperar la verificación del proveedor (minutos u horas) hasta ver el dominio en verde.
- [ ] Configurar en Render: `FROM_EMAIL=contacto@<tudominio>` y `FROM_NAME=<marca>`,
      más la clave del proveedor (`SENDGRID_API_KEY` o SMTP del proveedor).
- [ ] Actualizar `DASHBOARD_URL` y el resto de menciones al dominio (código y Vercel).
- [ ] Enviarte un email de prueba (lead de ejemplo) y comprobar: llega a bandeja,
      y en Gmail → "Mostrar original" dice `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.

---

## 5. Backend (Render / Railway)

- [ ] Desplegar la carpeta `lead-qualifier`.
- [ ] Comando de arranque: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- [ ] Configurar variables de entorno (ver `lead-qualifier/.env.example`):
  - [ ] `ANTHROPIC_API_KEY`
  - [ ] `CLERK_JWKS_URL`
  - [ ] `DATABASE_URL`
  - [ ] `DASHBOARD_URL` (URL del dashboard en Vercel) — para CORS
  - [ ] `ADMIN_SECRET_KEY` y `SUPER_ADMIN_USER_ID`
  - [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCIA`
  - [ ] Email: `FROM_EMAIL`, `FROM_NAME` + (`SENDGRID_API_KEY` o `SMTP_*`)
  - [ ] (Opcional) `SENTRY_DSN`
- [ ] Verificar `GET /health` responde `{"status":"ok"}`.

---

## 6. Dashboard (Vercel)

- [ ] Desplegar la carpeta `dashboard`.
- [ ] Configurar variables (ver `dashboard/.env.example`):
  - [ ] `NEXT_PUBLIC_API_URL` (URL del backend)
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY`
  - [ ] `ADMIN_SECRET_KEY` (la **misma** que el backend) y `SUPER_ADMIN_USER_ID`
  - [ ] (Opcional) `NEXT_PUBLIC_SENTRY_DSN` y `SENTRY_DSN`
- [ ] Apuntar el dominio (p. ej. `app.inmobia.es`) a Vercel.

---

## 7. Monitorización y fiabilidad

- [ ] **Sentry** (opcional): crea proyecto, pega el DSN en backend y dashboard. Ya está integrado en el código.
- [ ] **UptimeRobot**: ping a `https://<tu-api>/health` cada 5 min (evita el cold start de Render).

---

## 8. Legal

- [ ] Revisar `/terminos` y `/privacidad` y rellenar tus datos reales:
  razón social, NIF, domicilio fiscal y email de contacto.

---

## 9. Prueba end-to-end (antes de anunciar) ✅

- [ ] Registrarte como usuario nuevo → ves el onboarding.
- [ ] Configurar empresa en el perfil.
- [ ] Abrir el formulario público `/form/<api_key>` y enviar una consulta.
- [ ] El lead aparece en el dashboard cualificado (CALIENTE/TIBIO/FRÍO).
- [ ] Llega el email de respuesta al lead y el aviso a la agencia (revisa que no van a spam).
- [ ] Contratar el plan Pro con una tarjeta real → el plan sube tras el pago.
- [ ] Conectar una bandeja IMAP (Pro/Agencia) y comprobar que sincroniza.
- [ ] Cancelar la suscripción desde el perfil → confirma el mensaje de fin de período.

---

Hecho esto, estás listo para lanzar. 🎉
