'use client';

import { SignIn, SignUp } from '@clerk/nextjs';
import { useTheme } from './ThemeProvider';

// ── Marca ──────────────────────────────────────────────────────────────────────

function Logo({ size = 40 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
      background: 'linear-gradient(135deg, #d4b87a 0%, #c8a96e 45%, #a8895a 100%)',
      boxShadow: '0 6px 20px rgba(200,169,110,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 24 24" fill="none"
        strokeWidth={2.2} stroke="#1a1814" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    </div>
  );
}

const VENTAJAS = [
  {
    titulo: 'Cualificación con IA en segundos',
    desc:   'Cada consulta se analiza y puntúa al instante: sabes a quién llamar primero.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
  {
    titulo: 'Prioriza quien va a cerrar',
    desc:   'Caliente, tibio o frío. Detecta presupuesto, financiación y urgencia automáticamente.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/>
      </svg>
    ),
  },
  {
    titulo: 'Respuestas que enamoran',
    desc:   'Emails personalizados, listos para enviar, firmados con el nombre de tu agencia.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
];

// ── Panel de marca (izquierda) ───────────────────────────────────────────────

function BrandPanel({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '48px 56px',
      background: 'linear-gradient(150deg, #1c1813 0%, #14110d 55%, #0f0d0a 100%)',
      color: '#f5f0e8',
    }}>
      {/* Auroras de luz dorada */}
      <div className="animate-aurora" style={{
        position: 'absolute', top: '-20%', right: '-10%', width: 420, height: 420,
        borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(200,169,110,0.32) 0%, transparent 70%)',
        filter: 'blur(8px)',
      }} />
      <div className="animate-aurora" style={{
        position: 'absolute', bottom: '-15%', left: '-8%', width: 360, height: 360,
        borderRadius: '50%', pointerEvents: 'none', animationDelay: '-7s',
        background: 'radial-gradient(circle, rgba(200,169,110,0.18) 0%, transparent 70%)',
        filter: 'blur(8px)',
      }} />
      {/* Rejilla sutil */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.4,
        backgroundImage:
          'linear-gradient(rgba(200,169,110,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(200,169,110,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
        maskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
      }} />

      {/* Top: logo */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Logo size={42} />
        <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Inmobia
        </span>
      </div>

      {/* Centro: titular + ventajas */}
      <div style={{ position: 'relative', maxWidth: 440 }}>
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: '#c8a96e', marginBottom: 18,
        }}>
          {mode === 'sign-in' ? 'Tu panel inmobiliario' : 'Empieza hoy'}
        </p>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '2.4rem', lineHeight: 1.12, letterSpacing: '-0.02em',
          color: '#f5f0e8', margin: 0, marginBottom: 16,
        }}>
          Convierte cada consulta<br/>en una oportunidad real.
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'rgba(245,240,232,0.6)', marginBottom: 36 }}>
          La IA cualifica tus leads inmobiliarios, prioriza los que van a cerrar
          y redacta la respuesta perfecta. Tú solo cierras operaciones.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {VENTAJAS.map(v => (
            <div key={v.titulo} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: 'rgba(200,169,110,0.13)',
                border: '1px solid rgba(200,169,110,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#d4b87a',
              }}>
                {v.icon}
              </div>
              <div style={{ paddingTop: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#f5f0e8', marginBottom: 2 }}>
                  {v.titulo}
                </p>
                <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'rgba(245,240,232,0.52)' }}>
                  {v.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pie: prueba social */}
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 14,
        paddingTop: 28, borderTop: '1px solid rgba(200,169,110,0.14)',
      }}>
        <div style={{ display: 'flex' }}>
          {['#c8a96e', '#b08d52', '#d4b87a'].map((bg, i) => (
            <div key={i} style={{
              width: 30, height: 30, borderRadius: '50%',
              background: `linear-gradient(135deg, ${bg}, rgba(26,24,20,0.4))`,
              border: '2px solid #14110d',
              marginLeft: i === 0 ? 0 : -10,
            }} />
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: 'rgba(245,240,232,0.6)', lineHeight: 1.4 }}>
          Agencias de toda España ya cualifican<br/>sus leads automáticamente.
        </p>
      </div>
    </div>
  );
}

