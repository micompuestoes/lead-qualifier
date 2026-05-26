// Indicador segmentado de puntuación 1–10 — paleta Inmobia

interface Props {
  score: number | null;
  showLabel?: boolean;
}

function getSegmentColor(index: number, score: number): string {
  if (index >= score) return 'rgba(200,169,110,0.1)';
  if (score >= 8)     return '#2d7a3a';   // verde cálido
  if (score >= 5)     return '#9a7a3a';   // dorado tierra
  return '#b45309';                        // terracota
}

function getLabelColor(score: number): string {
  if (score >= 8) return '#2d7a3a';
  if (score >= 5) return '#9a7a3a';
  return '#b45309';
}

function getLabel(score: number): string {
  if (score >= 8) return 'Alto';
  if (score >= 5) return 'Medio';
  return 'Bajo';
}

export default function ScoreBar({ score, showLabel = true }: Props) {
  if (score === null || score === undefined) {
    return (
      <span className="text-xs" style={{ color: '#7a7468' }}>
        Sin puntuación
      </span>
    );
  }

  const labelColor = getLabelColor(score);

  return (
    <div className="flex items-center gap-2.5 w-full">
      {/* 10 segmentos */}
      <div className="flex gap-0.5 flex-1">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-all duration-500"
            style={{ background: getSegmentColor(i, score) }}
          />
        ))}
      </div>

      {showLabel && (
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="text-sm font-bold tabular-nums" style={{ color: labelColor }}>
            {score}
          </span>
          <span className="text-xs font-normal" style={{ color: 'rgba(122,116,104,0.6)' }}>
            /10
          </span>
        </div>
      )}
    </div>
  );
}
