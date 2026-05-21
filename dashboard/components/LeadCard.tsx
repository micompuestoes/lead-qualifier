// Tarjeta de lead — animación staggered al cargar, pulse en CALIENTE

import Link from 'next/link';
import type { Lead, EstadoLead } from '@/types/lead';
import LeadBadge from './LeadBadge';
import ScoreBar from './ScoreBar';

interface Props {
  lead: Lead;
  index?: number; // posición en la lista, para el delay de entrada
}

const estadoEstilos: Record<EstadoLead, string> = {
  PENDIENTE:   'bg-yellow-50 text-yellow-700 border border-yellow-200',
  CONTACTADO:  'bg-blue-50 text-blue-700 border border-blue-200',
  CERRADO:     'bg-green-50 text-green-700 border border-green-200',
  DESCARTADO:  'bg-gray-100 text-gray-400 border border-gray-200',
};

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Círculo con las iniciales del nombre
function Iniciales({ name }: { name: string }) {
  const letras = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-gray-500 select-none">{letras}</span>
    </div>
  );
}

export default function LeadCard({ lead, index = 0 }: Props) {
  const status = lead.status ?? 'PENDIENTE';
  // Delay escalonado: 0ms, 80ms, 160ms...
  const delayMs = index * 80;

  return (
    <Link href={`/leads/${lead.id}`} className="block group">
      <div
        className="animate-fade-up bg-white border border-gray-200 rounded-xl p-5
          hover:border-blue-200 hover:shadow-md transition-all duration-150"
        style={{ animationDelay: `${delayMs}ms` }}
      >
        {/* Fila superior: avatar + nombre + badge */}
        <div className="flex items-start gap-3 mb-3">
          <Iniciales name={lead.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <p className="font-semibold text-gray-900 truncate text-sm group-hover:text-blue-600 transition-colors">
                {lead.name}
              </p>
              {/* Pulse muy sutil solo si el lead es CALIENTE */}
              <span className={lead.classification === 'CALIENTE' ? 'animate-pulse-warm' : ''}>
                <LeadBadge clasificacion={lead.classification} size="sm" />
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate">{lead.email}</p>
          </div>
        </div>

        {/* Extracto del mensaje */}
        <p className="text-sm text-gray-600 line-clamp-2 mb-4 leading-relaxed">
          {lead.message}
        </p>

        {/* Score */}
        <ScoreBar score={lead.score} />

        {/* Pie: estado + fecha */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoEstilos[status]}`}>
            {status}
          </span>
          <span className="text-xs text-gray-400">{formatearFecha(lead.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}
