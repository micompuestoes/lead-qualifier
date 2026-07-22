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
  // trim(): un espacio o salto de línea colado al pegar la variable no debe
  // dejar fuera al admin legítimo.
  const superAdminId = process.env.SUPER_ADMIN_USER_ID?.trim();
  if (superAdminId && userId !== superAdminId) {
    // Se muestra el ID del propio visitante para poder configurar el acceso
    // sin adivinar: es SU id (dato no sensible para él mismo) y es el valor
    // exacto que debe ir en SUPER_ADMIN_USER_ID (ojo: las instancias Dev y
    // Prod de Clerk asignan IDs distintos a la misma persona).
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div style={{ textAlign: 'center', color: '#7a7468' }}>
          <p style={{ marginBottom: 10 }}>No tienes acceso a esta página.</p>
          <p style={{ fontSize: 13 }}>
            Tu ID de usuario es{' '}
            <code style={{ fontFamily: 'monospace', background: 'rgba(122,116,104,0.1)', padding: '2px 6px', borderRadius: 6 }}>
              {userId}
            </code>
            <br />
            Si eres el administrador, pon exactamente ese valor en{' '}
            <code style={{ fontFamily: 'monospace' }}>SUPER_ADMIN_USER_ID</code> (Vercel y Render) y redespliega.
          </p>
        </div>
      </div>
    );
  }

  const { error, tenants = [] } = await fetchTenants();

  return <AdminDashboard tenants={tenants} error={error} />;
}
