// Imagen Open Graph generada en el edge — es lo que se ve al compartir el
// enlace por WhatsApp, LinkedIn o X. Misma paleta que la landing.
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Inmuebia — Deja de perder clientes por responder tarde';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const GOLD = '#c8a96e';
const CREAM = '#f5f0e8';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 90px',
          background: 'linear-gradient(150deg, #1c1813 0%, #14110d 60%, #0f0d0a 100%)',
          color: CREAM,
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 44 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #d4b87a 0%, #c8a96e 45%, #a8895a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
              color: '#1a1814',
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1a1814"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11.25L12 3.75l9 7.5" />
              <path d="M5.25 9.75v9.75c0 .414.336.75.75.75h12c.414 0 .75-.336.75-.75V9.75" />
              <path d="M12 10.5l.95 2.05 2.05.95-2.05.95-.95 2.05-.95-2.05-2.05-.95 2.05-.95z" fill="#1a1814" stroke="none" />
            </svg>
          </div>
          <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, letterSpacing: '-0.01em' }}>
            <span>Inmueb</span>
            <span style={{ color: GOLD }}>ia</span>
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 68, lineHeight: 1.12, letterSpacing: '-0.02em', maxWidth: 900 }}>
          Deja de perder clientes por responder tarde
        </div>
        <div style={{ display: 'flex', marginTop: 34, fontSize: 28, color: GOLD }}>
          IA que cualifica tus leads inmobiliarios y responde en menos de un minuto
        </div>
      </div>
    ),
    size,
  );
}
