// Tarjeta de lead — animación staggered, paleta Inmobia

import Link from 'next/link';
import type { Lead, EstadoLead } from '@/types/lead';
import LeadBadge from './LeadBadge';
import ScoreBar from './ScoreBar';

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
    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
      style={{ background: 'rgba(200,169,110,0.15)' }}>
      <span className="text-xs font-bold select-none" style={{ color: '#9a7a3a' }}>{letras}</span>
    </div>
  );
}

export default function LeadCard({ lead, index = 0 }: Props) {
  const status = (lead.status ?? 'PENDIENTE') as EstadoLead;
  const delayMs = index * 60;
  const est = estadoEstilos[status];

  return (
    <Link href={`/leads/${lead.id}`} className="block group">
      <div
        className="animate-fade-up rounded-xl p-5 transition-all duration-200"
        style={{
          background: '#fff',
          border: '1.5px solid rgba(200,169,110,0.18)',
          animationDelay: `${delayMs}ms`,
          boxShadow: '0 1px 4px rgba(26,24,20,0.04)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,169,110,0.5)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(200,169,110,0.12)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,169,110,0.18)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(26,24,20,0.04)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        }}
      >
        {/* Avatar + nombre + badge */}
        <div className="flex items-start gap-3 mb-3">
          <Iniciales name={lead.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <p className="font-semibold truncate text-sm transition-colors"
                style={{ color: '#1a1814' }}>
                {lead.name}
              </p>
              <span className={lead.classification === 'CALIENTE' ? 'animate-pulse-warm' : ''}>
                <LeadBadge clasificacion={lead.classification} size="sm" />
              </span>
            </div>
            <p className="text-xs truncate" style={{ color: '#7a7468' }}>{lead.email}</p>
          </div>
        </div>

        {/* Extracto del mensaje */}
        <p className="text-sm line-clamp-2 mb-4 leading-relaxed" style={{ color: '#4a4540' }}>
          {lead.message}
        </p>

        {/* Score */}
        <ScoreBar score={lead.score} />

        {/* Pie: estado + fecha */}
        <div className="flex items-center justify-between mt-3 pt-3"
          style={{ borderTop: '1px solid rgba(200,169,110,0.12)' }}>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: est.bg, color: est.color, border: `1px solid ${est.border}` }}>
            {status}
          </span>
          <span className="text-xs" style={{ color: '#7a7468' }}>{formatearFecha(lead.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}
