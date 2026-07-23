'use client';

import Link from 'next/link';
import { useTheme } from './ThemeProvider';

export interface LegalSection {
  heading: string;
  body: (string | string[])[];   // párrafos (string) o listas (string[])
}

interface Props {
  title:       string;
  updated:     string;
  intro?:      string;
  sections:    LegalSection[];
}

function Logo() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
      background: 'linear-gradient(135deg, #d4b87a 0%, #c8a96e 45%, #a8895a 100%)',
      boxShadow: '0 4px 12px rgba(200,169,110,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth={2.2}
        stroke="#1a1814" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    </div>
  );
}

export default function LegalDoc({ title, updated, intro, sections }: Props) {
  const { c } = useTheme();

  return (
    <div style={{ minHeight: '100vh', background: c.bgGradient }}>

      {/* ── Barra superior ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px',
        background: c.sidebar,
        borderBottom: `1px solid ${c.divider}`,
      }}>
        <Link href="/leads" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
          <Logo />
          <span style={{ fontSize: 15, fontWeight: 600, color: c.text1 }}>Inmonia</span>
        </Link>
        <Link href="/leads" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: c.text2, textDecoration: 'none',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Volver al panel
        </Link>
      </header>

      {/* ── Documento ── */}
      <article style={{ maxWidth: 740, margin: '0 auto', padding: '56px 32px 80px' }}>

        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: '#c8a96e', marginBottom: 14,
        }}>
          Legal
        </p>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '2.3rem', lineHeight: 1.15, letterSpacing: '-0.025em',
          color: c.text1, margin: 0, marginBottom: 12,
        }}>
          {title}
        </h1>
        <p style={{ fontSize: 13, color: c.text3, marginBottom: intro ? 24 : 40 }}>
          Última actualización: {updated}
        </p>

        {intro && (
          <p style={{ fontSize: 15, lineHeight: 1.7, color: c.text2, marginBottom: 40 }}>
            {intro}
          </p>
        )}

        {sections.map((sec, i) => (
          <section key={i} style={{ marginBottom: 36 }}>
            <h2 style={{
              fontSize: 16, fontWeight: 700, color: c.text1, marginBottom: 14,
              display: 'flex', alignItems: 'baseline', gap: 10,
            }}>
              <span style={{ fontSize: 13, color: '#c8a96e', fontWeight: 700 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {sec.heading}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sec.body.map((part, j) =>
                Array.isArray(part) ? (
                  <ul key={j} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 2 }}>
                    {part.map((li, k) => (
                      <li key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: '50%', background: '#c8a96e',
                          flexShrink: 0, marginTop: 8,
                        }} />
                        <span style={{ fontSize: 14.5, lineHeight: 1.65, color: c.text2 }}>{li}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p key={j} style={{ fontSize: 14.5, lineHeight: 1.7, color: c.text2 }}>{part}</p>
                )
              )}
            </div>
          </section>
        ))}

        {/* Pie */}
        <div style={{ marginTop: 56, paddingTop: 24, borderTop: `1px solid ${c.divider}` }}>
          <p style={{ fontSize: 13, color: c.text3, marginBottom: 10 }}>
            ¿Dudas sobre este documento? Escríbenos a{' '}
            <a href="mailto:contacto@inmonia.es" style={{ color: '#9a7a3a', textDecoration: 'none' }}>
              contacto@inmonia.es
            </a>.
          </p>
          <div style={{ display: 'flex', gap: 18 }}>
            <Link href="/terminos" style={{ fontSize: 13, color: c.text2, textDecoration: 'none' }}>Términos</Link>
            <Link href="/privacidad" style={{ fontSize: 13, color: c.text2, textDecoration: 'none' }}>Privacidad</Link>
            <Link href="/pricing" style={{ fontSize: 13, color: c.text2, textDecoration: 'none' }}>Planes</Link>
          </div>
        </div>
      </article>
    </div>
  );
}
