'use client';

import Link from 'next/link';
import { useTheme } from './ThemeProvider';

export interface OnbStep {
  label: string;
  desc:  string;
  done:  boolean;
  href:  string;
  cta:   string;
}

export default function OnboardingChecklist({ steps }: { steps: OnbStep[] }) {
  const { c } = useTheme();
  const hechos = steps.filter(s => s.done).length;
  const total  = steps.length;
  const pct    = total > 0 ? Math.round((hechos / total) * 100) : 0;

  // Primer paso pendiente (para resaltar la acción principal)
  const idxActivo = steps.findIndex(s => !s.done);

  return (
    <div
      className="animate-fade-up"
      data-tour="onboarding"
      style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(200,169,110,0.10) 0%, rgba(200,169,110,0.03) 100%)',
        border: '1.5px solid rgba(200,169,110,0.28)',
        borderRadius: 16, padding: 24, marginBottom: 32,
      }}
    >
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#c8a96e', marginBottom: 6 }}>
            Primeros pasos
          </p>
          <h2 style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: '1.35rem', color: c.text1, letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>
            Pon Inmuebia a funcionar
          </h2>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#9a7a3a', lineHeight: 1 }}>
            {hechos}<span style={{ fontSize: 14, color: c.text2 }}>/{total}</span>
          </p>
          <p style={{ fontSize: 11, color: c.text2, marginTop: 2 }}>completado</p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div style={{ height: 5, borderRadius: 3, overflow: 'hidden', background: 'rgba(200,169,110,0.15)', marginBottom: 20 }}>
        <div style={{
          height: '100%', borderRadius: 3, width: `${pct}%`,
          background: 'linear-gradient(90deg, #d4b87a, #c8a96e)',
          transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>

      {/* Pasos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {steps.map((s, i) => {
          const activo = i === idxActivo;
          return (
            <div key={s.label} style={{
              display: 'flex', alignItems: 'center', gap: 13,
              padding: '11px 12px', borderRadius: 11,
              background: activo ? c.card : 'transparent',
              border: activo ? `1px solid ${c.inputBorder}` : '1px solid transparent',
              transition: 'background 0.15s',
            }}>
              {/* Indicador */}
              <span style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: s.done ? '#c8a96e' : 'transparent',
                border: s.done ? 'none' : `2px solid ${activo ? '#c8a96e' : c.inputBorder}`,
              }}>
                {s.done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a1814" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color: activo ? '#9a7a3a' : c.text3 }}>{i + 1}</span>
                )}
              </span>

              {/* Texto */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 13.5, fontWeight: activo ? 600 : 500,
                  color: s.done ? c.text2 : c.text1,
                  textDecoration: s.done ? 'line-through' : 'none',
                }}>
                  {s.label}
                </p>
                {!s.done && (
                  <p style={{ fontSize: 12, color: c.text2, marginTop: 1 }}>{s.desc}</p>
                )}
              </div>

              {/* Acción */}
              {!s.done && (
                <Link href={s.href} style={{
                  flexShrink: 0, fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
                  padding: '7px 14px', borderRadius: 9,
                  background: activo ? '#c8a96e' : 'transparent',
                  color: activo ? '#1a1814' : '#9a7a3a',
                  border: activo ? 'none' : '1px solid rgba(200,169,110,0.3)',
                }}>
                  {s.cta}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Enlace a la guía */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${c.divider}` }}>
        <Link href="/ayuda" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12.5, fontWeight: 600, color: '#9a7a3a', textDecoration: 'none',
        }}>
          ¿Te pierdes? Consulta la guía
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
