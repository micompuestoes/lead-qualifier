'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useToast } from '@/components/Toast';

interface Perfil {
  name: string;
  email: string;
  notify_email: string;
  api_key: string;
  plan: string;
  created_at: string;
}

interface ImapStatus {
  configured: boolean;
  host?: string;
  user?: string;
  last_sync?: string;
}

export default function PerfilPage() {
  const { addToast } = useToast();
  const { getToken } = useAuth();
  const [perfil, setPerfil]       = useState<Perfil | null>(null);
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado]     = useState(false);
  const [form, setForm]           = useState({ name: '', notify_email: '' });

  // IMAP
  const [imap, setImap]               = useState<ImapStatus>({ configured: false });
  const [imapForm, setImapForm]       = useState({ email: '', password: '', host: '' });
  const [imapGuardando, setImapGuardando] = useState(false);
  const [imapDesconectando, setImapDesconectando] = useState(false);
  const [mostrarFormImap, setMostrarFormImap] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  useEffect(() => {
    async function cargar() {
      try {
        const token = await getToken();
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const [resPerfil, resImap] = await Promise.all([
          fetch(`${apiBase}/me`,      { headers }),
          fetch(`${apiBase}/me/imap`, { headers }),
        ]);
        if (!resPerfil.ok) throw new Error('Error al cargar perfil');
        const data = await resPerfil.json();
        setPerfil(data);
        setForm({ name: data.name ?? '', notify_email: data.notify_email ?? '' });
        if (resImap.ok) setImap(await resImap.json());
      } catch {
        addToast('No se pudo cargar el perfil', 'error');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [getToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const token = await getToken();
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

  async function conectarImap(e: React.FormEvent) {
    e.preventDefault();
    setImapGuardando(true);
    try {
      const token = await getToken();
      const body: Record<string, string | number> = {
        email:    imapForm.email,
        password: imapForm.password,
      };
      if (imapForm.host.trim()) body.host = imapForm.host.trim();

      const res = await fetch(`${apiBase}/me/imap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? 'Error al conectar');
      }
      const data = await res.json();
      setImap({ configured: true, host: data.host, user: data.user });
      setMostrarFormImap(false);
      setImapForm({ email: '', password: '', host: '' });
      addToast('Bandeja conectada correctamente', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al conectar', 'error');
    } finally {
      setImapGuardando(false);
    }
  }

  async function desconectarImap() {
    setImapDesconectando(true);
    try {
      const token = await getToken();
      await fetch(`${apiBase}/me/imap`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setImap({ configured: false });
      addToast('Bandeja desconectada', 'success');
    } catch {
      addToast('Error al desconectar', 'error');
    } finally {
      setImapDesconectando(false);
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

      {/* Bandeja de entrada (IMAP) */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-800">Bandeja de entrada</h2>
          <p className="text-sm text-gray-500 mt-1">
            Conecta tu email actual y los mensajes de potenciales clientes se convertirán
            automáticamente en leads en el dashboard.
          </p>
        </div>

        {imap.configured ? (
          <div className="space-y-3">
            {/* Estado conectado */}
            <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">{imap.user}</p>
                  <p className="text-xs text-green-600">{imap.host}</p>
                </div>
              </div>
              <button
                onClick={desconectarImap}
                disabled={imapDesconectando}
                className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
              >
                {imapDesconectando ? 'Desconectando…' : 'Desconectar'}
              </button>
            </div>
            {imap.last_sync && (
              <p className="text-xs text-gray-400">
                Última sincronización:{' '}
                {new Date(imap.last_sync).toLocaleString('es-ES', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
            <p className="text-xs text-gray-400">
              El sistema revisa tu bandeja cada 10 minutos. Solo se procesan emails de personas
              reales — los automáticos y newsletters se ignoran.
            </p>
          </div>
        ) : mostrarFormImap ? (
          <form onSubmit={conectarImap} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Email de la bandeja
              </label>
              <input
                type="email"
                required
                value={imapForm.email}
                onChange={e => setImapForm(p => ({ ...p, email: e.target.value }))}
                placeholder="info@tuempresa.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Contraseña de aplicación
                <span className="text-gray-400 font-normal ml-1">
                  — no uses tu contraseña principal, genera una específica en tu proveedor
                </span>
              </label>
              <input
                type="password"
                required
                value={imapForm.password}
                onChange={e => setImapForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Servidor IMAP
                <span className="text-gray-400 font-normal ml-1">(déjalo vacío para autodetectar)</span>
              </label>
              <input
                type="text"
                value={imapForm.host}
                onChange={e => setImapForm(p => ({ ...p, host: e.target.value }))}
                placeholder="imap.tuempresa.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={imapGuardando}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {imapGuardando ? 'Verificando…' : 'Conectar bandeja'}
              </button>
              <button
                type="button"
                onClick={() => setMostrarFormImap(false)}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setMostrarFormImap(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Conectar mi bandeja de entrada
          </button>
        )}
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
