'use client';

import { useState } from 'react';

interface Tenant {
  id: string;
  email: string;
  name: string;
  plan: string;
  status: 'active' | 'cancelled';
  lead_count: number;
  created_at: string;
  cancelled_at?: string;
}

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function TenantTable({ tenants: inicial }: { tenants: Tenant[] }) {
  const [tenants, setTenants] = useState<Tenant[]>(inicial);
  const [loading, setLoading] = useState<string | null>(null);

  async function cambiarEstado(tenantId: string, nuevoEstado: 'active' | 'cancelled') {
    setLoading(tenantId);
    try {
      const res = await fetch(`/api/admin/tenant-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, status: nuevoEstado }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      setTenants(prev =>
        prev.map(t => t.id === tenantId ? { ...t, status: nuevoEstado } : t)
      );
    } catch (e) {
      alert('No se pudo cambiar el estado. Comprueba que ADMIN_SECRET_KEY está configurada.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empresa</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
            <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Leads</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Registro</th>
            <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
            <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {tenants.map(t => (
            <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">

              {/* Empresa */}
              <td className="px-5 py-4">
                <p className="font-medium text-gray-900">{t.name || '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.email}</p>
              </td>

              {/* Plan */}
              <td className="px-5 py-4">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  t.plan === 'pro'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {t.plan}
                </span>
              </td>

              {/* Leads */}
              <td className="px-5 py-4 text-center">
                <span className="font-semibold text-gray-900">{t.lead_count}</span>
              </td>

              {/* Fecha */}
              <td className="px-5 py-4 text-gray-500">
                {formatDate(t.created_at)}
              </td>

              {/* Estado */}
              <td className="px-5 py-4 text-center">
                {t.status === 'active' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Activa
                  </span>
                ) : (
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      Cancelada
                    </span>
                    {t.cancelled_at && (
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(t.cancelled_at)}</p>
                    )}
                  </div>
                )}
              </td>

              {/* Acción */}
              <td className="px-5 py-4 text-center">
                {loading === t.id ? (
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
                ) : t.status === 'active' ? (
                  <button
                    onClick={() => cambiarEstado(t.id, 'cancelled')}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline font-medium"
                  >
                    Cancelar
                  </button>
                ) : (
                  <button
                    onClick={() => cambiarEstado(t.id, 'active')}
                    className="text-xs text-green-600 hover:text-green-800 hover:underline font-medium"
                  >
                    Reactivar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
