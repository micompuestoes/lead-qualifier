// Panel de administración — solo accesible para el owner del SaaS.
// Server Component: la ADMIN_SECRET_KEY nunca llega al navegador.

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import AdminDashboard from './AdminDashboard';

async function fetchTenants() {
  const apiUrl   = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
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
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Error de red', tenants: [] };
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
        <p style={{ color: '#7a7468' }}>No tienes acceso a esta página.</p>
      </div>
    );
  }

  const { error, tenants = [] } = await fetchTenants();

  return <AdminDashboard tenants={tenants} error={error} />;
}
