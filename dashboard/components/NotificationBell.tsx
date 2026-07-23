'use client';

// Centro de notificaciones:
//  • Leads nuevos (desde la última visita, recordada en localStorage)
//  • Notificaciones de sistema del backend (pagos, cambios de plan…)
//  • Aviso del navegador + sonido cuando entra un lead caliente

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { obtenerLeads, apiFetch } from '@/lib/api';
import type { Lead } from '@/types/lead';
import { useTheme } from './ThemeProvider';
import { formatearFechaRelativa } from '@/lib/utils';

const SEEN_KEY = 'inmuebia-notif-seen';

const CLASIF_COLOR: Record<string, string> = { CALIENTE: '#c8796e', TIBIO: '#c8a96e', 'FRÍO': '#6ea8c8' };
const CLASIF_LABEL: Record<string, string> = { CALIENTE: 'Caliente', TIBIO: 'Tibio', 'FRÍO': 'Frío' };

interface SysNotif { id: string; type: string; title: string; body: string; read: number; created_at: string }

interface Item {
  id: string; kind: 'lead' | 'sys'; title: string; subtitle: string;
  time: string; color: string; unread: boolean; leadId?: string; sysType?: string;
}

// ── Sonido (beep generado, sin assets) ──
let _audio: AudioContext | null = null;
function ding() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    _audio = _audio || new Ctx();
    const o = _audio.createOscillator();
    const g = _audio.createGain();
    o.connect(g); g.connect(_audio.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(880, _audio.currentTime);
    o.frequency.setValueAtTime(1175, _audio.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, _audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.16, _audio.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, _audio.currentTime + 0.4);
    o.start(); o.stop(_audio.currentTime + 0.42);
  } catch { /* ignore */ }
}

