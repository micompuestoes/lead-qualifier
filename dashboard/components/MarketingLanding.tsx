'use client';

// Landing pública de marketing — lo que ve un prospecto que NO ha iniciado sesión.
// Diseño autónomo (no depende del tema del dashboard).

import Link from 'next/link';
import { PLANS } from '@/lib/plans';

const GOLD = '#c8a96e';
const INK  = '#1a1814';
const CREAM = '#f5f0e8';

function Logo({ size = 38 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
      background: 'linear-gradient(135deg, #d4b87a 0%, #c8a96e 45%, #a8895a 100%)',
      boxShadow: '0 6px 18px rgba(200,169,110,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 24 24" fill="none"
        strokeWidth={2.2} stroke={INK} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    </div>
  );
}

const VENTAJAS = [
  {
    titulo: 'Cualifica en segundos',
    desc: 'Cada consulta se analiza y puntúa al instante. Sabes a quién llamar primero sin leer un solo correo.',
    icon: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  },
  {
    titulo: 'Prioriza quien va a cerrar',
    desc: 'Detecta presupuesto, financiación y urgencia. Caliente, tibio o frío — tú a lo importante.',
    icon: <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />,
  },
  {
    titulo: 'Responde al instante',
    desc: 'Email personalizado y profesional enviado automáticamente, firmado con el nombre de tu agencia.',
    icon: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
  },
  {
    titulo: 'Capta desde tu web',
    desc: 'Un formulario con tu marca que convierte cada visita en un lead cualificado en tu panel.',
    icon: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  },
  {
    titulo: 'Conecta tu correo',
    desc: 'Los emails de posibles clientes se convierten solos en leads. Sin copiar y pegar.',
    icon: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></>,
  },
  {
    titulo: 'Anuncios con IA',
    desc: 'Genera textos listos para Idealista, redes sociales y email en un clic.',
    icon: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></>,
  },
];

const PASOS = [
  { n: '01', t: 'Comparte tu formulario', d: 'Pega tu enlace en la web o conecta tu correo.' },
  { n: '02', t: 'La IA cualifica el lead', d: 'Lo puntúa, clasifica y redacta la respuesta.' },
  { n: '03', t: 'Tú cierras la venta', d: 'Llamas primero a quien de verdad va a comprar.' },
];

// Mini-bandeja de ejemplo del hero — misma paleta que los badges reales de la app
const DEMO_LEADS = [
  {
    nombre: 'María García', etiqueta: 'CALIENTE', score: 9,
    detalle: 'Compra · 480.000 € · hipoteca aprobada · quiere visitar esta semana',
    color: '#b45309', bg: 'rgba(180,83,9,0.08)', borde: 'rgba(180,83,9,0.25)',
  },
  {
    nombre: 'Javier Ruiz', etiqueta: 'TIBIO', score: 6,
    detalle: 'Alquiler en el centro · presupuesto por confirmar',
    color: '#9a7a3a', bg: 'rgba(200,169,110,0.14)', borde: 'rgba(200,169,110,0.35)',
  },
  {
    nombre: 'Sofía Romero', etiqueta: 'FRÍO', score: 3,
    detalle: 'Consulta general, sin operación definida todavía',
    color: '#3a7a9a', bg: 'rgba(110,168,200,0.1)', borde: 'rgba(110,168,200,0.3)',
  },
];

