<?php
/**
 * Plugin Name:       Inmuebia — Captación de leads con IA
 * Plugin URI:        https://www.inmuebia.es
 * Description:       Inserta en tu web el formulario de Inmuebia. Cada consulta se cualifica con IA y llega a tu panel priorizada (CALIENTE/TIBIO/FRÍO). Usa el shortcode [inmuebia_formulario].
 * Version:           1.0.1
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Inmuebia
 * License:           GPLv2 or later
 * Text Domain:       inmuebia
 *
 * El envío se hace SERVER-SIDE (PHP → API de Inmuebia): así la API key nunca
 * aparece en el HTML de la página y no hay problemas de CORS con el navegador.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Sin acceso directo.
}

define( 'INMUEBIA_VERSION', '1.0.1' );
// URL base de la API de Inmuebia. Se puede sobrescribir en Ajustes o con el
// filtro `inmuebia_api_base` si tu backend está en otro dominio.
// OJO: api.inmuebia.es nunca se llegó a configurar en DNS (dominio inexistente,
// confirmado con varios resolutores) — con eso de valor por defecto, TODAS las
// instalaciones del plugin fallaban en silencio en cada envío. El backend real
// vive en la URL de Render hasta que (si acaso) se apunte un CNAME de verdad.
define( 'INMUEBIA_DEFAULT_API_BASE', 'https://lead-qualifier-backend-33jt.onrender.com' );

/* -------------------------------------------------------------------------
 *  Ajustes (Ajustes → Inmuebia)
 * ---------------------------------------------------------------------- */

function inmuebia_get_option( $key, $default = '' ) {
	$opts = get_option( 'inmuebia_settings', array() );
	return isset( $opts[ $key ] ) && $opts[ $key ] !== '' ? $opts[ $key ] : $default;
}

function inmuebia_api_base() {
	$base = inmuebia_get_option( 'api_base', INMUEBIA_DEFAULT_API_BASE );
	/** Permite forzar la URL de la API desde el tema/otro plugin. */
	$base = apply_filters( 'inmuebia_api_base', $base );
	return untrailingslashit( trim( $base ) );
}

add_action( 'admin_menu', function () {
	add_options_page(
		'Inmuebia',
		'Inmuebia',
		'manage_options',
		'inmuebia',
		'inmuebia_render_settings_page'
	);
} );

add_action( 'admin_init', function () {
	register_setting( 'inmuebia', 'inmuebia_settings', array(
		'type'              => 'array',
		'sanitize_callback' => 'inmuebia_sanitize_settings',
		'default'           => array(),
	) );
} );

function inmuebia_sanitize_settings( $input ) {
	return array(
		'api_key'         => isset( $input['api_key'] ) ? sanitize_text_field( $input['api_key'] ) : '',
		'api_base'        => isset( $input['api_base'] ) ? esc_url_raw( $input['api_base'] ) : '',
		'accent'          => isset( $input['accent'] ) ? sanitize_hex_color( $input['accent'] ) : '',
		'privacy_url'     => isset( $input['privacy_url'] ) ? esc_url_raw( $input['privacy_url'] ) : '',
		'success_message' => isset( $input['success_message'] ) ? sanitize_text_field( $input['success_message'] ) : '',
	);
}

