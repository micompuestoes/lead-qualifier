// Badge de clasificación con color semántico: CALIENTE / TIBIO / FRÍO
import type { Clasificacion } from '@/types/lead';

interface Props {
  clasificacion: Clasificacion | null;
  size?: 'sm' | 'md';
}

const estilos: Record<string, string> = {
  CALIENTE: 'bg-red-100 text-red-700 border border-red-200',
  TIBIO:    'bg-orange-100 text-orange-700 border border-orange-200',
  'FRÍO':   'bg-blue-100 text-blue-700 border border-blue-200',
};

const emojis: Record<string, string> = {
  CALIENTE: '🔥',
  TIBIO:    '🌡️',
  'FRÍO':   '❄️',
};

export default function LeadBadge({ clasificacion, size = 'md' }: Props) {
  if (!clasificacion) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        Sin clasificar
      </span>
    );
  }

  const base = estilos[clasificacion] ?? 'bg-gray-100 text-gray-600';
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${base} ${padding}`}>
      <span>{emojis[clasificacion]}</span>
      {clasificacion}
    </span>
  );
}
