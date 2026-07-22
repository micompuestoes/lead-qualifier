// API route de Next.js — actúa de proxy entre el frontend y el backend.
// La ADMIN_SECRET_KEY solo existe en el servidor, nunca llega al navegador.

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest) {
  // Solo usuarios autenticados
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Solo el super admin (si está configurado)
  const superAdminId = process.env.SUPER_ADMIN_USER_ID?.trim();
  if (superAdminId && userId !== superAdminId) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const adminKey = process.env.ADMIN_SECRET_KEY ?? '';
  if (!adminKey) {
    return NextResponse.json({ error: 'ADMIN_SECRET_KEY no configurada' }, { status: 503 });
  }

  const { tenantId, status } = await req.json();
  if (!tenantId || !['active', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  const res = await fetch(`${apiUrl}/admin/tenants/${tenantId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': adminKey,
    },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(err, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
