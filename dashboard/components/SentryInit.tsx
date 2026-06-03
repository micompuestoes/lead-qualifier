'use client';

// Inicializa Sentry en el cliente. No-op si NEXT_PUBLIC_SENTRY_DSN no está definida.
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function SentryInit() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    // Evita doble inicialización
    if (Sentry.getClient?.()) return;
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENV || 'production',
      tracesSampleRate: 0.1,
      replaysOnErrorSampleRate: 0,
      replaysSessionSampleRate: 0,
    });
  }, []);

  return null;
}