function inmuebia_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$api_key     = inmuebia_get_option( 'api_key' );
	$api_base    = inmuebia_get_option( 'api_base', INMUEBIA_DEFAULT_API_BASE );
	$accent      = inmuebia_get_option( 'accent', '#2c2a26' );
	$privacy_url = inmuebia_get_option( 'privacy_url' );
	$success     = inmuebia_get_option( 'success_message', 'Gracias por tu consulta. En breve nos pondremos en contacto contigo.' );
	?>
	<div class="wrap">
		<h1>Inmuebia</h1>
		<p>Conecta tu web con Inmuebia. Pega tu <strong>API key</strong> (la encuentras en tu panel, en <em>Perfil → Formulario</em>) y añade el formulario a cualquier página con el shortcode:</p>
		<p><code>[inmuebia_formulario]</code></p>
		<form method="post" action="options.php">
			<?php settings_fields( 'inmuebia' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="inmuebia_api_key">API key</label></th>
					<td><input name="inmuebia_settings[api_key]" id="inmuebia_api_key" type="text" class="regular-text" value="<?php echo esc_attr( $api_key ); ?>" placeholder="lq_xxxxxxxxxxxx" autocomplete="off" /></td>
				</tr>
				<tr>
					<th scope="row"><label for="inmuebia_api_base">URL de la API</label></th>
					<td>
						<input name="inmuebia_settings[api_base]" id="inmuebia_api_base" type="url" class="regular-text" value="<?php echo esc_attr( $api_base ); ?>" placeholder="<?php echo esc_attr( INMUEBIA_DEFAULT_API_BASE ); ?>" />
						<p class="description">Déjalo por defecto salvo que Inmuebia te indique otra.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="inmuebia_privacy_url">URL de política de privacidad</label></th>
					<td><input name="inmuebia_settings[privacy_url]" id="inmuebia_privacy_url" type="url" class="regular-text" value="<?php echo esc_attr( $privacy_url ); ?>" placeholder="https://tuweb.es/privacidad" />
						<p class="description">Se enlaza en la casilla de consentimiento RGPD. Recomendado.</p></td>
				</tr>
				<tr>
					<th scope="row"><label for="inmuebia_accent">Color de acento</label></th>
					<td><input name="inmuebia_settings[accent]" id="inmuebia_accent" type="text" value="<?php echo esc_attr( $accent ); ?>" placeholder="#2c2a26" />
						<p class="description">Ponlo del color de tu marca (botón y bordes activos del formulario).</p></td>
				</tr>
				<tr>
					<th scope="row"><label for="inmuebia_success">Mensaje de éxito</label></th>
					<td><input name="inmuebia_settings[success_message]" id="inmuebia_success" type="text" class="large-text" value="<?php echo esc_attr( $success ); ?>" /></td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>

		<hr>
		<h2>Estado de la conexión</h2>
		<?php
		if ( empty( $api_key ) ) {
			echo '<p style="color:#b32d2e;">⚠️ Falta la API key. El formulario no funcionará hasta que la pegues arriba.</p>';
		} else {
			echo '<p style="color:#1a7f37;">✅ API key configurada. Ya puedes usar <code>[inmuebia_formulario]</code> en tus páginas.</p>';
		}
		?>
	</div>
	<?php
}

// Aviso en la lista de plugins si falta configurar la API key.
add_action( 'admin_notices', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$screen = get_current_screen();
	if ( $screen && $screen->id === 'plugins' && ! inmuebia_get_option( 'api_key' ) ) {
		$url = admin_url( 'options-general.php?page=inmuebia' );
		echo '<div class="notice notice-warning is-dismissible"><p>Inmuebia está activo pero falta tu API key. <a href="' . esc_url( $url ) . '">Configúrala aquí</a>.</p></div>';
	}
} );

// Enlace directo a Ajustes desde la lista de plugins.
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), function ( $links ) {
	$settings = '<a href="' . esc_url( admin_url( 'options-general.php?page=inmuebia' ) ) . '">Ajustes</a>';
	array_unshift( $links, $settings );
	return $links;
} );

/* -------------------------------------------------------------------------
 *  Shortcode: [inmuebia_formulario]
 * ---------------------------------------------------------------------- */

add_shortcode( 'inmuebia_formulario', 'inmuebia_render_form' );

