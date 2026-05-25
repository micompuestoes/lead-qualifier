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
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(200,169,110,0.15)' }}>
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24"
            strokeWidth={2.5} stroke="#c8a96e">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <h1 className="text-2xl mb-2" style={{ color: '#1a1814' }}>
          ¡Suscripción activada!
        </h1>
        <p className="mb-8 text-sm" style={{ color: '#7a7468' }}>
          Tu plan ya está activo. Ahora tienes acceso completo a todas las funcionalidades.
        </p>

        <Link
          href="/leads"
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl transition-all"
          style={{ background: '#c8a96e', color: '#1a1814' }}
        >
          Ir al dashboard
        </Link>

        <p className="text-xs mt-4" style={{ color: '#7a7468' }}>
          Redirigiendo automáticamente en 5 segundos…
        </p>
      </div>
    </div>
  );
}
