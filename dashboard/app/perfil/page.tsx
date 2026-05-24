'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';

interface Perfil {
  name: string;
  email: string;
  notify_email: string;
  api_key: string;
  plan: string;
  created_at: string;
}

export default function PerfilPage() {
  const { addToast } = useToast();
  const [perfil, setPerfil]     = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado]   = useState(false);
  const [form, setForm]         = useState({ name: '', notify_email: '' });

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  useEffect(() => {
    async function cargar() {
      try {
        const clerk = (window as any).Clerk;
        await clerk?.load?.();
        const token = await clerk?.session?.getToken();
        const res = await fetch(`${apiBase}/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Error al cargar perfil');
        const data = await res.json();
        setPerfil(data);
        setForm({ name: data.name ?? '', notify_email: data.notify_email ?? '' });
      } catch {
        addToast('No se pudo cargar el perfil', 'error');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const clerk = (window as any).Clerk;
      const token = await clerk?.session?.getToken();
      const res = await fetch(`${apiBase}/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPerfil(data);
      addToast('Perfil actualizado', 'success');
    } catch {
      addToast('Error al guardar', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function copiarApiKey() {
    if (!perfil?.api_key) return;
    await navigator.clipboard.writeText(perfil.api_key);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const formUrl = perfil?.api_key
    ? `${window?.location?.origin}/form/${perfil.api_key}`
    : '';

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        <p className="text-gray-500 text-sm mt-1">Configura tu empresa y las notificaciones</p>
      </div>

      {/* Datos de la empresa */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Datos de la empresa</h2>
        <form onSubmit={guardar} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la empresa
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Casas García Inmobiliaria"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email de notificaciones
              <span className="text-gray-400 font-normal ml-1">(aquí llegan los avisos de nuevos leads)</span>
            </label>
            <input
              type="email"
              value={form.notify_email}
              onChange={e => setForm(p => ({ ...p, notify_email: e.target.value }))}
              placeholder="hola@tuempresa.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </div>

      {/* API Key / Formulario público */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-800">Formulario público de captación</h2>
          <p className="text-sm text-gray-500 mt-1">
            Comparte este enlace en tu web para recibir leads directamente en tu dashboard.
          </p>
        </div>

        {perfil?.api_key ? (
          <>
            {/* URL del formulario */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Enlace del formulario
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={formUrl}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono"
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(formUrl); addToast('Enlace copiado', 'success'); }}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Copiar
                </button>
                <a
                  href={formUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Ver
                </a>
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                API Key <span className="text-gray-400 font-normal normal-case">(para integraciones propias)</span>
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={perfil.api_key}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono"
                />
                <button
                  onClick={copiarApiKey}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors min-w-[70px]"
                >
                  {copiado ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400">
            El formulario se activa tras la primera conexión con el servidor.
          </p>
        )}
      </div>

      {/* Info cuenta */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="font-semibold text-gray-800 mb-3">Cuenta</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Email de acceso</span>
            <span className="text-gray-800">{perfil?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Plan</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {perfil?.plan ?? 'free'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Miembro desde</span>
            <span className="text-gray-800">
              {perfil?.created_at
                ? new Date(perfil.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
                : '—'}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
