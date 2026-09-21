"""
Constantes de negocio del Lead Qualifier.

Centralizadas aquí para no tenerlas dispersas por los endpoints y poder
ajustarlas en un solo sitio.
"""

# Límite de leads cualificados al mes en el plan gratuito.
FREE_LEAD_LIMIT = 10

# Solo se avisa a la agencia de leads que merecen la pena (TIBIO y CALIENTE).
# Los FRÍO (score < 5) quedan en el dashboard pero no generan email de aviso.
NOTIFY_MIN_SCORE = 5

# El aviso por WhatsApp es más intrusivo (suena en el móvil del agente), así que
# se reserva para leads CALIENTE (score >= 8): los que hay que atender ya.
WHATSAPP_MIN_SCORE = 8

# Mínimo de asientos facturables del plan Agencia (39€/agente). Garantiza que
# Agencia (2 × 39 = 78€) nunca cueste menos que Pro (49€): sin esto, a un agente
# solo le saldría más barato colarse en Agencia teniendo más funciones.
# Si lo cambias, revisa el precio y la nota del plan en dashboard/lib/plans.ts.
MIN_AGENCY_SEATS = 2

# Rate limiting del formulario público (sliding window persistido en BD, ver
# core/database.check_rate_limit — así el límite es el mismo sin importar a
# qué instancia del backend llega la petición).
# Por IP (anti-spam individual) y por api_key (cap de coste por agencia).
RATE_IP_PER_MIN = 5
RATE_IP_PER_HOUR = 30
RATE_KEY_PER_MIN = 20
RATE_KEY_PER_HOUR = 200

# Rate limiting de /qualify-lead para tenants autenticados (planes de pago).
# Generoso para no molestar a una agencia con tráfico real, pero acota el
# coste de IA si una cuenta se ve comprometida o un cliente hace un bucle.
RATE_TENANT_PER_MIN = 30
RATE_TENANT_PER_HOUR = 300

# Rate limiting de /demo/qualify — demo pública sin registro en la landing.
# Más estricto que el resto: aquí NO hay ninguna relación comercial (ni
# api_key ni tenant) que sirva de segundo filtro, así que el único freno es
# la IP... y un techo GLOBAL diario (bucket "demo:global") para acotar el
# gasto máximo si alguien reparte el tráfico entre muchas IPs distintas.
RATE_DEMO_IP_PER_MIN = 2
RATE_DEMO_IP_PER_HOUR = 6
RATE_DEMO_GLOBAL_PER_MIN = 15
RATE_DEMO_GLOBAL_PER_HOUR = 100
RATE_DEMO_GLOBAL_PER_DAY = 300

# Rate limiting de /generate-ad. A diferencia de /qualify-lead (que recibe
# tráfico real de clientes de forma continua), esto es una acción manual que
# un agente pulsa a mano para un inmueble concreto — nadie legítimo necesita
# generar decenas por minuto, así que el límite es mucho más ajustado. Antes
# no tenía ningún tope: cada llamada cuesta un uso real de la API de Claude.
RATE_AD_TENANT_PER_MIN = 5
RATE_AD_TENANT_PER_HOUR = 30

# Ventana anti-doble-envío: un lead con el mismo tenant, email y mensaje que
# otro ya guardado hace menos de esto se considera un duplicado (doble clic o
# reintento de red del formulario) y no se vuelve a cualificar ni a responder.
DUPLICATE_LEAD_WINDOW_SECONDS = 120

# Precio de Claude (USD por millón de tokens) usado SOLO para estimar el coste
# interno por lead — no es la tarifa exacta de facturación de Anthropic, que
# puede variar. Sirve para vigilar el margen por tenant a medida que crece el
# uso de pago. Ajustar si cambia CLAUDE_MODEL en core/agent.py.
CLAUDE_PRICE_INPUT_PER_MTOK = 3.0
CLAUDE_PRICE_OUTPUT_PER_MTOK = 15.0
