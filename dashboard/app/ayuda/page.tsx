'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import PageHeader from '@/components/PageHeader';

// ── Índice de secciones ─────────────────────────────────────────────────────

const TOC = [
  { id: 'empezar',       label: 'Primeros pasos' },
  { id: 'leads',         label: 'Cómo entran los leads' },
  { id: 'cualificacion', label: 'Entender la cualificación' },
  { id: 'gestionar',     label: 'Gestionar tus leads' },
  { id: 'email',         label: 'Email automático' },
  { id: 'herramientas',  label: 'Herramientas (Agencia)' },
  { id: 'planes',        label: 'Planes y facturación' },
  { id: 'faq',           label: 'Preguntas frecuentes' },
];

// ── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'No me llegan leads, ¿qué hago?',
    a: 'Comprueba dos cosas en tu Perfil: (1) que has copiado el enlace de tu formulario público y lo has pegado en tu web, y (2) si tienes plan Pro o Agencia, que has conectado tu bandeja de entrada. También puedes crear un lead manualmente en "Nuevo lead" para probar.',
  },
  {
    q: '¿Por qué un lead aparece como FRÍO?',
    a: 'Un lead es frío cuando el mensaje es vago o no aporta datos útiles (sin operación clara, sin presupuesto, sin zona). No significa que sea malo: significa que hay que cualificarlo. En el detalle del lead verás el razonamiento de la IA explicando por qué.',
  },
  {
    q: '¿El email de respuesta lo envío yo?',
    a: 'No. En cuanto entra un lead, Inmobia le envía automáticamente un email de respuesta redactado por la IA y firmado con el nombre de tu agencia. Cuando el cliente responda, su respuesta llegará a tu email. Tú solo haces el seguimiento.',
  },
  {
    q: '¿Puedo editar el email antes de que se envíe?',
    a: 'El primer email se envía automáticamente para responder rápido (lo que más valoran los clientes). En el detalle del lead tienes ese email para copiarlo, abrirlo en Gmail y continuar la conversación con tus propios matices.',
  },
  {
    q: '¿Es seguro conectar mi correo?',
    a: 'Sí. Tu contraseña se guarda cifrada, solo leemos los mensajes no leídos para convertirlos en leads, y puedes desconectar la bandeja cuando quieras desde tu Perfil.',
  },
  {
    q: '¿Cómo cambio de plan o cancelo?',
    a: 'Desde Perfil → Suscripción. Puedes gestionar el pago en el portal de Stripe o cancelar; si cancelas, conservas el acceso hasta el final del período ya pagado.',
  },
  {
    q: 'He llegado al límite del plan gratuito',
    a: 'El plan Free incluye 10 leads al mes. Cuando lo alcanzas, los nuevos leads se pausan hasta el mes siguiente o hasta que mejores a Pro (leads ilimitados). Puedes mejorar en cualquier momento desde Planes.',
  },
];

// ── Página ───────────────────────────────────────────────────────────────────

