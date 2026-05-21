// Indicador segmentado de puntuación 1–10

interface Props {
  score: number | null;
  showLabel?: boolean;
}

function colorSegmento(index: number, score: number): string {
  if (index >= score) return 'bg-gray-100';
  if (score >= 8) return 'bg-emerald-500';
  if (score >= 5) return 'bg-amber-400';
  return 'bg-red-400';
}

function colorLabel(score: number): string {
  if (score >= 8) return 'text-emerald-700';
  if (score >= 5) return 'text-amber-700';
  return 'text-red-600';
}

export default function ScoreBar({ score, showLabel = true }: Props) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-gray-400">Sin puntuación</span>;
  }

  return (
    <div className="flex items-center gap-2.5 w-full">
      {/* 10 segmentos — cada uno representa 1 punto */}
      <div className="flex gap-0.5 flex-1">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${colorSegmento(i, score)}`}
          />
        ))}
      </div>

      {showLabel && (
        <span className={`text-sm font-bold tabular-nums shrink-0 ${colorLabel(score)}`}>
          {score}
          <span className="text-xs font-normal text-gray-400">/10</span>
        </span>
      )}
    </div>
  );
}
