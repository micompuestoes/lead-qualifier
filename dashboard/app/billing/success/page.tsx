'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BillingSuccessPage() {
  const router = useRouter();

  // Redirige automáticamente al dashboard tras 5 segundos
  useEffect(() => {
    const t = setTimeout(() => router.push('/leads'), 5000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center max-w-md px-6">
        {/* Check animado */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24"
            strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ¡Suscripción activada!
        </h1>
        <p className="text-gray-500 mb-8">
          Tu plan ya está activo. Ahora tienes acceso completo a todas las funcionalidades.
        </p>

        <Link
          href="/leads"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700
            text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Ir al dashboard
        </Link>

        <p className="text-xs text-gray-400 mt-4">
          Redirigiendo automáticamente en 5 segundos…
        </p>
      </div>
    </div>
  );
}
