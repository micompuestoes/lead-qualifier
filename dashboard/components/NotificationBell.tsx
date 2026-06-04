'use client';

// Centro de notificaciones: campana con badge de no leídos + panel con los
// leads recientes. Las "no leídas" son los leads entrados desde la última visita
// (se recuerda en localStorage).

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { obtenerLeads } from '@/lib/api';
import type { Lead } from '@/types/lead';
import { useTheme } from './ThemeProvider';
import { formatearFechaRelativa } from '@/lib/utils';

const SEEN_KEY = 'inmobia-notif-seen';

const CLASIF_COLOR: Record<string, string> = {
  CALIENTE: '#c8796e',
  TIBIO:    '#c8a96e',
  'FRÍO':   '#6ea8c8',
};
const CLASIF_LABEL: Record<string, string> = {
  CALIENTE: 'Caliente',
  TIBIO:    'Tibio',
  'FRÍO':   'Frío',
};

export default function NotificationBell({ placement = 'sidebar' }: { placement?: 'sidebar' | 'topbar' }) {
  const { c }        = useTheme();
  const router       = useRouter();
  const { getToken } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [seen, setSeen]   = useState<number>(0);
  const [open, setOpen]   = useState(false);
  const [rect, setRect]   = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try { setSeen(Number(localStorage.getItem(SEEN_KEY) || 0)); } catch { /* ignore */ }
    let cancel = false;
    const cargar = () =>
      obtenerLeads(getToken, { limit: 15 })
        .then(d => { if (!cancel) setLeads(d); })
        .catch(() => {});
    cargar();
    const iv = setInterval(cargar, 60_000);
    return () => { cancel = true; clearInterval(iv); };
  }, [getToken]);

  const nuevos    = leads.filter(l => new Date(l.created_at).getTime() > seen);
  const noLeidos  = nuevos.length;
  const calientesPend = leads.filter(l => l.classification === 'CALIENTE' && (l.status ?? 'PENDIENTE') === 'PENDIENTE').length;
  const recientes = leads.slice(0, 8);

  function toggle() {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(o => !o);
  }

  function marcarLeido() {
    const now = Date.now();
    try { localStorage.setItem(SEEN_KEY, String(now)); } catch { /* ignore */ }
    setSeen(now);
  }

  function irA(id: string) {
    setOpen(false);
    marcarLeido();
    router.push(`/leads/${id}`);
  }

  // Posición del panel
  let panelStyle: React.CSSProperties = { display: 'none' };
  if (rect) {
    const W = 330;
    const left = Math.min(Math.max(placement === 'topbar' ? rect.right - W : rect.left, 12), window.innerWidth - W - 12);
    panelStyle = placement === 'topbar'
      ? { position: 'fixed', top: rect.bottom + 10, left, width: W }
      : { position: 'fixed', bottom: window.innerHeight - rect.top + 10, left, width: W };
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        title="Notificaciones"
        style={{
          position: 'relative',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: open ? 'rgba(200,169,110,0.15)' : 'transparent',
          border: `1px solid ${open ? 'rgba(200,169,110,0.3)' : c.inputBorder}`,
          color: noLeidos > 0 ? '#c8a96e' : c.text2, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {noLeidos > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 99, background: '#c8796e', color: '#fff',
            fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${c.sidebar}`,
          }}>
            {noLeidos > 9 ? '9+' : noLeidos}
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
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 16px', borderBottom: `1px solid ${c.divider}`,
            }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: c.text1 }}>Notificaciones</span>
              {noLeidos > 0 && (
                <button onClick={marcarLeido} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#9a7a3a' }}>
                  Marcar como leído
                </button>
              )}
            </div>

            {/* Alerta de calientes pendientes */}
            {calientesPend > 0 && (
              <button onClick={() => { setOpen(false); router.push('/leads'); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px',
                  background: 'rgba(200,121,110,0.07)', border: 'none', borderBottom: `1px solid ${c.divider}`,
                  cursor: 'pointer', textAlign: 'left',
                }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(200,121,110,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c8796e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                  </svg>
                </span>
                <span style={{ fontSize: 13, color: c.text1, lineHeight: 1.4 }}>
                  <strong>{calientesPend} lead{calientesPend > 1 ? 's' : ''} caliente{calientesPend > 1 ? 's' : ''}</strong> sin contactar
                </span>
              </button>
            )}

            {/* Lista de leads recientes */}
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {recientes.length === 0 ? (
                <p style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: c.text2 }}>
                  No hay notificaciones todavía.
                </p>
              ) : recientes.map(l => {
                const esNuevo = new Date(l.created_at).getTime() > seen;
                const color = l.classification ? (CLASIF_COLOR[l.classification] ?? c.text2) : c.text3;
                return (
                  <button key={l.id} onClick={() => irA(l.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 16px',
                      background: esNuevo ? 'rgba(200,169,110,0.05)' : 'transparent',
                      border: 'none', borderBottom: `1px solid ${c.divider}`, cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,110,0.08)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = esNuevo ? 'rgba(200,169,110,0.05)' : 'transparent'; }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5, background: color }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: esNuevo ? 600 : 500, color: c.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {esNuevo ? 'Nuevo lead: ' : ''}{l.name}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
                        <span style={{ fontSize: 11.5, color }}>
                          {l.classification ? CLASIF_LABEL[l.classification] : 'Sin cualificar'}
                        </span>
                        <span style={{ width: 2, height: 2, borderRadius: '50%', background: c.text3 }} />
                        <span style={{ fontSize: 11.5, color: c.text2 }}>{formatearFechaRelativa(l.created_at)}</span>
                      </span>
                    </span>
                    {esNuevo && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c8a96e', flexShrink: 0, marginTop: 4 }} />}
                  </button>
                );
              })}
            </div>

            {/* Pie */}
            {recientes.length > 0 && (
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
