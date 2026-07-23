// Badge de clasificación — iconos SVG propios, paleta Inmonia
import type { Clasificacion } from '@/types/lead';

interface Props {
  clasificacion: Clasificacion | null;
  size?: 'sm' | 'md';
}

function IconoSenal({ nivel }: { nivel: 1 | 2 | 3 }) {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
      <rect x="0" y={nivel >= 1 ? 6 : 10} width="3" height={nivel >= 1 ? 6 : 2} rx="1" opacity={nivel >= 1 ? 1 : 0.3} />
      <rect x="5" y={nivel >= 2 ? 3 : 10} width="3" height={nivel >= 2 ? 9 : 2} rx="1" opacity={nivel >= 2 ? 1 : 0.3} />
      <rect x="10" y={nivel >= 3 ? 0 : 10} width="3" height={nivel >= 3 ? 12 : 2} rx="1" opacity={nivel >= 3 ? 1 : 0.3} />
    </svg>
  );
}

const config: Record<string, { nivel: 1 | 2 | 3; label: string; bg: string; color: string; border: string }> = {
  CALIENTE: { nivel: 3, label: 'Caliente', bg: 'rgba(180,83,9,0.08)',   color: '#b45309', border: 'rgba(180,83,9,0.2)'   },
  TIBIO:    { nivel: 2, label: 'Tibio',    bg: 'rgba(200,169,110,0.12)', color: '#9a7a3a', border: 'rgba(200,169,110,0.35)' },
  'FRÍO':   { nivel: 1, label: 'Frío',     bg: 'rgba(110,168,200,0.1)', color: '#3a7a9a', border: 'rgba(110,168,200,0.3)' },
};

export default function LeadBadge({ clasificacion, size = 'md' }: Props) {
  if (!clasificacion) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium"
        style={{ padding: '2px 8px', background: 'rgba(122,116,104,0.08)', color: '#7a7468', border: '1px solid rgba(122,116,104,0.2)' }}>
        Sin clasificar
      </span>
    );
  }

  const { nivel, label, bg, color, border } = config[clasificacion] ?? config['FRÍO'];
  const padding = size === 'sm' ? '2px 7px' : '3px 9px';

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md text-xs font-semibold tracking-wide uppercase"
      style={{ padding, background: bg, color, border: `1px solid ${border}` }}>
      <IconoSenal nivel={nivel} />
      {label}
    </span>
  );
}
