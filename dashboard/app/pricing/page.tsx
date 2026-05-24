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
    color: 'gray',
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
    color: 'blue',
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
    color: 'purple',
    features: [
      'Todo lo de Pro',
      'Generador de anuncios IA',
      'Múltiples usuarios',
      'Estadísticas avanzadas',
      'Soporte prioritario',
    ],
    proximamente: true,
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
        <h1 className="text-3xl font-bold text-gray-900">Planes y precios</h1>
        <p className="text-gray-500 mt-2">Sin permanencia. Cancela cuando quieras.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANES.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col ${
              plan.destacado
                ? 'border-blue-500 shadow-lg shadow-blue-100'
                : 'border-gray-100'
            }`}
          >
            {plan.destacado && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Más popular
                </span>
              </div>
            )}

            {/* Cabecera */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900">{plan.nombre}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{plan.descripcion}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-gray-900">
                  {plan.precio === 0 ? 'Gratis' : `${plan.precio}€`}
                </span>
                {plan.precio > 0 && (
                  <span className="text-gray-400 text-sm">/mes</span>
                )}
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-2.5 flex-1 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none"
                    viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {f}
                </li>
              ))}
              {plan.limitacion && (
                <li className="flex items-start gap-2.5 text-sm text-red-400">
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
              <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center
                bg-gray-100 text-gray-400 cursor-not-allowed">
                Próximamente
              </div>
            ) : plan.id === 'free' ? (
              <button
                onClick={() => router.push('/leads')}
                className="w-full py-2.5 rounded-xl text-sm font-semibold
                  border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Ir al dashboard
              </button>
            ) : (
              <button
                onClick={() => contratar(plan.id)}
                disabled={!!cargando}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors
                  disabled:opacity-60 disabled:cursor-not-allowed ${
                  plan.destacado
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-900 hover:bg-gray-700 text-white'
                }`}
              >
                {cargando === plan.id ? 'Redirigiendo…' : `Empezar con ${plan.nombre}`}
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-gray-400 mt-8">
        Pagos procesados de forma segura por Stripe. IVA no incluido.
      </p>
    </div>
  );
}