function inmuebia_render_form( $atts ) {
	$atts = shortcode_atts( array(
		'titulo'   => '¿Buscas o vendes una vivienda?',
		'subtitulo'=> 'Cuéntanos qué necesitas y te respondemos enseguida.',
		'boton'    => 'Enviar consulta',
	), $atts, 'inmuebia_formulario' );

	if ( ! inmuebia_get_option( 'api_key' ) ) {
		// No exponemos el motivo al visitante; avisamos solo al admin.
		if ( current_user_can( 'manage_options' ) ) {
			return '<p><em>[Inmuebia: falta configurar la API key en Ajustes → Inmuebia]</em></p>';
		}
		return '';
	}

	$accent      = inmuebia_get_option( 'accent', '#2c2a26' );
	$privacy_url = inmuebia_get_option( 'privacy_url' );
	$uid         = 'inmuebia-' . wp_generate_password( 6, false );
	$endpoint    = esc_url( rest_url( 'inmuebia/v1/lead' ) );

	ob_start();
	?>
	<div class="inmuebia-form-wrap" id="<?php echo esc_attr( $uid ); ?>" style="--inmuebia-accent: <?php echo esc_attr( $accent ); ?>;">
		<style>
			#<?php echo esc_attr( $uid ); ?> .inmuebia-card{max-width:520px;margin:0 auto;padding:1.75rem;border:1px solid #e7e2d8;border-radius:14px;background:#fff;font-family:inherit;box-shadow:0 1px 3px rgba(0,0,0,.04)}
			#<?php echo esc_attr( $uid ); ?> h3{margin:0 0 .25rem;font-size:1.35rem;color:#2c2a26}
			#<?php echo esc_attr( $uid ); ?> .inmuebia-sub{margin:0 0 1.25rem;color:#6b655c;font-size:.95rem}
			#<?php echo esc_attr( $uid ); ?> label{display:block;font-size:.85rem;font-weight:600;color:#4a453d;margin:.75rem 0 .25rem}
			#<?php echo esc_attr( $uid ); ?> input,#<?php echo esc_attr( $uid ); ?> textarea{width:100%;box-sizing:border-box;padding:.65rem .8rem;border:1px solid #d8d2c6;border-radius:9px;font-size:1rem;font-family:inherit;background:#fdfcfa}
			#<?php echo esc_attr( $uid ); ?> input:focus,#<?php echo esc_attr( $uid ); ?> textarea:focus{outline:none;border-color:var(--inmuebia-accent);box-shadow:0 0 0 3px rgba(154,122,58,.15)}
			#<?php echo esc_attr( $uid ); ?> textarea{min-height:96px;resize:vertical}
			#<?php echo esc_attr( $uid ); ?> .inmuebia-consent{display:flex;gap:.5rem;align-items:flex-start;margin:.9rem 0;font-size:.82rem;color:#6b655c}
			#<?php echo esc_attr( $uid ); ?> .inmuebia-consent input{width:auto;margin-top:.15rem}
			#<?php echo esc_attr( $uid ); ?> button{width:100%;margin-top:.4rem;padding:.8rem;border:0;border-radius:9px;background:var(--inmuebia-accent);color:#fff;font-size:1rem;font-weight:600;cursor:pointer;transition:opacity .15s}
			#<?php echo esc_attr( $uid ); ?> button:hover{opacity:.9}
			#<?php echo esc_attr( $uid ); ?> button[disabled]{opacity:.6;cursor:default}
			#<?php echo esc_attr( $uid ); ?> .inmuebia-hp{position:absolute;left:-9999px;top:-9999px;height:0;overflow:hidden}
			#<?php echo esc_attr( $uid ); ?> .inmuebia-msg{margin-top:1rem;padding:.8rem;border-radius:9px;font-size:.9rem;display:none}
			#<?php echo esc_attr( $uid ); ?> .inmuebia-msg.ok{display:block;background:#eaf6ee;color:#1a7f37}
			#<?php echo esc_attr( $uid ); ?> .inmuebia-msg.err{display:block;background:#fdeceb;color:#b32d2e}
		</style>
		<form class="inmuebia-card" novalidate>
			<h3><?php echo esc_html( $atts['titulo'] ); ?></h3>
			<p class="inmuebia-sub"><?php echo esc_html( $atts['subtitulo'] ); ?></p>

			<label>Nombre*<input type="text" name="name" required minlength="2" maxlength="100" autocomplete="name"></label>
			<label>Email*<input type="email" name="email" required maxlength="150" autocomplete="email"></label>
			<label>Teléfono<input type="tel" name="phone" maxlength="20" autocomplete="tel"></label>
			<label>¿Qué necesitas?*<textarea name="message" required minlength="5" maxlength="2000" placeholder="Ej.: Busco un piso de 2 habitaciones en el centro, presupuesto 250.000€…"></textarea></label>

			<!-- Honeypot anti-bots: invisible para humanos -->
			<div class="inmuebia-hp" aria-hidden="true"><label>No rellenar<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>

			<label class="inmuebia-consent">
				<input type="checkbox" name="consent" required>
				<span>He leído y acepto la <?php echo $privacy_url ? '<a href="' . esc_url( $privacy_url ) . '" target="_blank" rel="noopener">política de privacidad</a>' : 'política de privacidad'; ?>.</span>
			</label>

			<button type="submit"><?php echo esc_html( $atts['boton'] ); ?></button>
			<div class="inmuebia-msg" role="status" aria-live="polite"></div>
		</form>
	</div>

	<script>
	( function () {
		var root = document.getElementById( <?php echo wp_json_encode( $uid ); ?> );
		if ( ! root ) { return; }
		var form = root.querySelector( 'form' );
		var msg  = root.querySelector( '.inmuebia-msg' );
		var btn  = root.querySelector( 'button' );
		var endpoint = <?php echo wp_json_encode( $endpoint ); ?>;
		var okText   = <?php echo wp_json_encode( inmuebia_get_option( 'success_message', 'Gracias por tu consulta. En breve nos pondremos en contacto contigo.' ) ); ?>;

		form.addEventListener( 'submit', function ( e ) {
			e.preventDefault();
			msg.className = 'inmuebia-msg';
			if ( ! form.checkValidity() ) { form.reportValidity(); return; }

			var data = {
				name:    form.name.value.trim(),
				email:   form.email.value.trim(),
				phone:   form.phone.value.trim(),
				message: form.message.value.trim(),
				website: form.website.value // honeypot
			};

			btn.disabled = true;
			var original = btn.textContent;
			btn.textContent = 'Enviando…';

			fetch( endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( data )
			} )
			.then( function ( r ) { return r.json().then( function ( j ) { return { ok: r.ok, body: j }; } ); } )
			.then( function ( res ) {
				if ( res.ok ) {
					form.reset();
					msg.textContent = okText;
					msg.className = 'inmuebia-msg ok';
				} else {
					msg.textContent = ( res.body && res.body.message ) || 'No hemos podido enviar tu consulta. Inténtalo de nuevo en unos minutos.';
					msg.className = 'inmuebia-msg err';
				}
			} )
			.catch( function () {
				msg.textContent = 'Error de conexión. Revisa tu red e inténtalo de nuevo.';
				msg.className = 'inmuebia-msg err';
			} )
			.finally( function () {
				btn.disabled = false;
				btn.textContent = original;
			} );
		} );
	} )();
	</script>
	<?php
	return ob_get_clean();
}

