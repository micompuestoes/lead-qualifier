# Lead Qualifier — Backend (FastAPI)

API multi-tenant que cualifica leads inmobiliarios. El análisis, el perfil y la
puntuación son **deterministas** (Python puro, instantáneo y gratis); la IA de
Anthropic se usa para **una sola cosa**: redactar el email de respuesta. Esto
mantiene el coste y la latencia en 1 llamada por lead.

## Arquitectura

El proyecto está organizado por responsabilidad. `main.py` solo ensambla la app
(middleware, ciclo de vida y routers); la lógica vive en módulos enfocados.

```
lead-qualifier/
├── main.py              # Ensamblado: CORS, lifespan, scheduler, include_router
├── config.py            # Constantes de negocio (límites de plan, rate limits)
├── runtime.py           # Cliente de Anthropic compartido (app + jobs)
├── security.py          # Cifrado Fernet, caché del JWKS de Clerk, rate limiting
├── deps.py              # Dependencias FastAPI: auth multi-tenant, guards de plan/admin
├── notifications.py     # Aviso por email a la agencia cuando entra un buen lead
├── jobs.py              # Jobs del scheduler: sync IMAP, resumen semanal, leads sin contactar
├── models.py            # Modelos Pydantic de dominio (LeadInput, LeadOutput…)
├── prompts.py           # System prompt para la redacción del email
├── core/
│   ├── agent.py         # Orquestación: pipeline determinista + 1 llamada a Claude
│   ├── tools.py         # analyze_intent, lookup_company, score_lead (deterministas)
│   └── database.py      # Capa de datos (SQLite en dev, PostgreSQL en prod)
├── services/
│   ├── email_imap.py    # Lectura IMAP de la bandeja del tenant
│   └── email_sender.py  # Envío de emails (respuesta al lead, avisos, digest)
├── routers/
│   ├── leads.py         # /qualify-lead, /leads…
│   ├── profile.py       # /me, /me/notifications
│   ├── imap.py          # /me/imap  (Pro y Agencia)
│   ├── team.py          # /me/team  (Agencia)
│   ├── intake.py        # /intake/{api_key}  (público, con honeypot + rate limit)
│   ├── billing.py       # /billing/*, /me/subscription  (Stripe)
│   ├── stats.py         # /stats  (Agencia)
│   ├── ads.py           # /generate-ad  (Agencia)
│   ├── admin.py         # /admin/*  (protegido por X-Admin-Key)
│   └── health.py        # /health
└── tests/
    └── test_agent.py    # Script de prueba manual del agente (requiere ANTHROPIC_API_KEY)
```

### Flujo de cualificación

1. `analyze_intent` — detecta operación, tipo de inmueble, zona, presupuesto,
   financiación, urgencia y calidad del mensaje. **Determinista.**
2. `lookup_company` — infiere el perfil del contacto por el dominio del email.
3. `score_lead` — rúbrica determinista → score 1-10 y clasificación
   `CALIENTE` / `TIBIO` / `FRÍO`.
4. `_redactar_email` — **única** llamada a Claude para el email de respuesta
   (con fallback si la IA no está disponible: el lead nunca se queda sin respuesta).
5. Se guarda en la BD y, si el score ≥ `NOTIFY_MIN_SCORE`, se avisa a la agencia.

## Puesta en marcha (local)

```bash
cd lead-qualifier
python -m venv .venv
.venv\Scripts\activate          # Windows (PowerShell: .venv\Scripts\Activate.ps1)
pip install -r requirements.txt
copy .env.example .env          # y rellena ANTHROPIC_API_KEY (mínimo)
uvicorn main:app --reload
```

Sin `CLERK_JWKS_URL`, el backend arranca en **modo dev sin auth** y usa el
tenant `dev-tenant`. Sin `DATABASE_URL`, usa SQLite (`core/leads.db`).

- Documentación interactiva: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). Resumen:

| Variable | Obligatoria | Para qué |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sí | Redacción del email con Claude |
| `CLERK_JWKS_URL` | En prod | Verificación de los JWT de Clerk |
| `DATABASE_URL` | En prod | PostgreSQL (sin ella, SQLite local) |
| `DASHBOARD_URL` / `ALLOWED_ORIGINS` | En prod | CORS del dashboard |
| `ADMIN_SECRET_KEY` | En prod | Endpoints `/admin/*` y derivación de la clave IMAP |
| `FERNET_KEY` | Recomendada | Cifrado de contraseñas IMAP (permite rotar `ADMIN_SECRET_KEY`) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | Para pagos | Suscripciones |
| `SENTRY_DSN` | Opcional | Monitorización de errores |

## Planes y límites

- **Free**: hasta `FREE_LEAD_LIMIT` (10) leads cualificados/mes. Pasado el límite,
  el intake público **captura** el lead sin gastar IA (no se pierde).
- **Pro**: IMAP (bandeja de entrada → leads).
- **Agencia**: equipo, estadísticas avanzadas y generador de anuncios.

Los guards `require_plan` / `require_admin` viven en `deps.py`.

## Jobs en segundo plano (`jobs.py`)

| Job | Frecuencia | Qué hace |
|---|---|---|
| `sync_imap_todos` | cada 10 min | Descarga emails no leídos de cada tenant y los cualifica |
| `enviar_resumenes_semanales` | lunes 08:00 UTC | Digest semanal de actividad por agencia |
| `avisar_leads_sin_contactar` | diario 09:00 UTC | Avisa de leads buenos en estado `PENDIENTE` |

## Pruebas

`tests/test_agent.py` es un script de humo que ejecuta el agente completo sobre
un lead de ejemplo (necesita `ANTHROPIC_API_KEY` válida):

```bash
python tests/test_agent.py
```