// ── Shell de autenticación ──────────────────────────────────────────────────

export default function AuthShell({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { c } = useTheme();

  const clerkAppearance = {
    variables: {
      colorPrimary:         '#c8a96e',
      colorText:            c.text1,
      colorTextSecondary:   c.text2,
      colorBackground:      c.card,
      colorInputBackground: c.input,
      colorInputText:       c.text1,
      colorDanger:          '#b45309',
      borderRadius:         '11px',
      fontFamily:           "'DM Sans', system-ui, sans-serif",
    },
    elements: {
      rootBox:           'w-full',
      cardBox:           'w-full shadow-none border-none',
      card:              'shadow-none border-none bg-transparent p-0 gap-5 w-full',
      // Ocultamos el encabezado interno de Clerk: usamos el nuestro (evita el
      // título duplicado y el "para continuar en …").
      header:            'hidden',
      headerTitle:       'hidden',
      headerSubtitle:    'hidden',
      socialButtonsBlockButton:
        'border rounded-xl transition-all hover:opacity-90',
      formButtonPrimary:
        'bg-[#c8a96e] hover:bg-[#bd9c5d] text-[#1a1814] font-semibold text-sm normal-case rounded-xl shadow-[0_2px_14px_rgba(200,169,110,0.4)] transition-all',
      formFieldInput:    'rounded-xl',
      footerActionLink:  'text-[#9a7a3a] hover:text-[#c8a96e] font-semibold',
      footer:            'mt-2',
      dividerLine:       'bg-[rgba(200,169,110,0.2)]',
      identityPreviewEditButton: 'text-[#9a7a3a]',
    },
  };

  return (
    <div style={{
      minHeight: '100vh', width: '100%', display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
      background: c.bg,
    }} className="auth-grid">

      {/* Panel de marca — oculto en móvil vía CSS */}
      <div className="auth-brand">
        <BrandPanel mode={mode} />
      </div>

      {/* Panel del formulario */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', position: 'relative',
        background: c.bgGradient,
      }}>
        <div className="animate-fade-up" style={{ width: '100%', maxWidth: 380 }}>

          {/* Marca compacta (visible cuando se oculta el panel) */}
          <div className="auth-brand-compact" style={{
            display: 'none', alignItems: 'center', gap: 10, marginBottom: 28, justifyContent: 'center',
          }}>
            <Logo size={36} />
            <span style={{ fontSize: 16, fontWeight: 600, color: c.text1 }}>Inmobia</span>
          </div>

          {/* Encabezado propio */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: '1.7rem', lineHeight: 1.2, letterSpacing: '-0.02em',
              color: c.text1, margin: 0, marginBottom: 6,
            }}>
              {mode === 'sign-in' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
            </h2>
            <p style={{ fontSize: 13.5, color: c.text2, lineHeight: 1.5 }}>
              {mode === 'sign-in'
                ? 'Accede a tu panel de cualificación de leads.'
                : 'Empieza a cualificar leads con IA en menos de un minuto.'}
            </p>
          </div>

          {mode === 'sign-in' ? (
            <SignIn
              fallbackRedirectUrl="/leads"
              signUpUrl="/sign-up"
              appearance={clerkAppearance}
            />
          ) : (
            <SignUp
              fallbackRedirectUrl="/leads"
              signInUrl="/sign-in"
              appearance={clerkAppearance}
            />
          )}
        </div>

        <div style={{
          position: 'absolute', bottom: 20, left: 0, right: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <p style={{ fontSize: 11, color: c.text3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Protegido con cifrado de extremo a extremo
          </p>
          <div style={{ display: 'flex', gap: 16 }}>
            <a href="/terminos" style={{ fontSize: 11, color: c.text3, textDecoration: 'none' }}>Términos</a>
            <a href="/privacidad" style={{ fontSize: 11, color: c.text3, textDecoration: 'none' }}>Privacidad</a>
          </div>
        </div>
      </div>

      {/* Responsive: ocultar panel de marca en pantallas estrechas */}
      <style>{`
        @media (max-width: 900px) {
          .auth-grid { grid-template-columns: 1fr !important; }
          .auth-brand { display: none !important; }
          .auth-brand-compact { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
