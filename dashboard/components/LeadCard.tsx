'use client';

// Tarjeta de lead — navegación, cambio inline de estado, tema claro/oscuro

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import type { Lead, EstadoLead } from '@/types/lead';
import { actualizarEstado } from '@/lib/api';
import LeadBadge from './LeadBadge';
import ScoreBar from './ScoreBar';
import { useTheme } from './ThemeProvider';
import { formatearFecha, formatearFechaRelativa } from '@/lib/utils';

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTADOS_OPCIONES: EstadoLead[] = ['PENDIENTE', 'CONTACTADO', 'CERRADO', 'DESCARTADO'];

const ESTADO_LABEL: Record<EstadoLead, string> = {
  PENDIENTE: 'Pendiente', CONTACTADO: 'Contactado',
  CERRADO: 'Cerrado',     DESCARTADO: 'Descartado',
};

const ESTADO_ESTILOS: Record<EstadoLead, { bg: string; color: string; border: string; dot: string }> = {
  PENDIENTE:  { bg: 'rgba(200,169,110,0.1)',  color: '#9a7a3a', border: 'rgba(200,169,110,0.3)',  dot: '#c8a96e' },
  CONTACTADO: { bg: 'rgba(110,168,200,0.08)', color: '#3a7a9a', border: 'rgba(110,168,200,0.25)', dot: '#6ea8c8' },
  CERRADO:    { bg: 'rgba(110,200,122,0.08)', color: '#2d7a3a', border: 'rgba(110,200,122,0.25)', dot: '#6ec87a' },
  DESCARTADO: { bg: 'rgba(122,116,104,0.07)', color: '#7a7468', border: 'rgba(122,116,104,0.2)',  dot: '#9a9490' },
};

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const letras = name
    .split(' ').slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '').join('');
  return (
    <div style={{
      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, rgba(200,169,110,0.25) 0%, rgba(200,169,110,0.12) 100%)',
      border: '1.5px solid rgba(200,169,110,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#9a7a3a', userSelect: 'none', letterSpacing: '0.02em' }}>
        {letras}
      </span>
    </div>
  );
}

// ── Status dropdown ───────────────────────────────────────────────────────────

interface StatusDropdownProps {
  leadId:         string;
  status:         EstadoLead;
  onStatusChange?: (id: string, status: EstadoLead) => void;
}

function StatusDropdown({ leadId, status: initialStatus, onStatusChange }: StatusDropdownProps) {
  const { getToken }  = useAuth();
  const { c }         = useTheme();
  const [status, setStatus]     = useState<EstadoLead>(initialStatus);
  const [open, setOpen]         = useState(false);
  const [guardando, setGuardando] = useState(false);

  const est = ESTADO_ESTILOS[status];

  async function cambiar(newStatus: EstadoLead) {
    if (newStatus === status) { setOpen(false); return; }
    setOpen(false);
    const prev = status;
    setStatus(newStatus);           // optimistic
    setGuardando(true);
    try {
      await actualizarEstado(leadId, { status: newStatus }, getToken);
      onStatusChange?.(leadId, newStatus);
    } catch {
      setStatus(prev);              // revert on error
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ position: 'relative' }}>

      {/* Trigger */}
      <button
        onClick={() => !guardando && setOpen(p => !p)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 9px 4px 8px', borderRadius: 8, fontSize: 11,
          fontWeight: 600, border: `1px solid ${est.border}`,
          background: est.bg, color: est.color,
          cursor: guardando ? 'default' : 'pointer',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        {guardando ? (
          <span className="animate-spin" style={{
            display: 'inline-block', width: 10, height: 10,
            border: `1.5px solid ${est.color}33`,
            borderTopColor: est.color, borderRadius: '50%',
          }} />
        ) : (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
            stroke={est.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
        {ESTADO_LABEL[status]}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 50,
            background: c.card, border: c.cardBorder, borderRadius: 10,
            boxShadow: '0 8px 32px rgba(26,24,20,0.14)', overflow: 'hidden',
            minWidth: 160,
          }}>
            {ESTADOS_OPCIONES.map(s => {
              const es  = ESTADO_ESTILOS[s];
              const sel = s === status;
              return (
                <button key={s} onClick={() => cambiar(s)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    width: '100%', padding: '9px 13px',
                    fontSize: 12, fontWeight: sel ? 600 : 400,
                    background: sel ? `${es.dot}14` : 'transparent',
                    color: sel ? es.color : c.text1,
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => {
                    if (!sel) (e.currentTarget as HTMLElement).style.background = `${es.dot}0a`;
                  }}
                  onMouseLeave={e => {
                    if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: es.dot, opacity: sel ? 1 : 0.55,
                  }} />
                  {ESTADO_LABEL[s]}
                  {sel && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke={es.color} strokeWidth="2.5" strokeLinecap="round"
                      style={{ marginLeft: 'auto' }}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  lead:            Lead;
  index?:          number;
  onStatusChange?: (id: string, status: EstadoLead) => void;
}

export default function LeadCard({ lead, index = 0, onStatusChange }: Props) {
  const router  = useRouter();
  const { c }   = useTheme();
  const delayMs = index * 55;

  return (
    <div
      className="animate-fade-up rounded-xl p-5"
      style={{
        background:     c.card,
        border:         c.cardBorder,
        animationDelay: `${delayMs}ms`,
        boxShadow:      '0 1px 4px rgba(26,24,20,0.04)',
        transition:     'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
        display:        'flex',
        flexDirection:  'column',
        cursor:         'pointer',
      }}
      onClick={() => router.push(`/leads/${lead.id}`)}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'rgba(200,169,110,0.55)';
        el.style.boxShadow   = '0 6px 24px rgba(200,169,110,0.13)';
        el.style.transform   = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = '';
        el.style.boxShadow   = '0 1px 4px rgba(26,24,20,0.04)';
        el.style.transform   = 'translateY(0)';
      }}
    >
      {/* Avatar + nombre + badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <Avatar name={lead.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: c.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.name}
            </p>
            <span className={lead.classification === 'CALIENTE' ? 'animate-pulse-warm' : ''} style={{ flexShrink: 0 }}>
              <LeadBadge clasificacion={lead.classification} size="sm" />
            </span>
          </div>
          <p style={{ fontSize: 12, color: c.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.email}
          </p>
        </div>
      </div>

      {/* Extracto del mensaje */}
      <p className="line-clamp-2" style={{ fontSize: 13, color: c.text4, lineHeight: 1.5, flex: 1, marginBottom: 16 }}>
        {lead.message}
      </p>

      {/* Score bar */}
      <ScoreBar score={lead.score} />

      {/* Footer — stopPropagation para que el dropdown no navegue */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${c.divider}` }}
        onClick={e => e.stopPropagation()}
      >
        <StatusDropdown
          leadId={lead.id}
          status={(lead.status ?? 'PENDIENTE') as EstadoLead}
          onStatusChange={onStatusChange}
        />
        <span style={{ fontSize: 11, color: c.text2 }} title={formatearFecha(lead.created_at)}>
          {formatearFechaRelativa(lead.created_at)}
        </span>
      </div>
    </div>
  );
}
