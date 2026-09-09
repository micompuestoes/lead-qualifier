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
