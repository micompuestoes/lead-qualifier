'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const PLANES = [
  {
    id: 'free',
    nombre: 'Free',
    precio: 0,
    descripcion: 'Para probar la plataforma',
    features: [
      '10 leads / mes',
      'Cualificación con IA',
      'Formulario público',
      'Dashboard básico',
    ],
    limitacion: 'Límite de 10 leads al mes',
  },
  {
    id: 'pro',
    nombre: 'Pro',
    precio: 49,
    descripcion: 'Para agencias activas',
    destacado: true,
    features: [
      'Leads ilimitados',
      'Cualificación con IA',
      'Formulario público',
      'Notificaciones por email',
      'Dashboard completo',
      'Soporte por email',
    ],
  },
  {
    id: 'agencia',
    nombre: 'Agencia',
    precio: 99,
    descripcion: 'Para agencias que quieren más',
    features: [
      'Todo lo de Pro',
      'Generador de anuncios IA',
      'Múltiples usuarios',
      'Estadísticas avanzadas',
      'Soporte prioritario',
    ],
  },
];

export default function PricingPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [cargando, setCargando] = useState<string | null>(null);

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
    <div className="p-8 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-3xl" style={{ color: '#1a1814' }}>
          Planes y precios
        </h1>
        <p className="mt-2 text-sm" style={{ color: '#7a7468' }}>
          Sin permanencia. Cancela cuando quieras.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANES.map((plan) => (
          <div
            key={plan.id}
            className="relative rounded-2xl p-6 flex flex-col"
            style={{
              background: plan.destacado ? '#fff' : '#fff',
              border: plan.destacado
                ? '2px solid #c8a96e'
                : '1.5px solid rgba(200,169,110,0.2)',
              boxShadow: plan.destacado
                ? '0 4px 24px rgba(200,169,110,0.15)'
                : '0 1px 6px rgba(26,24,20,0.04)',
            }}
          >
            {plan.destacado && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: '#c8a96e', color: '#1a1814' }}>
                  Más popular
                </span>
              </div>
            )}

            {/* Cabecera */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold" style={{ color: '#1a1814' }}>
                {plan.nombre}
              </h2>
              <p className="text-sm mt-0.5" style={{ color: '#7a7468' }}>
                {plan.descripcion}
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold" style={{ color: '#1a1814' }}>
                  {plan.precio === 0 ? 'Gratis' : `${plan.precio}€`}
                </span>
                {plan.precio > 0 && (
                  <span className="text-sm" style={{ color: '#7a7468' }}>/mes</span>
                )}
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-2.5 flex-1 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm"
                  style={{ color: '#1a1814' }}>
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none"
                    viewBox="0 0 24 24" strokeWidth={2.5} stroke="#c8a96e">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {f}
                </li>
              ))}
              {'limitacion' in plan && plan.limitacion && (
                <li className="flex items-start gap-2.5 text-sm" style={{ color: '#b45309' }}>
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none"
                    viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {plan.limitacion}
                </li>
              )}
            </ul>

            {/* CTA */}
            {plan.proximamente ? (
              <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center cursor-not-allowed"
                style={{ background: 'rgba(200,169,110,0.08)', color: '#7a7468' }}>
                Próximamente
              </div>
            ) : plan.id === 'free' ? (
              <button
                onClick={() => router.push('/leads')}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  border: '1.5px solid rgba(200,169,110,0.3)',
                  color: '#7a7468',
                  background: 'transparent',
                }}
              >
                Ir al dashboard
              </button>
            ) : (
              <button
                onClick={() => contratar(plan.id)}
                disabled={!!cargando}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: plan.destacado ? '#c8a96e' : '#1a1814',
                  color: plan.destacado ? '#1a1814' : '#f5f0e8',
                }}
              >
                {cargando === plan.id ? 'Redirigiendo…' : `Empezar con ${plan.nombre}`}
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-xs mt-8" style={{ color: '#7a7468' }}>
        Pagos procesados de forma segura por Stripe. IVA no incluido.
      </p>
    </div>
  );
}