export default function AyudaPage() {
  const { c } = useTheme();
  const [faqAbierta, setFaqAbierta] = useState<number | null>(0);

  const card: React.CSSProperties = {
    background: c.card, border: c.cardBorder, borderRadius: 16, padding: 26, marginBottom: 20,
  };
  const h2: React.CSSProperties = {
    fontFamily: "'DM Serif Display', Georgia, serif",
    fontSize: '1.4rem', color: c.text1, letterSpacing: '-0.02em', margin: 0, marginBottom: 6,
  };
  const eyebrow: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase',
    color: '#c8a96e', marginBottom: 14,
  };
  const p: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.7, color: c.text2, marginBottom: 12 };
  const strong = { color: c.text1, fontWeight: 600 };

  // Paso numerado
  const Paso = ({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
      <span style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(200,169,110,0.15)', color: '#9a7a3a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700,
      }}>{n}</span>
      <div style={{ flex: 1, paddingTop: 2 }}>
        <p style={{ fontSize: 14.5, fontWeight: 600, color: c.text1, marginBottom: 3 }}>{titulo}</p>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: c.text2 }}>{children}</p>
      </div>
    </div>
  );

  // Etiqueta de temperatura
  const Temp = ({ color, label, rango, desc }: { color: string; label: string; rango: string; desc: string }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }} />
      <div>
        <p style={{ fontSize: 14, color: c.text1 }}>
          <span style={{ fontWeight: 600 }}>{label}</span>
          <span style={{ color: c.text2, marginLeft: 8, fontSize: 12.5 }}>{rango}</span>
        </p>
        <p style={{ fontSize: 13, color: c.text2, lineHeight: 1.55, marginTop: 2 }}>{desc}</p>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 32, maxWidth: 1080, margin: '0 auto' }}>
      <PageHeader
        eyebrow="Centro de ayuda"
        title="Guía de Inmobia"
        description="Todo lo que necesitas para sacar partido a la plataforma. Si te pierdes, empieza por aquí."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 220px', gap: 32, alignItems: 'start' }} className="ayuda-grid">

        {/* ── Contenido ── */}
        <div>

          {/* Primeros pasos */}
          <section id="empezar" style={card}>
            <p style={eyebrow}>Empezar</p>
            <h2 style={h2}>Pon Inmobia a funcionar en 4 pasos</h2>
            <p style={{ ...p, marginBottom: 20 }}>Sigue este orden la primera vez. Lo tienes también como checklist en tu <Link href="/" style={{ color: '#9a7a3a', textDecoration: 'none', fontWeight: 600 }}>Inicio</Link>.</p>
            <Paso n={1} titulo="Configura tu empresa">
              Ve a <strong style={strong}>Perfil</strong> y pon el nombre de tu agencia y el email donde quieres recibir los avisos de leads.
            </Paso>
            <Paso n={2} titulo="Comparte tu formulario de captación">
              En <strong style={strong}>Perfil</strong> tienes un enlace único. Pégalo en tu web o redes: cada consulta que reciban entrará aquí ya cualificada.
            </Paso>
            <Paso n={3} titulo="Conecta tu bandeja de entrada (Pro y Agencia)">
              Si tienes plan Pro o Agencia, conecta tu email en <strong style={strong}>Perfil</strong> y los mensajes de clientes se convertirán en leads automáticamente.
            </Paso>
            <Paso n={4} titulo="Recibe y gestiona tus leads">
              Cuando llegue el primer lead aparecerá en <strong style={strong}>Leads</strong>, con su puntuación y un email de respuesta ya redactado.
            </Paso>
          </section>

          {/* Cómo entran los leads */}
          <section id="leads" style={card}>
            <p style={eyebrow}>Captación</p>
            <h2 style={h2}>Cómo entran los leads</h2>
            <p style={p}>Hay tres formas de que un contacto llegue a tu panel:</p>
            <p style={p}>
              <strong style={strong}>1. Formulario público.</strong> El enlace de tu Perfil abre un formulario con tu marca. Compártelo en tu web, en tu bio de Instagram o por WhatsApp. Es la vía recomendada.
            </p>
            <p style={p}>
              <strong style={strong}>2. Tu correo (Pro y Agencia).</strong> Al conectar tu bandeja, Inmobia revisa cada pocos minutos los emails nuevos de posibles clientes y los cualifica solos. Los correos automáticos y newsletters se ignoran.
            </p>
            <p style={{ ...p, marginBottom: 0 }}>
              <strong style={strong}>3. Manualmente.</strong> Desde <strong style={strong}>Nuevo lead</strong> puedes pegar el mensaje de un cliente y cualificarlo al instante. Ideal para probar o para contactos que te llegan por teléfono.
            </p>
          </section>

          {/* Cualificación */}
          <section id="cualificacion" style={card}>
            <p style={eyebrow}>La IA</p>
            <h2 style={h2}>Entender la cualificación</h2>
            <p style={p}>
              Cada lead recibe una <strong style={strong}>puntuación de 1 a 10</strong> y un color según lo cerca que está de cerrar una operación. La IA detecta la operación (comprar, vender, alquilar, invertir), el presupuesto, la financiación, la zona y la urgencia.
            </p>
            <div style={{ marginTop: 16, marginBottom: 8 }}>
              <Temp color="#c8796e" label="Caliente" rango="8 – 10" desc="Listo para actuar: tiene presupuesto, financiación o urgencia. O quiere vender (¡inventario!). Llámale cuanto antes." />
              <Temp color="#c8a96e" label="Tibio" rango="5 – 7" desc="Interés real pero faltan datos. Un buen lead que conviene cualificar con un par de preguntas." />
              <Temp color="#6ea8c8" label="Frío" rango="1 – 4" desc="Mensaje vago o sin contexto. Mantenlo en seguimiento; puede madurar." />
            </div>
            <p style={{ ...p, marginBottom: 0, marginTop: 8 }}>
              En el <strong style={strong}>detalle de cada lead</strong> verás el <strong style={strong}>razonamiento</strong>: por qué la IA le ha dado esa puntuación, en una línea. Úsalo para decidir tu siguiente paso.
            </p>
          </section>

          {/* Gestionar */}
          <section id="gestionar" style={card}>
            <p style={eyebrow}>Día a día</p>
            <h2 style={h2}>Gestionar tus leads</h2>
            <p style={p}>
              <strong style={strong}>Estados.</strong> Cada lead pasa por Pendiente → Contactado → Cerrado (o Descartado). Cámbialo directamente desde la tarjeta o desde el detalle; se guarda solo.
            </p>
            <p style={p}>
              <strong style={strong}>Filtrar y buscar.</strong> En Leads, pulsa las tarjetas de Caliente/Tibio/Frío para filtrar por temperatura, usa el selector de estado y el buscador por nombre, email o mensaje.
            </p>
            <p style={{ ...p, marginBottom: 0 }}>
              <strong style={strong}>Exportar (Pro y Agencia).</strong> El botón "CSV" descarga todos tus leads para llevarlos a tu CRM o a Excel.
            </p>
          </section>

          {/* Email automático */}
          <section id="email" style={card}>
            <p style={eyebrow}>Respuestas</p>
            <h2 style={h2}>El email automático</h2>
            <p style={p}>
              Nada más entrar un lead, le enviamos un email de respuesta redactado por la IA, en español, firmado con el nombre de tu agencia y adaptado a su caso (a un comprador caliente se le propone una visita; a uno vago se le piden datos).
            </p>
            <p style={p}>
              Cuando el cliente <strong style={strong}>responda</strong>, su mensaje llegará a tu correo: puedes seguir la conversación con normalidad.
            </p>
            <p style={{ ...p, marginBottom: 0 }}>
              Además, tú recibes un <strong style={strong}>aviso</strong> en tu email de notificaciones por cada lead que merece la pena (tibio o caliente), para que no se te escape ninguno.
            </p>
          </section>

          {/* Herramientas */}
          <section id="herramientas" style={card}>
            <p style={eyebrow}>Plan Agencia</p>
            <h2 style={h2}>Herramientas avanzadas</h2>
            <p style={p}>
              <strong style={strong}>Generador de anuncios IA.</strong> Describe un inmueble y la IA redacta los textos listos para publicar en Idealista, redes sociales y email, cada uno con su tono y longitud.
            </p>
            <p style={p}>
              <strong style={strong}>Estadísticas.</strong> Analiza tu cartera: total de leads, temperatura, score medio y un calendario de actividad para ver tus mejores días.
            </p>
            <p style={{ ...p, marginBottom: 0 }}>
              <strong style={strong}>Equipo.</strong> Añade a tus agentes para que trabajen sobre el mismo panel. Cada uno entra con su cuenta.
            </p>
          </section>

          {/* Planes */}
          <section id="planes" style={card}>
            <p style={eyebrow}>Suscripción</p>
            <h2 style={h2}>Planes y facturación</h2>
            <p style={p}>
              <strong style={strong}>Free.</strong> 10 leads al mes con cualificación por IA y formulario público. Ideal para probar.
            </p>
            <p style={p}>
              <strong style={strong}>Pro.</strong> Leads ilimitados, conexión de tu correo, avisos por email y exportación a CSV.
            </p>
            <p style={p}>
              <strong style={strong}>Agencia.</strong> Todo lo de Pro más el generador de anuncios, estadísticas avanzadas y varios usuarios.
            </p>
            <p style={{ ...p, marginBottom: 16 }}>
              Gestiona o cancela tu plan cuando quieras desde Perfil → Suscripción. Si cancelas, mantienes el acceso hasta el final del período pagado.
            </p>
            <Link href="/pricing" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '10px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600,
              background: '#c8a96e', color: '#1a1814', textDecoration: 'none',
              boxShadow: '0 2px 12px rgba(200,169,110,0.35)',
            }}>
              Ver planes
            </Link>
          </section>

          {/* FAQ */}
          <section id="faq" style={card}>
            <p style={eyebrow}>Dudas</p>
            <h2 style={{ ...h2, marginBottom: 18 }}>Preguntas frecuentes</h2>
            <div>
              {FAQ.map((item, i) => {
                const abierta = faqAbierta === i;
                return (
                  <div key={i} style={{ borderTop: `1px solid ${c.divider}` }}>
                    <button
                      onClick={() => setFaqAbierta(abierta ? null : i)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 12, padding: '15px 2px', background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left',
                      }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: c.text1 }}>{item.q}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.text2} strokeWidth="2.2"
                        strokeLinecap="round" strokeLinejoin="round"
                        style={{ flexShrink: 0, transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {abierta && (
                      <p style={{ fontSize: 13.5, lineHeight: 1.7, color: c.text2, padding: '0 2px 16px' }}>
                        {item.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Soporte */}
          <div style={{
            ...card, marginBottom: 0, textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(200,169,110,0.10) 0%, rgba(200,169,110,0.03) 100%)',
            border: '1.5px solid rgba(200,169,110,0.28)',
          }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: c.text1, marginBottom: 6 }}>¿Sigues con dudas?</p>
            <p style={{ fontSize: 13.5, color: c.text2, marginBottom: 16 }}>
              Escríbenos y te ayudamos personalmente.
            </p>
            <a href="mailto:contacto@inmobia.es" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600,
              background: c.card, color: c.text1, border: `1.5px solid ${c.inputBorder}`, textDecoration: 'none',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              contacto@inmobia.es
            </a>
          </div>
        </div>

        {/* ── Índice lateral (sticky) ── */}
        <nav className="ayuda-toc" style={{ position: 'sticky', top: 32 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.text2, marginBottom: 12, paddingLeft: 12 }}>
            En esta guía
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {TOC.map(t => (
              <a key={t.id} href={`#${t.id}`} style={{
                fontSize: 13, color: c.text2, textDecoration: 'none',
                padding: '7px 12px', borderRadius: 8, transition: 'background 0.15s, color 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,110,0.08)'; (e.currentTarget as HTMLElement).style.color = c.text1; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = c.text2; }}
              >
                {t.label}
              </a>
            ))}
          </div>
        </nav>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .ayuda-grid { grid-template-columns: 1fr !important; }
          .ayuda-toc  { display: none !important; }
        }
      `}</style>
    </div>
  );
}
