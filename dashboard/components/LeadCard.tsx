// Tarjeta de lead — animación staggered, tema claro/oscuro

import Link from 'next/link';
import type { Lead, EstadoLead } from '@/types/lead';
import LeadBadge from './LeadBadge';
import ScoreBar from './ScoreBar';
import { useTheme } from './ThemeProvider';

interface Props {
  lead: Lead;
  index?: number;
}

const estadoEstilos: Record<EstadoLead, { bg: string; color: string; border: string }> = {
  PENDIENTE:  { bg: 'rgba(200,169,110,0.1)',  color: '#9a7a3a', border: 'rgba(200,169,110,0.3)' },
  CONTACTADO: { bg: 'rgba(110,168,200,0.08)', color: '#3a7a9a', border: 'rgba(110,168,200,0.25)' },
  CERRADO:    { bg: 'rgba(110,200,122,0.08)', color: '#2d7a3a', border: 'rgba(110,200,122,0.25)' },
  DESCARTADO: { bg: 'rgba(122,116,104,0.07)', color: '#7a7468', border: 'rgba(122,116,104,0.2)' },
};

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function Iniciales({ name }: { name: string }) {
  const letras = name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: 'rgba(200,169,110,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#9a7a3a', userSelect: 'none' }}>
        {letras}
      </span>
    </div>
  );
}

export default function LeadCard({ lead, index = 0 }: Props) {
  const { c } = useTheme();
  const status = (lead.status ?? 'PENDIENTE') as EstadoLead;
  const delayMs = index * 60;
  const est     = estadoEstilos[status];

  return (
    <Link href={`/leads/${lead.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        className="animate-fade-up rounded-xl p-5 transition-all duration-200"
        style={{
          background:       c.card,
          border:           c.cardBorder,
          animationDelay:   `${delayMs}ms`,
          boxShadow:        '0 1px 4px rgba(26,24,20,0.05)',
          transition:       'background 0.25s, border-color 0.25s, box-shadow 0.2s, transform 0.2s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = 'rgba(200,169,110,0.5)';
          el.style.boxShadow   = '0 4px 20px rgba(200,169,110,0.12)';
          el.style.transform   = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = '';
          el.style.boxShadow   = '0 1px 4px rgba(26,24,20,0.05)';
          el.style.transform   = 'translateY(0)';
        }}
      >
        {/* Avatar + nombre + badge */}
        <div className="flex items-start gap-3 mb-3">
          <Iniciales name={lead.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <p className="font-semibold truncate text-sm" style={{ color: c.text1, transition: 'color 0.2s' }}>
                {lead.name}
              </p>
              <span className={lead.classification === 'CALIENTE' ? 'animate-pulse-warm' : ''}>
                <LeadBadge clasificacion={lead.classification} size="sm" />
              </span>
            </div>
            <p className="text-xs truncate" style={{ color: c.text2 }}>{lead.email}</p>
          </div>
        </div>

        {/* Extracto */}
        <p className="text-sm line-clamp-2 mb-4 leading-relaxed" style={{ color: c.text4, transition: 'color 0.2s' }}>
          {lead.message}
        </p>

        {/* Score */}
        <ScoreBar score={lead.score} />

        {/* Pie */}
        <div className="flex items-center justify-between mt-3 pt-3"
          style={{ borderTop: `1px solid ${c.divider}` }}>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: est.bg, color: est.color, border: `1px solid ${est.border}` }}>
            {status}
          </span>
          <span className="text-xs" style={{ color: c.text2 }}>
            {formatearFecha(lead.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}
