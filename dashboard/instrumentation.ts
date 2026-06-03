// Monitorización de errores en el servidor (Sentry).
// Solo se activa si SENTRY_DSN está definida. Sin la variable, no hace nada.

import * as Sentry from '@sentry/nextjs';

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENV || 'production',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    });
  }
}

// Captura de errores de peticiones (Next 15+). Inocuo en versiones anteriores.
export const onRequestError = Sentry.captureRequestError;
