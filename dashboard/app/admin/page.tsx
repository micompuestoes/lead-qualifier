// Panel de administración — solo accesible para el owner del SaaS.
// Server Component: la ADMIN_SECRET_KEY nunca llega al navegador.

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import TenantTable from './TenantTable';

async function fetchTenants() {
  const apiUrl  = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
  const adminKey = process.env.ADMIN_SECRET_KEY ?? '';

  if (!adminKey) {
    return { error: 'ADMIN_SECRET_KEY no configurada en Vercel', tenants: [] };
  }

  try {
    const res = await fetch(`${apiUrl}/admin/tenants`, {
      headers: { 'X-Admin-Key': adminKey },
      cache: 'no-store',
    });
    if (!res.ok) return { error: `Error ${res.status} de la API`, tenants: [] };
    return { error: null, ...(await res.json()) };
  } catch (e: any) {
    return { error: e.message, tenants: [] };
  }
}

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Solo el owner puede acceder. Configura SUPER_ADMIN_USER_ID en Vercel.
  const superAdminId = process.env.SUPER_ADMIN_USER_ID;
  if (superAdminId && userId !== superAdminId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">No tienes acceso a esta página.</p>
      </div>
    );
  }

  const { error, tenants = [], total = 0, activos = 0, cancelados = 0 } = await fetchTenants();

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Cabecera */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Panel de administración</h1>
        <p className="text-gray-500 text-sm mt-1">Gestión de empresas registradas en el SaaS</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total empresas</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{total}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Activas</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{activos}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Canceladas</p>
          <p className="text-3xl font-bold text-red-500 mt-1">{cancelados}</p>
        </div>
      </div>

      {/* Error de configuración */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
          <strong>Error:</strong> {error}
          {error.includes('ADMIN_SECRET_KEY') && (
            <p className="mt-1 text-red-600">
              Añade <code className="bg-red-100 px-1 rounded">ADMIN_SECRET_KEY</code> en Vercel → Settings → Environment Variables.
            </p>
          )}
        </div>
      )}

      {/* Tabla de tenants */}
      {tenants.length > 0 && <TenantTable tenants={tenants} />}

      {!error && tenants.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">Aún no hay empresas registradas</p>
          <p className="text-sm mt-1">Cuando alguien se registre aparecerá aquí</p>
        </div>
      )}
    </div>
  );
}
