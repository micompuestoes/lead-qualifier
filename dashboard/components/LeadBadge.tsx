// Badge de clasificación — iconos SVG propios, sin emojis
import type { Clasificacion } from '@/types/lead';

interface Props {
  clasificacion: Clasificacion | null;
  size?: 'sm' | 'md';
}

// Icono de señal de tres barras — más llenas = más caliente
function IconoSenal({ nivel }: { nivel: 1 | 2 | 3 }) {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
      <rect x="0" y={nivel >= 1 ? 6 : 10} width="3" height={nivel >= 1 ? 6 : 2} rx="1" opacity={nivel >= 1 ? 1 : 0.25} />
      <rect x="5" y={nivel >= 2 ? 3 : 10} width="3" height={nivel >= 2 ? 9 : 2} rx="1" opacity={nivel >= 2 ? 1 : 0.25} />
      <rect x="10" y={nivel >= 3 ? 0 : 10} width="3" height={nivel >= 3 ? 12 : 2} rx="1" opacity={nivel >= 3 ? 1 : 0.25} />
    </svg>
  );
}

const config: Record<string, {
  nivel: 1 | 2 | 3;
  label: string;
  clases: string;
}> = {
  CALIENTE: { nivel: 3, label: 'Caliente', clases: 'bg-red-50 text-red-700 border border-red-200' },
  TIBIO:    { nivel: 2, label: 'Tibio',    clases: 'bg-amber-50 text-amber-700 border border-amber-200' },
  'FRÍO':   { nivel: 1, label: 'Frío',     clases: 'bg-blue-50 text-blue-700 border border-blue-200' },
};

export default function LeadBadge({ clasificacion, size = 'md' }: Props) {
  if (!clasificacion) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200">
        Sin clasificar
      </span>
    );
  }

  const { nivel, label, clases } = config[clasificacion] ?? config['FRÍO'];
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md font-semibold tracking-wide uppercase ${clases} ${padding}`}>
      <IconoSenal nivel={nivel} />
      {label}
    </span>
  );
}