export default function MarketingLanding() {
  const sectionPad: React.CSSProperties = { maxWidth: 1080, margin: '0 auto', padding: '0 24px' };

  return (
    <div style={{ background: CREAM, color: INK, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Navbar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(245,240,232,0.82)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(200,169,110,0.2)',
      }}>
        <div style={{ ...sectionPad, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <Logo size={34} />
            <span style={{ fontSize: 17, fontWeight: 600 }}>Inmonia</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/sign-in" style={{ fontSize: 14, fontWeight: 600, color: '#5a544c', textDecoration: 'none', padding: '8px 12px' }}>
              Entrar
            </Link>
            <Link href="/sign-up" style={{
              fontSize: 14, fontWeight: 600, color: INK, textDecoration: 'none',
              padding: '9px 18px', borderRadius: 11, background: GOLD,
              boxShadow: '0 2px 12px rgba(200,169,110,0.4)',
            }}>
              Empieza gratis
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Aura dorada */}
        <div className="animate-aurora" style={{
          position: 'absolute', top: -160, right: -120, width: 520, height: 520, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,169,110,0.28) 0%, transparent 70%)', pointerEvents: 'none',
        }} />
        <div style={{ ...sectionPad, padding: '88px 24px 72px', position: 'relative', textAlign: 'center' }}>
          <span style={{
            display: 'inline-block', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#9a7a3a', background: 'rgba(200,169,110,0.14)',
            border: '1px solid rgba(200,169,110,0.3)', borderRadius: 99, padding: '6px 14px', marginBottom: 24,
          }}>
            IA para inmobiliarias
          </span>
          <h1 style={{
            fontFamily: "'DM Serif Display', Georgia, serif", fontWeight: 400,
            fontSize: 'clamp(2.2rem, 6vw, 3.6rem)', lineHeight: 1.1, letterSpacing: '-0.025em',
            margin: '0 auto 22px', maxWidth: 820,
          }}>
            Deja de perder clientes por responder tarde
          </h1>
          <p style={{ fontSize: 'clamp(15px, 2.5vw, 18px)', lineHeight: 1.6, color: '#5a544c', maxWidth: 620, margin: '0 auto 34px' }}>
            El comprador escribe a varias agencias y se queda con la primera que le responde bien.
            Inmonia cualifica cada consulta y envía una respuesta impecable en menos de un minuto,
            24/7 — también el domingo por la noche.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/sign-up" style={{
              fontSize: 15, fontWeight: 600, color: INK, textDecoration: 'none',
              padding: '14px 28px', borderRadius: 13, background: GOLD,
              boxShadow: '0 4px 20px rgba(200,169,110,0.45)',
            }}>
              Empieza gratis — 10 leads/mes
            </Link>
            <a href="#como-funciona" style={{
              fontSize: 15, fontWeight: 600, color: INK, textDecoration: 'none',
              padding: '14px 28px', borderRadius: 13, background: 'transparent',
              border: '1.5px solid rgba(200,169,110,0.4)',
            }}>
              Cómo funciona
            </a>
          </div>
          <p style={{ fontSize: 13, color: '#8a8278', marginTop: 18 }}>Sin tarjeta · Sin permanencia · En español</p>

          {/* ── Vista del producto: así llegan los leads, ya cualificados ── */}
          <div style={{ maxWidth: 780, margin: '56px auto 0' }}>
            <div style={{
              borderRadius: 18, background: '#fff', overflow: 'hidden', textAlign: 'left',
              border: '1.5px solid rgba(200,169,110,0.28)',
              boxShadow: '0 24px 70px rgba(26,24,20,0.13), 0 6px 20px rgba(200,169,110,0.12)',
            }}>
              {/* Barra de ventana */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px',
                background: '#faf7f1', borderBottom: '1px solid rgba(200,169,110,0.16)',
              }}>
                {['#e2b9b0', '#e6cd97', '#bcd8b4'].map(col => (
                  <span key={col} style={{ width: 10, height: 10, borderRadius: '50%', background: col }} />
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8a8278', fontFamily: 'monospace' }}>
                  app.inmonia.es/leads
                </span>
              </div>
              {/* Mini tarjetas de lead */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
                gap: 12, padding: 16,
              }}>
                {DEMO_LEADS.map(d => (
                  <div key={d.nombre} style={{
                    borderRadius: 12, border: '1px solid rgba(200,169,110,0.2)',
                    padding: 14, background: '#fff',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.nombre}
                      </span>
                      <span style={{
                        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', flexShrink: 0,
                        padding: '2px 7px', borderRadius: 6,
                        background: d.bg, color: d.color, border: `1px solid ${d.borde}`,
                      }}>
                        {d.etiqueta}
                      </span>
                    </div>
                    <p style={{ fontSize: 11.5, color: '#8a8278', lineHeight: 1.5, marginBottom: 11, minHeight: 34 }}>
                      {d.detalle}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(200,169,110,0.12)', overflow: 'hidden' }}>
                        <div style={{ width: `${d.score * 10}%`, height: '100%', borderRadius: 2, background: d.color }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: d.color }}>{d.score}/10</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: '#8a8278', marginTop: 14 }}>
              Así llega cada consulta: puntuada, clasificada y con la respuesta ya redactada.
            </p>
          </div>
        </div>
      </section>

      {/* ── Antes / después: el momento mágico ── */}
      <section style={{ ...sectionPad, padding: '48px 24px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>
            Un ejemplo real
          </p>
          <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontWeight: 400, fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', letterSpacing: '-0.02em', margin: 0 }}>
            De consulta a respuesta enviada, en un minuto
          </h2>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 18, maxWidth: 920, margin: '0 auto', alignItems: 'stretch',
        }}>
          {/* Lo que recibe la agencia */}
          <div style={{
            background: '#fff', border: '1.5px solid rgba(200,169,110,0.18)', borderRadius: 16,
            padding: 24, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a8278' }}>
                Consulta recibida
              </span>
              <span style={{ fontSize: 12, color: '#8a8278', fontFamily: 'monospace' }}>domingo · 21:47</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: '#5a544c', fontStyle: 'italic', flex: 1 }}>
              «Hola, buscamos piso de 3 habitaciones por Chamberí, tenemos unos 480.000€ y la
              hipoteca preaprobada. Nos gustaría visitar algo esta misma semana si puede ser.
              Gracias, María.»
            </p>
          </div>
          {/* Lo que envía Inmonia */}
          <div style={{
            background: '#fff', border: `2px solid ${GOLD}`, borderRadius: 16, padding: 24,
            boxShadow: '0 12px 40px rgba(200,169,110,0.18)', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9a7a3a' }}>
                Respuesta enviada por Inmonia
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', padding: '2px 8px', borderRadius: 6,
                  background: 'rgba(180,83,9,0.08)', color: '#b45309', border: '1px solid rgba(180,83,9,0.25)',
                }}>
                  CALIENTE · 9/10
                </span>
                <span style={{ fontSize: 12, color: '#8a8278', fontFamily: 'monospace' }}>21:48</span>
              </span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: INK, flex: 1, whiteSpace: 'pre-line' }}>
              {'Hola María,\n\nGracias por escribirnos. Con la hipoteca preaprobada y el presupuesto definido, estáis en el mejor momento para encontrar piso en Chamberí. Tenemos opciones de 3 habitaciones que encajan con lo que buscáis y me encantaría enseñároslas esta misma semana.\n\n¿Os viene bien una llamada mañana para organizar las visitas?\n\nUn saludo,\nTu agencia'}
            </p>
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#8a8278', marginTop: 18 }}>
          Mientras tanto, en tu panel: María ya aparece como lead caliente, la primera de la lista para llamar el lunes.
        </p>
      </section>

      {/* ── Ventajas ── */}
      <section style={{ ...sectionPad, padding: '40px 24px 72px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {VENTAJAS.map(v => (
            <div key={v.titulo} style={{
              background: '#fff', border: '1.5px solid rgba(200,169,110,0.18)', borderRadius: 16, padding: 24,
              boxShadow: '0 1px 6px rgba(26,24,20,0.04)',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, marginBottom: 16,
                background: 'rgba(200,169,110,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  {v.icon}
                </svg>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 7 }}>{v.titulo}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: '#5a544c' }}>{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section id="como-funciona" style={{ background: '#fff', borderTop: '1px solid rgba(200,169,110,0.18)', borderBottom: '1px solid rgba(200,169,110,0.18)' }}>
        <div style={{ ...sectionPad, padding: '72px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>
              Cómo funciona
            </p>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontWeight: 400, fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', letterSpacing: '-0.02em', margin: 0 }}>
              De una consulta a una venta, en tres pasos
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
            {PASOS.map(p => (
              <div key={p.n} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 34, color: GOLD,
                  width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
                  background: 'rgba(200,169,110,0.1)', border: '1.5px solid rgba(200,169,110,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{p.n}</div>
                <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 7 }}>{p.t}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: '#5a544c', maxWidth: 260, margin: '0 auto' }}>{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Precios ── */}
      <section style={{ ...sectionPad, padding: '72px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>
            Precios
          </p>
          <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontWeight: 400, fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', letterSpacing: '-0.02em', margin: 0 }}>
            Empieza gratis. Crece cuando quieras.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, maxWidth: 880, margin: '0 auto' }}>
          {PLANS.map(plan => (
            <div key={plan.nombre} style={{
              background: '#fff', borderRadius: 18, padding: 28,
              border: plan.destacado ? `2px solid ${GOLD}` : '1.5px solid rgba(200,169,110,0.2)',
              boxShadow: plan.destacado ? '0 12px 40px rgba(200,169,110,0.22)' : '0 1px 6px rgba(26,24,20,0.04)',
              transform: plan.destacado ? 'translateY(-6px)' : 'none', position: 'relative',
            }}>
              {plan.destacado && (
                <span style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 99,
                  background: GOLD, color: INK, whiteSpace: 'nowrap',
                }}>Más popular</span>
              )}
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 3 }}>{plan.nombre}</h3>
              <p style={{ fontSize: 13, color: '#8a8278', marginBottom: 14 }}>{plan.descripcion}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
                <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em' }}>
                  {plan.precio === 0 ? 'Gratis' : `${plan.precio}€`}
                </span>
                {plan.precio > 0 && (
                  <span style={{ fontSize: 14, color: '#8a8278' }}>
                    {plan.porAsiento ? '/agente al mes' : '/mes'}
                  </span>
                )}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/sign-up" style={{
                display: 'block', textAlign: 'center', fontSize: 14, fontWeight: 600, textDecoration: 'none',
                padding: '12px', borderRadius: 12,
                background: plan.destacado ? GOLD : 'transparent',
                color: plan.destacado ? INK : INK,
                border: plan.destacado ? 'none' : '1.5px solid rgba(200,169,110,0.35)',
              }}>
                Empezar
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ: las objeciones de siempre, respondidas ── */}
      <section style={{ background: '#fff', borderTop: '1px solid rgba(200,169,110,0.18)' }}>
        <div style={{ ...sectionPad, padding: '64px 24px', maxWidth: 760 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>
              Preguntas frecuentes
            </p>
            <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontWeight: 400, fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', letterSpacing: '-0.02em', margin: 0 }}>
              Lo que toda agencia nos pregunta
            </h2>
          </div>
          {[
            {
              q: '¿Necesito saber de tecnología?',
              a: 'No. Te registras, copias tu enlace de formulario y lo pones en tu web (o conectas tu correo). No hay nada que instalar ni configurar.',
            },
            {
              q: '¿Funciona con mi web actual?',
              a: 'Sí. El formulario funciona como un enlace: sirve para cualquier web, para tu bio de Instagram o para enviarlo por WhatsApp. Y si no tienes web, con conectar tu correo basta.',
            },
            {
              q: '¿Puedo revisar lo que envía la IA antes de que salga?',
              a: 'Sí. Puedes activar el modo revisión: cada respuesta queda como borrador y no se envía hasta que tú la apruebes (o la edites). También puedes definir el tono de tu agencia y la IA lo respeta.',
            },
            {
              q: '¿Qué pasa con los datos de mis clientes?',
              a: 'Los leads son tuyos: puedes exportarlos a CSV o borrarlos cuando quieras, y el tratamiento cumple el RGPD. Nunca vendemos ni compartimos tus datos.',
            },
            {
              q: '¿Puedo cancelar cuando quiera?',
              a: 'Sí, desde tu panel y sin permanencia. Mantienes el acceso hasta el final del período ya pagado y tus leads no se borran.',
            },
          ].map(item => (
            <details key={item.q} style={{
              borderBottom: '1px solid rgba(200,169,110,0.2)', padding: '18px 4px',
            }}>
              <summary style={{ fontSize: 15.5, fontWeight: 600, cursor: 'pointer', listStyle: 'none' }}>
                {item.q}
              </summary>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: '#5a544c', marginTop: 10 }}>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ ...sectionPad, padding: '0 24px 80px' }}>
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 24, padding: '56px 32px', textAlign: 'center',
          background: 'linear-gradient(150deg, #1c1813 0%, #14110d 60%, #0f0d0a 100%)', color: CREAM,
        }}>
          <div className="animate-aurora" style={{
            position: 'absolute', bottom: -120, left: -80, width: 360, height: 360, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(200,169,110,0.3) 0%, transparent 70%)', pointerEvents: 'none',
          }} />
          <h2 style={{ position: 'relative', fontFamily: "'DM Serif Display', Georgia, serif", fontWeight: 400, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', letterSpacing: '-0.02em', marginBottom: 14 }}>
            El primero en responder se lleva la visita
          </h2>
          <p style={{ position: 'relative', fontSize: 16, color: 'rgba(245,240,232,0.65)', maxWidth: 520, margin: '0 auto 28px' }}>
            Configúralo en cinco minutos y deja que Inmonia conteste por ti desde hoy.
            Gratis hasta 10 leads al mes.
          </p>
          <Link href="/sign-up" style={{
            position: 'relative', display: 'inline-block', fontSize: 15, fontWeight: 600, color: INK, textDecoration: 'none',
            padding: '14px 30px', borderRadius: 13, background: GOLD, boxShadow: '0 4px 22px rgba(200,169,110,0.5)',
          }}>
            Empieza gratis hoy
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(200,169,110,0.18)' }}>
        <div style={{ ...sectionPad, padding: '28px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size={28} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Inmonia</span>
            <span style={{ fontSize: 13, color: '#8a8278' }}>· IA inmobiliaria</span>
          </div>
          <div style={{ display: 'flex', gap: 18, fontSize: 13 }}>
            <Link href="/terminos" style={{ color: '#5a544c', textDecoration: 'none' }}>Términos</Link>
            <Link href="/privacidad" style={{ color: '#5a544c', textDecoration: 'none' }}>Privacidad</Link>
            <a href="mailto:contacto@inmonia.es" style={{ color: '#5a544c', textDecoration: 'none' }}>Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
