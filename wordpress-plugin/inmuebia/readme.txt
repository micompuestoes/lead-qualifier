=== Inmuebia — Captación de leads con IA ===
Contributors: inmuebia
Tags: inmobiliaria, leads, formulario, contacto, real estate
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Inserta en tu web el formulario de Inmuebia. Cada consulta se cualifica con IA y llega a tu panel priorizada (CALIENTE/TIBIO/FRÍO).

== Description ==

Conecta tu web WordPress con Inmuebia. Los visitantes rellenan un formulario y
cada consulta se cualifica automáticamente con IA: se puntúa, se clasifica
(CALIENTE / TIBIO / FRÍO) y llega a tu panel priorizada, con un email de
respuesta al interesado y un aviso al agente.

**Cómo funciona la seguridad:** el envío se hace desde el servidor de tu propia
web (PHP → API de Inmuebia). Tu API key nunca aparece en el HTML de la página y
no hay problemas de CORS. Incluye trampa anti-bots (honeypot) y casilla de
consentimiento RGPD.

== Installation ==

1. Sube la carpeta `inmuebia` a `/wp-content/plugins/` (o instala el .zip desde
   Plugins → Añadir nuevo → Subir plugin).
2. Actívalo en el menú **Plugins**.
3. Ve a **Ajustes → Inmuebia** y pega tu **API key** (la encuentras en tu panel
   de Inmuebia, en Perfil → Formulario).
4. Añade el formulario a cualquier página o entrada con el shortcode:

   `[inmuebia_formulario]`

Opcionalmente puedes personalizar los textos:

   `[inmuebia_formulario titulo="Vende tu piso con nosotros" boton="Quiero una valoración"]`

== Frequently Asked Questions ==

= ¿Es segura mi API key? =
Sí. El formulario envía los datos a tu servidor WordPress y es él quien contacta
con Inmuebia. La API key se guarda en tu base de datos y nunca se muestra en la
página web pública.

= ¿Necesito saber programar? =
No. Instalas, pegas la API key y escribes el shortcode. Nada más.

= ¿Funciona con cualquier tema? =
Sí. El formulario hereda la tipografía de tu tema y puedes cambiar el color de
acento desde Ajustes.

== Changelog ==

= 1.0.0 =
* Primera versión: formulario por shortcode, envío server-side, honeypot,
  consentimiento RGPD y página de ajustes.
