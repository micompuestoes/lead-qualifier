'use client';

// Pantalla de error global — captura fallos de render y los reporta a Sentry.
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f5f0e8' }}>
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', marginBottom: 20,
            background: 'rgba(200,169,110,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c8a96e"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, color: '#1a1814', margin: '0 0 8px' }}>Algo ha salido mal</h1>
          <p style={{ fontSize: 14, color: '#7a7468', margin: '0 0 24px', maxWidth: 360, lineHeight: 1.6 }}>
            Hemos registrado el problema y lo revisaremos. Puedes intentarlo de nuevo.
          </p>
          <button onClick={() => reset()}
            style={{
              padding: '11px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600,
              background: '#c8a96e', color: '#1a1814', border: 'none', cursor: 'pointer',
            }}>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