export default function NotificationBell({ placement = 'sidebar', enableAlerts = false }: {
  placement?: 'sidebar' | 'topbar';
  enableAlerts?: boolean;
}) {
  const { c }        = useTheme();
  const router       = useRouter();
  const { getToken } = useAuth();

  const [leads, setLeads]       = useState<Lead[]>([]);
  const [sys, setSys]           = useState<SysNotif[]>([]);
  const [seen, setSeen]         = useState<number>(0);
  const [open, setOpen]         = useState(false);
  const [rect, setRect]         = useState<DOMRect | null>(null);
  const [permiso, setPermiso]   = useState<string>('unsupported');
  const btnRef   = useRef<HTMLButtonElement>(null);
  const conocidos = useRef<Set<string>>(new Set());
  const primera   = useRef(true);

  useEffect(() => {
    try { setSeen(Number(localStorage.getItem(SEEN_KEY) || 0)); } catch { /* ignore */ }
    if (typeof Notification !== 'undefined') setPermiso(Notification.permission);

    let cancel = false;
    const cargar = async () => {
      try {
        const [ls, res] = await Promise.all([
          obtenerLeads(getToken, { limit: 15 }),
          apiFetch('/me/notifications', getToken).then(r => r.ok ? r.json() : { notifications: [] }).catch(() => ({ notifications: [] })),
        ]);
        if (cancel) return;
        setSys(res.notifications ?? []);

        // Detección de leads calientes nuevos → aviso + sonido (solo la instancia con alertas)
        if (enableAlerts) {
          if (primera.current) {
            ls.forEach(l => conocidos.current.add(l.id));
            primera.current = false;
          } else {
            const nuevosCalientes = ls.filter(l => !conocidos.current.has(l.id) && l.classification === 'CALIENTE');
            ls.forEach(l => conocidos.current.add(l.id));
            if (nuevosCalientes.length > 0) {
              ding();
              avisarNavegador(nuevosCalientes);
            }
          }
        }
        setLeads(ls);
      } catch { /* silencioso */ }
    };
    cargar();
    const iv = setInterval(cargar, 60_000);
    return () => { cancel = true; clearInterval(iv); };
  }, [getToken, enableAlerts]); // eslint-disable-line react-hooks/exhaustive-deps

  function avisarNavegador(nuevos: Lead[]) {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const uno = nuevos[0];
      const n = new Notification(
        nuevos.length > 1 ? `🔥 ${nuevos.length} nuevos leads calientes` : '🔥 Nuevo lead caliente',
        { body: nuevos.length > 1 ? 'Entra para contactarlos cuanto antes.' : `${uno.name} — listo para contactar`, icon: '/icon.svg', tag: 'inmuebia-lead' },
      );
      n.onclick = () => { window.focus(); router.push(nuevos.length > 1 ? '/leads' : `/leads/${uno.id}`); n.close(); };
    } catch { /* ignore */ }
  }

  async function pedirPermiso() {
    try {
      const p = await Notification.requestPermission();
      setPermiso(p);
    } catch { /* ignore */ }
  }

  // ── Construir lista unificada ──
  const leadUnread = leads.filter(l => new Date(l.created_at).getTime() > seen).length;
  const sysUnread  = sys.filter(n => !n.read).length;
  const total      = leadUnread + sysUnread;

  const items: Item[] = [
    ...leads.slice(0, 10).map<Item>(l => ({
      id: 'lead-' + l.id, kind: 'lead', leadId: l.id,
      title: (new Date(l.created_at).getTime() > seen ? 'Nuevo lead: ' : '') + l.name,
      subtitle: l.classification ? CLASIF_LABEL[l.classification] : 'Sin cualificar',
      time: l.created_at,
      color: l.classification ? (CLASIF_COLOR[l.classification] ?? c.text2) : c.text3,
      unread: new Date(l.created_at).getTime() > seen,
    })),
    ...sys.map<Item>(n => ({
      id: 'sys-' + n.id, kind: 'sys', sysType: n.type,
      title: n.title, subtitle: n.body, time: n.created_at,
      color: n.type === 'pago' ? '#c8796e' : '#c8a96e',
      unread: !n.read,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 14);

  function toggle() {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(o => !o);
  }

  async function marcarLeido() {
    const now = Date.now();
    try { localStorage.setItem(SEEN_KEY, String(now)); } catch { /* ignore */ }
    setSeen(now);
    setSys(prev => prev.map(n => ({ ...n, read: 1 })));
    try { await apiFetch('/me/notifications/read', getToken, { method: 'POST' }); } catch { /* ignore */ }
  }

  function abrirItem(it: Item) {
    setOpen(false);
    if (it.kind === 'lead' && it.leadId) { marcarLeido(); router.push(`/leads/${it.leadId}`); }
    else { marcarLeido(); router.push('/perfil'); }
  }

  // ── Posición del panel ──
  let panelStyle: React.CSSProperties = {};
  if (rect) {
    const W = 330;
    const left = Math.min(Math.max(placement === 'topbar' ? rect.right - W : rect.left, 12), (typeof window !== 'undefined' ? window.innerWidth : 400) - W - 12);
    panelStyle = placement === 'topbar'
      ? { position: 'fixed', top: rect.bottom + 10, left, width: W }
      : { position: 'fixed', bottom: window.innerHeight - rect.top + 10, left, width: W };
  }

  return (
    <>
      <button ref={btnRef} onClick={toggle} title="Notificaciones"
        style={{
          position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: open ? 'rgba(200,169,110,0.15)' : 'transparent',
          border: `1px solid ${open ? 'rgba(200,169,110,0.3)' : c.inputBorder}`,
          color: total > 0 ? '#c8a96e' : c.text2, cursor: 'pointer', transition: 'all 0.15s',
        }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {total > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 99, background: '#c8796e', color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${c.sidebar}`,
          }}>
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 70 }} onClick={() => setOpen(false)} />
          <div className="animate-fade-up" style={{
            ...panelStyle, zIndex: 71, maxWidth: 'calc(100vw - 24px)',
            background: c.card, border: c.cardBorder, borderRadius: 14,
            boxShadow: '0 16px 50px rgba(26,24,20,0.22)', overflow: 'hidden',
          }}>
            {/* Cabecera */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: `1px solid ${c.divider}` }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: c.text1 }}>Notificaciones</span>
              {total > 0 && (
                <button onClick={marcarLeido} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#9a7a3a' }}>
                  Marcar como leído
                </button>
              )}
            </div>

            {/* Activar avisos del navegador */}
            {permiso === 'default' && (
              <button onClick={pedirPermiso} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '10px 16px',
                background: 'rgba(200,169,110,0.08)', border: 'none', borderBottom: `1px solid ${c.divider}`,
                cursor: 'pointer', textAlign: 'left', fontSize: 12.5, color: '#9a7a3a', fontWeight: 600,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                Activa los avisos del navegador con sonido
              </button>
            )}

            {/* Lista */}
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {items.length === 0 ? (
                <p style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: c.text2 }}>
                  No hay notificaciones todavía.
                </p>
              ) : items.map(it => (
                <button key={it.id} onClick={() => abrirItem(it)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 16px',
                    background: it.unread ? 'rgba(200,169,110,0.05)' : 'transparent',
                    border: 'none', borderBottom: `1px solid ${c.divider}`, cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,110,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = it.unread ? 'rgba(200,169,110,0.05)' : 'transparent'; }}
                >
                  {it.kind === 'sys' ? (
                    <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1, background: `${it.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={it.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        {it.sysType === 'pago'
                          ? <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>
                          : <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />}
                      </svg>
                    </span>
                  ) : (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6, background: it.color }} />
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: it.unread ? 600 : 500, color: c.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.title}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
                      <span style={{ fontSize: 11.5, color: it.kind === 'sys' ? c.text2 : it.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>
                        {it.subtitle}
                      </span>
                      <span style={{ width: 2, height: 2, borderRadius: '50%', background: c.text3, flexShrink: 0 }} />
                      <span style={{ fontSize: 11.5, color: c.text2, flexShrink: 0 }}>{formatearFechaRelativa(it.time)}</span>
                    </span>
                  </span>
                  {it.unread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c8a96e', flexShrink: 0, marginTop: 4 }} />}
                </button>
              ))}
            </div>

            {/* Pie */}
            {leads.length > 0 && (
              <button onClick={() => { setOpen(false); router.push('/leads'); }}
                style={{ width: '100%', padding: '11px', background: c.muted, border: 'none', borderTop: `1px solid ${c.divider}`, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#9a7a3a' }}>
                Ver todos los leads
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
