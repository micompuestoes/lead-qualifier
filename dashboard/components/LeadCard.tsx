// Tarjeta de lead — animación staggered, tema claro/oscuro

import Link from 'next/link';
import type { Lead, EstadoLead } from '@/types/lead';
import LeadBadge from './LeadBadge';
import ScoreBar from './ScoreBar';
import { useTheme } from './ThemeProvider';
import { formatearFecha, formatearFechaRelativa } from '@/lib/utils';

// ── Constantes ────────────────────────────────────────────────────────────────

interface Props {
  lead: Lead;
  index?: number;
}

const estadoEstilos: Record<EstadoLead, { bg: string; color: string; border: string }> = {
  PENDIENTE:  { bg: 'rgba(200,169,110,0.1)',  color: '#9a7a3a', border: 'rgba(200,169,110,0.3)'  },
  CONTACTADO: { bg: 'rgba(110,168,200,0.08)', color: '#3a7a9a', border: 'rgba(110,168,200,0.25)' },
  CERRADO:    { bg: 'rgba(110,200,122,0.08)', color: '#2d7a3a', border: 'rgba(110,200,122,0.25)' },
  DESCARTADO: { bg: 'rgba(122,116,104,0.07)', color: '#7a7468', border: 'rgba(122,116,104,0.2)'  },
};

const ESTADO_LABEL: Record<EstadoLead, string> = {
  PENDIENTE: 'Pendiente', CONTACTADO: 'Contactado', CERRADO: 'Cerrado', DESCARTADO: 'Descartado',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const letras = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div style={{
      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, rgba(200,169,110,0.25) 0%, rgba(200,169,110,0.12) 100%)',
      border: '1.5px solid rgba(200,169,110,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        fontSize: 12, fontWeight: 700,
        color: '#9a7a3a',
        userSelect: 'none', letterSpacing: '0.02em',
      }}>
        {letras}
      </span>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function LeadCard({ lead, index = 0 }: Props) {
  const { c } = useTheme();
  const status  = (lead.status ?? 'PENDIENTE') as EstadoLead;
  const est     = estadoEstilos[status];
  const delayMs = index * 55;

  return (
    <Link href={`/leads/${lead.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        className="animate-fade-up rounded-xl p-5 h-full"
        style={{
          background:     c.card,
          border:         c.cardBorder,
          animationDelay: `${delayMs}ms`,
          boxShadow:      '0 1px 4px rgba(26,24,20,0.04)',
          transition:     'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
          display:        'flex',
          flexDirection:  'column',
        }}
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
        {/* ── Avatar + nombre + badge ── */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar name={lead.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <p className="font-semibold text-sm leading-snug truncate" style={{ color: c.text1 }}>
                {lead.name}
              </p>
              <span className={`shrink-0 ${lead.classification === 'CALIENTE' ? 'animate-pulse-warm' : ''}`}>
                <LeadBadge clasificacion={lead.classification} size="sm" />
              </span>
            </div>
            <p className="text-xs truncate" style={{ color: c.text2 }}>{lead.email}</p>
          </div>
        </div>

        {/* ── Extracto del mensaje ── */}
        <p className="text-sm line-clamp-2 mb-4 leading-relaxed flex-1"
          style={{ color: c.text4 }}>
          {lead.message}
        </p>

        {/* ── Score bar ── */}
        <ScoreBar score={lead.score} />

        {/* ── Pie: estado + fecha relativa ── */}
        <div className="flex items-center justify-between mt-3 pt-3"
          style={{ borderTop: `1px solid ${c.divider}` }}>
          <span className="px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{ background: est.bg, color: est.color, border: `1px solid ${est.border}` }}>
            {ESTADO_LABEL[status]}
          </span>

          {/* Fecha relativa con tooltip con fecha completa */}
          <span
            className="text-xs"
            style={{ color: c.text2 }}
            title={formatearFecha(lead.created_at)}
          >
            {formatearFechaRelativa(lead.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}