/* -------------------------------------------------------------------------
 *  Endpoint REST propio: el navegador habla con WordPress (mismo dominio),
 *  y WordPress reenvía server-side a la API de Inmuebia. Sin CORS, y la API
 *  key nunca sale al HTML.
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', function () {
	register_rest_route( 'inmuebia/v1', '/lead', array(
		'methods'             => 'POST',
		'callback'            => 'inmuebia_handle_lead',
		'permission_callback' => '__return_true', // formulario público
	) );
} );

function inmuebia_handle_lead( WP_REST_Request $request ) {
	$api_key = inmuebia_get_option( 'api_key' );
	if ( empty( $api_key ) ) {
		return new WP_REST_Response( array( 'ok' => false, 'message' => 'Formulario no configurado.' ), 503 );
	}

	// Honeypot: si viene relleno, es un bot. Devolvemos OK falso (no damos pistas).
	$honey = (string) $request->get_param( 'website' );
	if ( trim( $honey ) !== '' ) {
		return new WP_REST_Response( array( 'ok' => true, 'message' => 'Recibido.' ), 200 );
	}

	$name    = sanitize_text_field( (string) $request->get_param( 'name' ) );
	$email   = sanitize_email( (string) $request->get_param( 'email' ) );
	$phone   = sanitize_text_field( (string) $request->get_param( 'phone' ) );
	$message = sanitize_textarea_field( (string) $request->get_param( 'message' ) );

	// Validación mínima (la API vuelve a validar, esto ahorra viajes).
	if ( strlen( $name ) < 2 || ! is_email( $email ) || strlen( $message ) < 5 ) {
		return new WP_REST_Response( array( 'ok' => false, 'message' => 'Revisa los datos: nombre, email y mensaje son obligatorios.' ), 422 );
	}

	$payload = array(
		'name'    => $name,
		'email'   => $email,
		'message' => $message,
	);
	if ( $phone !== '' ) {
		$payload['phone'] = $phone;
	}

	$url = inmuebia_api_base() . '/intake/' . rawurlencode( $api_key );

	$response = wp_remote_post( $url, array(
		'timeout' => 15,
		'headers' => array( 'Content-Type' => 'application/json' ),
		'body'    => wp_json_encode( $payload ),
	) );

	if ( is_wp_error( $response ) ) {
		return new WP_REST_Response( array( 'ok' => false, 'message' => 'No hemos podido enviar tu consulta ahora mismo. Inténtalo en unos minutos.' ), 502 );
	}

	$code = wp_remote_retrieve_response_code( $response );
	$body = json_decode( wp_remote_retrieve_body( $response ), true );

	if ( $code >= 200 && $code < 300 ) {
		return new WP_REST_Response( array(
			'ok'      => true,
			'message' => isset( $body['message'] ) ? $body['message'] : 'Tu consulta ha sido recibida.',
		), 200 );
	}

	// Propagamos un mensaje legible (p. ej. rate limit 429 o API key inválida 404).
	$msg = isset( $body['detail'] ) && is_string( $body['detail'] )
		? $body['detail']
		: 'No hemos podido procesar tu consulta. Inténtalo de nuevo más tarde.';

	return new WP_REST_Response( array( 'ok' => false, 'message' => $msg ), $code );
}
