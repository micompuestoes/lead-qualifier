'use client';

import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { useTheme } from '@/components/ThemeProvider';
import PageHeader from '@/components/PageHeader';

interface Perfil {
  name: string;
  email: string;
  notify_email: string;
  api_key: string;
  plan: string;
  created_at: string;
  whatsapp_number?: string;
  whatsapp_enabled?: boolean;
}

interface TeamMember {
  member_id: string;
  member_name?: string;
  added_at: string;
}

interface ImapStatus {
  configured: boolean;
  host?: string;
  user?: string;
  last_sync?: string;
}

const planConfig: Record<string, { label: string; bg: string; color: string }> = {
  free:    { label: 'Gratuito', bg: 'rgba(122,116,104,0.12)', color: '#9a9490' },
  pro:     { label: 'Pro',      bg: 'rgba(200,169,110,0.15)', color: '#9a7a3a' },
  agencia: { label: 'Agencia',  bg: 'rgba(200,169,110,0.22)', color: '#9a7a3a' },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PerfilPage() {
  const { addToast } = useToast();
  const { getToken } = useAuth();
  const { user } = useUser();
  const { c } = useTheme();
  const router = useRouter();

  const [perfil, setPerfil]       = useState<Perfil | null>(null);
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm]           = useState({ name: '', notify_email: '' });

  const [waForm, setWaForm]       = useState({ number: '', enabled: false });
  const [waGuardando, setWaGuardando] = useState(false);

  const [equipo, setEquipo]               = useState<TeamMember[]>([]);
  const [nuevoMiembro, setNuevoMiembro]   = useState('');
  const [nuevoNombre, setNuevoNombre]     = useState('');
  const [agregandoMiembro, setAgregandoMiembro] = useState(false);

  const [imap, setImap]                   = useState<ImapStatus>({ configured: false });
  const [imapForm, setImapForm]           = useState({ email: '', password: '', host: '' });
  const [imapGuardando, setImapGuardando] = useState(false);
  const [imapDesconectando, setImapDesconectando] = useState(false);
  const [mostrarFormImap, setMostrarFormImap]     = useState(false);

  const [copiadoApiKey, setCopiadoApiKey]   = useState(false);
  const [copiadoFormUrl, setCopiadoFormUrl] = useState(false);
  const [copiadoId, setCopiadoId]           = useState(false);

  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Subscription state
  const [abriendo, setAbriendo]             = useState(false);
  const [cancelando, setCancelando]         = useState(false);
  const [confirmCancel, setConfirmCancel]   = useState(false);
  const [cancelSuccess, setCancelSuccess]   = useState<number | null>(null); // Unix timestamp

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  // ── Derived styles (depend on theme) ──────────────────────────────────────

  const card: React.CSSProperties = {
    background:   c.card,
    border:       c.cardBorder,
    borderRadius: '16px',
    padding:      '24px',
  };

  const labelStyle: React.CSSProperties = {
    display:       'block',
    fontSize:      '12px',
    fontWeight:    600,
    color:         c.text2,
    marginBottom:  '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const btnPrimary: React.CSSProperties = {
    background:   '#c8a96e',
    color:        '#1a1814',
    border:       'none',
    borderRadius: '10px',
    padding:      '10px 20px',
    fontSize:     '14px',
    fontWeight:   600,
    cursor:       'pointer',
    transition:   'opacity 0.15s',
  };

  const btnSecondary: React.CSSProperties = {
    background:   'transparent',
    color:        c.text2,
    border:       `1.5px solid ${c.inputBorder}`,
    borderRadius: '10px',
    padding:      '10px 16px',
    fontSize:     '14px',
    fontWeight:   500,
    cursor:       'pointer',
    transition:   'background 0.15s, color 0.15s',
  };

  function inputStyleFor(name: string): React.CSSProperties {
    const focused = focusedInput === name;
    return {
      width:      '100%',
      padding:    '10px 14px',
      borderRadius: '10px',
      border:     focused ? '1.5px solid #c8a96e' : `1.5px solid ${c.inputBorder}`,
      background: c.input,
      color:      c.text1,
      fontSize:   '14px',
      outline:    'none',
      boxShadow:  focused ? '0 0 0 3px rgba(200,169,110,0.1)' : 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    };
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  useEffect(() => {
    async function cargar() {
      try {
        const token = await getToken();
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const [resPerfil, resImap, resTeam] = await Promise.all([
          fetch(`${apiBase}/me`,      { headers }),
          fetch(`${apiBase}/me/imap`, { headers }),
          fetch(`${apiBase}/me/team`, { headers }),
        ]);
        if (!resPerfil.ok) throw new Error('Error al cargar perfil');
        const data = await resPerfil.json();
        setPerfil(data);
        setForm({ name: data.name ?? '', notify_email: data.notify_email ?? '' });
        setWaForm({ number: data.whatsapp_number ?? '', enabled: !!data.whatsapp_enabled });
        if (resImap.ok) setImap(await resImap.json());
        if (resTeam.ok) { const t = await resTeam.json(); setEquipo(t.members ?? []); }
      } catch {
        addToast('No se pudo cargar el perfil', 'error');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [getToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/me`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body:    JSON.stringify(form),
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

  async function guardarWhatsapp(e: React.FormEvent) {
    e.preventDefault();
    setWaGuardando(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/me/whatsapp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body:    JSON.stringify(waForm),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail ?? 'Error al guardar'); }
      const data = await res.json();
      setWaForm({ number: data.whatsapp_number ?? '', enabled: !!data.whatsapp_enabled });
      addToast(data.whatsapp_enabled ? 'Avisos por WhatsApp activados' : 'Preferencias de WhatsApp guardadas', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al guardar', 'error');
    } finally {
      setWaGuardando(false);
    }
  }

  async function conectarImap(e: React.FormEvent) {
    e.preventDefault();
    setImapGuardando(true);
    try {
      const token = await getToken();
      const body: Record<string, string> = { email: imapForm.email, password: imapForm.password };
      if (imapForm.host.trim()) body.host = imapForm.host.trim();
      const res = await fetch(`${apiBase}/me/imap`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body:    JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail ?? 'Error al conectar'); }
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
        method:  'DELETE',
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

  async function agregarMiembro(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoMiembro.trim()) return;
    setAgregandoMiembro(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/me/team`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body:    JSON.stringify({ member_id: nuevoMiembro.trim(), member_name: nuevoNombre.trim() }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail ?? 'Error'); }
      setEquipo(prev => [...prev, { member_id: nuevoMiembro.trim(), member_name: nuevoNombre.trim(), added_at: new Date().toISOString() }]);
      setNuevoMiembro('');
      setNuevoNombre('');
      addToast('Miembro añadido correctamente', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al añadir miembro', 'error');
    } finally {
      setAgregandoMiembro(false);
    }
  }

  async function eliminarMiembro(memberId: string) {
    try {
      const token = await getToken();
      await fetch(`${apiBase}/me/team/${memberId}`, {
        method:  'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setEquipo(prev => prev.filter(m => m.member_id !== memberId));
      addToast('Miembro eliminado', 'success');
    } catch {
      addToast('Error al eliminar miembro', 'error');
    }
  }

  async function abrirPortal() {
    setAbriendo(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/billing/portal`, {
        method:  'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Error al abrir portal');
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      addToast('No se pudo abrir el portal de facturación', 'error');
      setAbriendo(false);
    }
  }

  async function cancelarSuscripcion() {
    setCancelando(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/me/subscription`, {
        method:  'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail ?? 'Error'); }
      const data = await res.json();
      setCancelSuccess(data.current_period_end ?? null);
      setConfirmCancel(false);
      addToast('Suscripción cancelada. Sigues con acceso hasta el fin del período.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al cancelar', 'error');
    } finally {
      setCancelando(false);
    }
  }

  const formUrl = (typeof window !== 'undefined' && perfil?.api_key)
    ? `${window.location.origin}/form/${perfil.api_key}` : '';

  // ── Loading ────────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(200,169,110,0.3)', borderTopColor: '#c8a96e' }} />
      </div>
    );
  }

  const planInfo = planConfig[perfil?.plan ?? 'free'] ?? planConfig.free;
  const isPaid   = perfil?.plan && perfil.plan !== 'free';
  const canImap  = perfil?.plan === 'pro' || perfil?.plan === 'agencia';
  const inicial  = (perfil?.name || perfil?.email || 'L').trim().charAt(0).toUpperCase();

  // Título de sección para agrupar las tarjetas
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.11em', textTransform: 'uppercase',
      color: '#c8a96e', paddingLeft: 4, marginTop: 8,
    }}>
      {children}
    </p>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-2xl mx-auto r-pad">

      {/* ── Header ── */}
      <PageHeader
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Configura tu empresa, notificaciones e integraciones"
      />

      {/* ── Tarjeta de identidad ── */}
      <div style={{
        ...card,
        marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: 16, flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(200,169,110,0.28) 0%, rgba(200,169,110,0.12) 100%)',
          border: '1.5px solid rgba(200,169,110,0.32)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: '#9a7a3a' }}>{inicial}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: c.text1, marginBottom: 3 }}>
            {perfil?.name || 'Tu empresa'}
          </h2>
          <p style={{ fontSize: 13, color: c.text2 }}>{perfil?.email}</p>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 13px', borderRadius: 99, flexShrink: 0,
          fontSize: 12, fontWeight: 600,
          background: planInfo.bg, color: planInfo.color,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: planInfo.color }} />
          Plan {planInfo.label}
        </span>
      </div>

      <div className="space-y-5">

        <SectionLabel>Empresa</SectionLabel>

        {/* ── Datos de la empresa ── */}
        <div style={card}>
          <h2 className="text-base font-semibold mb-5" style={{ color: c.text1 }}>
            Datos de la empresa
          </h2>
          <form onSubmit={guardar} className="space-y-4">
            <div>
              <label style={labelStyle}>Nombre de la empresa</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                onFocus={() => setFocusedInput('name')}
                onBlur={() => setFocusedInput(null)}
                placeholder="Casas García Inmobiliaria"
                style={inputStyleFor('name')}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Email de notificaciones
                <span style={{ color: c.text3, textTransform: 'none', fontWeight: 400, marginLeft: 6 }}>
                  · aquí llegan los avisos de nuevos leads
                </span>
              </label>
              <input
                type="email"
                value={form.notify_email}
                onChange={e => setForm(p => ({ ...p, notify_email: e.target.value }))}
                onFocus={() => setFocusedInput('notify')}
                onBlur={() => setFocusedInput(null)}
                placeholder="hola@tuempresa.com"
                style={inputStyleFor('notify')}
              />
            </div>
            <button
              type="submit"
              disabled={guardando}
              style={{ ...btnPrimary, opacity: guardando ? 0.6 : 1 }}
            >
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>
        </div>

        <SectionLabel>Captación de leads</SectionLabel>

        {/* ── Bandeja de entrada (IMAP) ── */}
        <div style={card}>
          <h2 className="text-base font-semibold mb-1" style={{ color: c.text1 }}>
            Bandeja de entrada
          </h2>
          <p className="text-sm mb-5" style={{ color: c.text2 }}>
            Conecta tu email y los mensajes de potenciales clientes se convertirán
            automáticamente en leads cualificados por la IA.
          </p>

          {!canImap ? (
            /* ── Bloqueado para plan Free ── */
            <div className="rounded-xl px-5 py-5"
              style={{ background: c.muted, border: `1px solid ${c.inputBorder}` }}>
              <div className="flex items-start gap-3">
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(200,169,110,0.14)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c8a96e"
                    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p className="text-sm font-semibold" style={{ color: c.text1, marginBottom: 3 }}>
                    Disponible en los planes Pro y Agencia
                  </p>
                  <p className="text-xs" style={{ color: c.text2, lineHeight: 1.55, marginBottom: 14 }}>
                    Conecta tu bandeja y convierte automáticamente cada email de un potencial
                    cliente en un lead cualificado por la IA, sin copiar y pegar nada.
                  </p>
                  <button onClick={() => router.push('/pricing')}
                    style={{ ...btnPrimary, padding: '9px 18px', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1a1814" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                    Mejorar mi plan
                  </button>
                </div>
              </div>
            </div>
          ) : imap.configured ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: 'rgba(110,200,122,0.08)', border: '1px solid rgba(110,200,122,0.2)' }}>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#2d7a3a' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#2d7a3a' }}>{imap.user}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#5a9a60' }}>{imap.host}</p>
                  </div>
                </div>
                <button
                  onClick={desconectarImap}
                  disabled={imapDesconectando}
                  style={{ color: '#b45309', fontSize: 12, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', opacity: imapDesconectando ? 0.6 : 1 }}
                >
                  {imapDesconectando ? 'Desconectando…' : 'Desconectar'}
                </button>
              </div>
              {imap.last_sync && (
                <p className="text-xs" style={{ color: c.text3 }}>
                  Última sincronización:{' '}
                  {new Date(imap.last_sync).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              <p className="text-xs" style={{ color: c.text3 }}>
                Se revisa tu bandeja cada 10 minutos. Los emails automáticos y newsletters se ignoran.
              </p>
            </div>
          ) : mostrarFormImap ? (
            <form onSubmit={conectarImap} className="space-y-3">
              <div>
                <label style={labelStyle}>Email de la bandeja</label>
                <input type="email" required value={imapForm.email}
                  onChange={e => setImapForm(p => ({ ...p, email: e.target.value }))}
                  onFocus={() => setFocusedInput('imap-email')} onBlur={() => setFocusedInput(null)}
                  placeholder="info@tuempresa.com" style={inputStyleFor('imap-email')} />
              </div>
              <div>
                <label style={labelStyle}>
                  Contraseña de aplicación
                  <span style={{ color: c.text3, textTransform: 'none', fontWeight: 400, marginLeft: 6 }}>
                    · genera una específica en tu proveedor
                  </span>
                </label>
                <input type="password" required value={imapForm.password}
                  onChange={e => setImapForm(p => ({ ...p, password: e.target.value }))}
                  onFocus={() => setFocusedInput('imap-pass')} onBlur={() => setFocusedInput(null)}
                  placeholder="••••••••••••••••" style={inputStyleFor('imap-pass')} />
              </div>
              <div>
                <label style={labelStyle}>
                  Servidor IMAP
                  <span style={{ color: c.text3, textTransform: 'none', fontWeight: 400, marginLeft: 6 }}>
                    · déjalo vacío para autodetectar
                  </span>
                </label>
                <input type="text" value={imapForm.host}
                  onChange={e => setImapForm(p => ({ ...p, host: e.target.value }))}
                  onFocus={() => setFocusedInput('imap-host')} onBlur={() => setFocusedInput(null)}
                  placeholder="imap.tuempresa.com" style={inputStyleFor('imap-host')} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={imapGuardando}
                  style={{ ...btnPrimary, opacity: imapGuardando ? 0.6 : 1 }}>
                  {imapGuardando ? 'Verificando…' : 'Conectar bandeja'}
                </button>
                <button type="button" onClick={() => setMostrarFormImap(false)} style={btnSecondary}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setMostrarFormImap(true)}
              style={{
                ...btnSecondary,
                padding:        '10px 16px',
                display:        'inline-flex',
                alignItems:     'center',
                gap:            10,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              Conectar mi bandeja de entrada
            </button>
          )}
        </div>

        {/* ── Avisos por WhatsApp ── */}
        <div style={card}>
          <div className="flex items-center gap-2 mb-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.67c2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.42 5.82c0 4.54-3.7 8.24-8.25 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24zm-2.9 4.43c-.18 0-.47.07-.72.34-.25.27-.95.93-.95 2.27s.97 2.63 1.11 2.81c.14.18 1.92 2.93 4.66 4.11.65.28 1.16.45 1.56.58.65.21 1.25.18 1.72.11.52-.08 1.62-.66 1.85-1.3.23-.64.23-1.18.16-1.3-.07-.11-.25-.18-.52-.32-.27-.14-1.62-.8-1.87-.89-.25-.09-.43-.14-.62.14-.18.27-.71.89-.87 1.07-.16.18-.32.2-.59.07-.27-.14-1.15-.42-2.19-1.35-.81-.72-1.36-1.62-1.52-1.89-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.46.09-.18.05-.34-.02-.48-.07-.14-.62-1.49-.85-2.04-.22-.53-.45-.46-.62-.47l-.53-.01z"/>
            </svg>
            <h2 className="text-base font-semibold" style={{ color: c.text1 }}>
              Avisos por WhatsApp
            </h2>
          </div>
          <p className="text-sm mb-5" style={{ color: c.text2 }}>
            Recibe un WhatsApp al instante cuando entre un lead <strong style={{ color: c.text1 }}>caliente</strong>.
            El primero en responder se lleva la operación.
          </p>

          <form onSubmit={guardarWhatsapp} className="space-y-4">
            <div>
              <label style={labelStyle}>Tu número de WhatsApp</label>
              <input
                type="tel"
                value={waForm.number}
                onChange={e => setWaForm(p => ({ ...p, number: e.target.value }))}
                onFocus={() => setFocusedInput('wa-number')}
                onBlur={() => setFocusedInput(null)}
                placeholder="+34 600 11 22 33"
                style={inputStyleFor('wa-number')}
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={waForm.enabled}
                onChange={e => setWaForm(p => ({ ...p, enabled: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: '#25D366', cursor: 'pointer' }}
              />
              <span className="text-sm" style={{ color: c.text1 }}>
                Avisarme por WhatsApp de los leads calientes
              </span>
            </label>

            <button type="submit" disabled={waGuardando}
              style={{ ...btnPrimary, opacity: waGuardando ? 0.6 : 1 }}>
              {waGuardando ? 'Guardando…' : 'Guardar preferencias'}
            </button>
          </form>
        </div>

        {/* ── Formulario público / API Key ── */}
        <div style={card}>
          <h2 className="text-base font-semibold mb-1" style={{ color: c.text1 }}>
            Formulario público de captación
          </h2>
          <p className="text-sm mb-5" style={{ color: c.text2 }}>
            Comparte este enlace en tu web para recibir leads directamente en el dashboard.
          </p>

          {perfil?.api_key ? (
            <div className="space-y-4">
              {/* Form URL */}
              <div>
                <label style={labelStyle}>Enlace del formulario</label>
                <div className="flex gap-2">
                  <input readOnly value={formUrl}
                    style={{ ...inputStyleFor('formurl'), fontFamily: 'monospace', fontSize: 12, flex: 1 }} />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(formUrl);
                      setCopiadoFormUrl(true);
                      setTimeout(() => setCopiadoFormUrl(false), 2000);
                      addToast('Enlace copiado', 'success');
                    }}
                    style={{ ...btnSecondary, padding: '10px 14px', minWidth: 76, whiteSpace: 'nowrap' }}
                  >
                    {copiadoFormUrl ? '✓ Copiado' : 'Copiar'}
                  </button>
                  <a href={formUrl} target="_blank" rel="noopener noreferrer"
                    style={{ ...btnSecondary, padding: '10px 14px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    Ver
                  </a>
                </div>
              </div>
              {/* API Key */}
              <div>
                <label style={labelStyle}>
                  API Key
                  <span style={{ color: c.text3, textTransform: 'none', fontWeight: 400, marginLeft: 6 }}>
                    · para integraciones propias
                  </span>
                </label>
                <div className="flex gap-2">
                  <input readOnly value={perfil.api_key}
                    style={{ ...inputStyleFor('apikey'), fontFamily: 'monospace', fontSize: 12, flex: 1 }} />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(perfil!.api_key);
                      setCopiadoApiKey(true);
                      setTimeout(() => setCopiadoApiKey(false), 2000);
                      addToast('API Key copiada', 'success');
                    }}
                    style={{ ...btnSecondary, padding: '10px 14px', minWidth: 76, whiteSpace: 'nowrap' }}
                  >
                    {copiadoApiKey ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: c.text3 }}>
              El formulario se activa tras la primera conexión con el servidor.
            </p>
          )}
        </div>

        {/* ── Equipo — solo plan agencia ── */}
        {perfil?.plan === 'agencia' && <SectionLabel>Equipo</SectionLabel>}
        {perfil?.plan === 'agencia' && (
          <div style={card}>
            <h2 className="text-base font-semibold mb-1" style={{ color: c.text1 }}>
              Miembros del equipo
            </h2>
            <p className="text-sm mb-5" style={{ color: c.text2 }}>
              Añade el ID de Clerk de tus agentes para que accedan al mismo dashboard.
              Pueden copiarlo desde su propia página de perfil → Cuenta → ID de usuario.
            </p>

            {equipo.length > 0 && (
              <ul className="space-y-2 mb-4">
                {equipo.map(m => (
                  <li key={m.member_id}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                    style={{ background: c.muted, border: `1px solid ${c.divider}` }}>
                    <span className="min-w-0">
                      {m.member_name && (
                        <span className="text-sm font-medium block truncate" style={{ color: c.text1 }}>
                          {m.member_name}
                        </span>
                      )}
                      <span className="text-xs truncate block" style={{ fontFamily: 'monospace', color: c.text3 }}>
                        {m.member_id}
                      </span>
                    </span>
                    <button
                      onClick={() => eliminarMiembro(m.member_id)}
                      className="text-xs font-medium ml-3 shrink-0 transition-colors"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b45309' }}
                    >
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={agregarMiembro} className="space-y-2">
              <input
                type="text"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                onFocus={() => setFocusedInput('member-name')} onBlur={() => setFocusedInput(null)}
                placeholder="Nombre del agente (p. ej. Laura Pérez)"
                style={{ ...inputStyleFor('member-name'), width: '100%' }}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevoMiembro}
                  onChange={e => setNuevoMiembro(e.target.value)}
                  onFocus={() => setFocusedInput('member')} onBlur={() => setFocusedInput(null)}
                  placeholder="user_xxxxxxxxxxxxxxxxxxxxxxxx"
                  style={{ ...inputStyleFor('member'), flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                />
                <button type="submit" disabled={agregandoMiembro || !nuevoMiembro.trim()}
                  style={{ ...btnPrimary, opacity: (agregandoMiembro || !nuevoMiembro.trim()) ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                  {agregandoMiembro ? 'Añadiendo…' : 'Añadir'}
                </button>
              </div>
            </form>
          </div>
        )}

        <SectionLabel>Cuenta y facturación</SectionLabel>

        {/* ── Información de la cuenta ── */}
        <div style={card}>
          <h2 className="text-base font-semibold mb-5" style={{ color: c.text1 }}>
            Información de la cuenta
          </h2>

          <div className="space-y-3">
            {/* Email */}
            <div className="flex items-center justify-between py-2.5"
              style={{ borderBottom: `1px solid ${c.divider}` }}>
              <span className="text-sm" style={{ color: c.text2 }}>Email de acceso</span>
              <span className="text-sm font-medium" style={{ color: c.text1 }}>{perfil?.email}</span>
            </div>

            {/* Plan */}
            <div className="flex items-center justify-between py-2.5"
              style={{ borderBottom: `1px solid ${c.divider}` }}>
              <span className="text-sm" style={{ color: c.text2 }}>Plan activo</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: planInfo.bg, color: planInfo.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: planInfo.color }} />
                {planInfo.label}
              </span>
            </div>

            {/* ID de usuario */}
            {user?.id && (
              <div className="flex items-center justify-between py-2.5"
                style={{ borderBottom: `1px solid ${c.divider}` }}>
                <span className="text-sm" style={{ color: c.text2 }}>ID de usuario</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(user.id);
                    setCopiadoId(true);
                    setTimeout(() => setCopiadoId(false), 2000);
                    addToast('ID copiado', 'success');
                  }}
                  className="text-xs font-mono transition-colors"
                  style={{
                    background:    'none',
                    border:        'none',
                    cursor:        'pointer',
                    color:         copiadoId ? '#2d7a3a' : c.text3,
                    maxWidth:      200,
                    overflow:      'hidden',
                    textOverflow:  'ellipsis',
                    whiteSpace:    'nowrap',
                  }}
                  title="Haz clic para copiar"
                >
                  {copiadoId ? '✓ Copiado' : user.id}
                </button>
              </div>
            )}

            {/* Miembro desde */}
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm" style={{ color: c.text2 }}>Miembro desde</span>
              <span className="text-sm" style={{ color: c.text1 }}>
                {perfil?.created_at
                  ? new Date(perfil.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Suscripción — solo planes de pago ── */}
        {isPaid && (
          <div style={card}>
            <h2 className="text-base font-semibold mb-1" style={{ color: c.text1 }}>
              Suscripción
            </h2>
            <p className="text-sm mb-5" style={{ color: c.text2 }}>
              Gestiona tu plan, método de pago y facturas desde el portal de Stripe.
            </p>

            {cancelSuccess !== null ? (
              /* ── Estado: cancelación confirmada ── */
              <div className="rounded-xl px-4 py-4 space-y-1"
                style={{ background: 'rgba(200,169,110,0.1)', border: '1.5px solid rgba(200,169,110,0.3)' }}>
                <p className="text-sm font-semibold" style={{ color: '#9a7a3a' }}>
                  Suscripción cancelada
                </p>
                <p className="text-sm" style={{ color: c.text2 }}>
                  Seguirás con acceso completo hasta el{' '}
                  <strong style={{ color: c.text1 }}>
                    {new Date(cancelSuccess * 1000).toLocaleDateString('es-ES', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </strong>.
                  Tu plan pasará a Gratuito al finalizar ese período.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Gestionar facturación */}
                <button
                  onClick={abrirPortal}
                  disabled={abriendo}
                  style={{ ...btnPrimary, opacity: abriendo ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                  {abriendo ? 'Abriendo portal…' : 'Gestionar facturación'}
                </button>

                {/* Cancelar suscripción */}
                <div>
                  {!confirmCancel ? (
                    <button
                      onClick={() => setConfirmCancel(true)}
                      style={{
                        background: 'none',
                        border:     'none',
                        cursor:     'pointer',
                        color:      c.text2,
                        fontSize:   13,
                        padding:    0,
                        textDecoration: 'underline',
                        textDecorationColor: c.divider,
                      }}
                    >
                      Cancelar suscripción
                    </button>
                  ) : (
                    /* ── Oferta de retención antes de cancelar ── */
                    <div className="rounded-xl p-5"
                      style={{ background: c.muted, border: `1.5px solid ${c.inputBorder}` }}>
                      <p className="text-sm font-semibold mb-2" style={{ color: c.text1 }}>
                        ¿Seguro que quieres irte?
                      </p>
                      <p className="text-xs mb-3" style={{ color: c.text2, lineHeight: 1.6 }}>
                        Si cancelas perderás lo que hace que no se te escape ningún cliente:
                      </p>
                      <ul className="mb-4" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {['Leads ilimitados cualificados con IA', 'Avisos de leads calientes y sin contactar', 'Respuestas automáticas a tus clientes'].map(t => (
                          <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: c.text2 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c8a96e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {t}
                          </li>
                        ))}
                      </ul>
                      <div className="rounded-lg px-3 py-2.5 mb-4" style={{ background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.22)' }}>
                        <p className="text-xs" style={{ color: '#9a7a3a', lineHeight: 1.5 }}>
                          ¿Es por el precio o te falta algo? Escríbenos a{' '}
                          <a href="mailto:contacto@inmobia.es" style={{ color: '#9a7a3a', fontWeight: 600 }}>contacto@inmobia.es</a>
                          {' '}y buscamos una solución antes de que te vayas.
                        </p>
                      </div>
                      <p className="text-xs mb-3" style={{ color: c.text3, lineHeight: 1.55 }}>
                        Si cancelas, tu plan pasará a Gratuito al final del período actual. Mantienes el acceso hasta entonces.
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setConfirmCancel(false)}
                          style={{
                            background: '#c8a96e', color: '#1a1814', border: 'none',
                            borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          Mantener mi plan
                        </button>
                        <button
                          onClick={cancelarSuscripcion}
                          disabled={cancelando}
                          style={{
                            background: 'transparent', color: c.text2,
                            border: `1.5px solid ${c.inputBorder}`, borderRadius: 9,
                            padding: '9px 16px', fontSize: 13, fontWeight: 500,
                            cursor: cancelando ? 'default' : 'pointer', opacity: cancelando ? 0.6 : 1,
                          }}
                        >
                          {cancelando ? 'Cancelando…' : 'Cancelar de todas formas'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
