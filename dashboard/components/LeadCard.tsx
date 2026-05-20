// Tarjeta de lead para la lista — muestra resumen y enlaza al detalle

import Link from 'next/link';
import type { Lead, EstadoLead } from '@/types/lead';
import LeadBadge from './LeadBadge';
import ScoreBar from './ScoreBar';

interface Props {
  lead: Lead;
}

// Colores del badge de estado
const estadoEstilos: Record<EstadoLead, string> = {
  PENDIENTE:   'bg-yellow-50 text-yellow-700 border border-yellow-200',
  CONTACTADO:  'bg-blue-50 text-blue-700 border border-blue-200',
  CERRADO:     'bg-green-50 text-green-700 border border-green-200',
  DESCARTADO:  'bg-gray-100 text-gray-500 border border-gray-200',
};

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LeadCard({ lead }: Props) {
  const status = lead.status ?? 'PENDIENTE';

  return (
    <Link href={`/leads/${lead.id}`} className="block group">
      <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all duration-150">
        {/* Fila superior: nombre + badges */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
              {lead.name}
            </p>
            <p className="text-sm text-gray-500 truncate">{lead.email}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LeadBadge clasificacion={lead.classification} size="sm" />
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoEstilos[status]}`}>
              {status}
            </span>
          </div>
        </div>

        {/* Mensaje resumido */}
        <p className="text-sm text-gray-600 line-clamp-2 mb-4">
          {lead.message}
        </p>

        {/* Score y fecha */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <ScoreBar score={lead.score} />
          </div>
          <span className="text-xs text-gray-400 shrink-0">
            {formatearFecha(lead.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}
