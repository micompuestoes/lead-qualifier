'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { PLANS } from '@/lib/plans';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// Fuente única de planes (compartida con la landing) — ver lib/plans.ts
const PLANES = PLANS;

const ORDEN_PLAN: Record<string, number> = { free: 0, pro: 1, agencia: 2 };

export default function PricingPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { c, isDark } = useTheme();
  const [cargando, setCargando] = useState<string | null>(null);
  const [planActual, setPlanActual] = useState<string>('free');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('inmobia-perfil');
      if (raw) setPlanActual(JSON.parse(raw).plan ?? 'free');
    } catch {}
  }, []);

  async function contratar(planId: string) {
    if (planId === 'free') return;
    setCargando(planId);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan: planId }),
      });
      if (!res.ok) throw new Error('Error al crear sesión de pago');
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      alert('No se pudo iniciar el pago. Inténtalo de nuevo.');
    } finally {
      setCargando(null);
    }
  }

  return (
    <div style={{ padding: '48px 32px 64px', maxWidth: 1080, margin: '0 auto' }}>

      {/* ── Hero ── */}
      <div style={{ textAlign: 'center', marginBottom: 48 }} className="animate-fade-up">
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: '#c8a96e', marginBottom: 14,
        }}>
          Planes y precios
        </p>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '2.6rem', lineHeight: 1.12, letterSpacing: '-0.025em',
          color: c.text1, margin: 0, marginBottom: 14,
        }}>
          El plan perfecto para tu agencia
        </h1>
        <p style={{ fontSize: 15, color: c.text2, maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
          Cualifica más leads, cierra más operaciones. Sin permanencia, cancela cuando quieras.
        </p>
      </div>

      {/* ── Tarjetas ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20,
        alignItems: 'start',
      }} className="pricing-grid">
        {PLANES.map((plan, i) => {
          const esActual    = plan.id === planActual;
          const destacado   = !!plan.destacado;
          const esDowngrade = ORDEN_PLAN[plan.id] < ORDEN_PLAN[planActual];

          return (
            <div
              key={plan.id}
              className="animate-fade-up"
              style={{
                position: 'relative',
                borderRadius: 20,
                padding: destacado ? 2 : 0,                 // espacio para el borde-gradiente
                background: destacado
                  ? 'linear-gradient(150deg, #d4b87a, #c8a96e 40%, rgba(200,169,110,0.25))'
                  : 'transparent',
                boxShadow: destacado
                  ? (isDark ? '0 16px 50px rgba(200,169,110,0.22)' : '0 16px 50px rgba(200,169,110,0.28)')
                  : 'none',
                transform: destacado ? 'translateY(-8px)' : 'none',
                animationDelay: `${i * 80}ms`,
              }}
            >
              {/* Badge destacado */}
              {destacado && (
                <div style={{
                  position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 2,
                }}>
                  <span
                    className="shimmer-badge"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                      padding: '6px 14px', borderRadius: 99,
                      color: '#1a1814',
                      background: 'linear-gradient(90deg, #e6cd97, #c8a96e, #e6cd97)',
                      backgroundSize: '200% 100%',
                      boxShadow: '0 4px 14px rgba(200,169,110,0.5)',
                    }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#1a1814">
                      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21l1.18-6.88-5-4.87 7.1-1.01L12 2z"/>
                    </svg>
                    Más popular
                  </span>
                </div>
              )}

              {/* Interior de la tarjeta */}
              <div style={{
                borderRadius: destacado ? 18 : 20,
                padding: '28px 26px',
                height: '100%',
                background: c.card,
                border: destacado ? 'none' : c.cardBorder,
                display: 'flex', flexDirection: 'column',
              }}>
                {/* Cabecera */}
                <div style={{ marginBottom: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h2 style={{ fontSize: 19, fontWeight: 600, color: c.text1 }}>{plan.nombre}</h2>
                    {esActual && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                        padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase',
                        background: 'rgba(110,200,122,0.14)', color: '#3a8a4a',
                      }}>
                        Tu plan
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: c.text2 }}>{plan.descripcion}</p>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 18 }}>
                    <span style={{
                      fontSize: 44, fontWeight: 700, lineHeight: 1,
                      color: c.text1, letterSpacing: '-0.02em',
                    }}>
                      {plan.precio === 0 ? 'Gratis' : `${plan.precio}€`}
                    </span>
                    {plan.precio > 0 && (
                      <span style={{ fontSize: 14, color: c.text2 }}>/mes</span>
                    )}
                  </div>
                </div>

                {/* Separador */}
                <div style={{
                  height: 1, marginBottom: 20,
                  background: destacado
                    ? 'linear-gradient(90deg, rgba(200,169,110,0.4), transparent)'
                    : c.divider,
                }} />

                {/* Features */}
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, marginBottom: 26 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: c.text1 }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                        background: 'rgba(200,169,110,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                          stroke="#c8a96e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </span>
                      {f}
                    </li>
                  ))}
                  {plan.limitacion && (
                    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: c.text2 }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                        background: 'rgba(122,116,104,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                          stroke={c.text2} strokeWidth="2.5" strokeLinecap="round">
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </span>
                      {plan.limitacion}
                    </li>
                  )}
                </ul>

                {/* CTA */}
                {esActual ? (
                  <button disabled style={{
                    width: '100%', padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                    background: c.muted, color: c.text2, border: `1.5px solid ${c.inputBorder}`,
                    cursor: 'default',
                  }}>
                    Plan actual
                  </button>
                ) : plan.id === 'free' ? (
                  <button
                    onClick={() => router.push('/leads')}
                    style={{
                      width: '100%', padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                      background: 'transparent', color: c.text2,
                      border: `1.5px solid ${c.inputBorder}`, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,169,110,0.5)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = c.inputBorder; }}
                  >
                    {esDowngrade ? 'Cambiar a Free' : 'Ir al dashboard'}
                  </button>
                ) : (
                  <button
                    onClick={() => contratar(plan.id)}
                    disabled={!!cargando}
                    style={{
                      width: '100%', padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                      cursor: cargando ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                      opacity: cargando ? 0.6 : 1,
                      border: 'none',
                      background: destacado ? '#c8a96e' : (isDark ? '#f0e8d8' : '#1a1814'),
                      color: destacado ? '#1a1814' : (isDark ? '#1a1814' : '#f5f0e8'),
                      boxShadow: destacado ? '0 4px 18px rgba(200,169,110,0.42)' : 'none',
                    }}
                    onMouseEnter={e => { if (!cargando) (e.currentTarget as HTMLElement).style.opacity = '0.92'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  >
                    {cargando === plan.id ? 'Redirigiendo…' : (esDowngrade ? `Cambiar a ${plan.nombre}` : `Empezar con ${plan.nombre}`)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Garantías / confianza ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28,
        flexWrap: 'wrap', marginTop: 44,
      }}>
        {[
          { icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', txt: 'Cancela cuando quieras' },
          { icon: 'M3 8.25V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18V8.25m-18 0V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v2.25m-18 0h18', txt: 'Pago seguro con Stripe' },
          { icon: 'M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z', txt: 'Soporte en español' },
        ].map(item => (
          <div key={item.txt} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a96e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            <span style={{ fontSize: 13, color: c.text2 }}>{item.txt}</span>
          </div>
        ))}
      </div>

      <p style={{ textAlign: 'center', fontSize: 12, color: c.text3, marginTop: 24 }}>
        Precios sin IVA. Facturación mensual. Procesado de forma segura por Stripe.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 14 }}>
        <a href="/terminos" style={{ fontSize: 12, color: c.text2, textDecoration: 'none' }}>Términos de servicio</a>
        <span style={{ color: c.divider }}>·</span>
        <a href="/privacidad" style={{ fontSize: 12, color: c.text2, textDecoration: 'none' }}>Política de privacidad</a>
      </div>

      <style>{`
        .shimmer-badge { animation: shimmer-sweep 3s linear infinite; }
        @media (max-width: 860px) {
          .pricing-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
