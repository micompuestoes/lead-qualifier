// Barra de progreso visual para la puntuación 1-10 del lead

interface Props {
  score: number | null;
  showLabel?: boolean;
}

// Color de la barra según el valor del score
function colorPorScore(score: number): string {
  if (score >= 8) return 'bg-green-500';
  if (score >= 5) return 'bg-yellow-400';
  return 'bg-red-400';
}

function colorTexto(score: number): string {
  if (score >= 8) return 'text-green-700';
  if (score >= 5) return 'text-yellow-700';
  return 'text-red-700';
}

export default function ScoreBar({ score, showLabel = true }: Props) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-gray-400">Sin puntuación</span>;
  }

  const porcentaje = (score / 10) * 100;
  const barColor = colorPorScore(score);
  const textColor = colorTexto(score);

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Barra de progreso */}
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      {/* Número */}
      {showLabel && (
        <span className={`text-sm font-bold tabular-nums ${textColor} min-w-[2.5rem] text-right`}>
          {score}/10
        </span>
      )}
    </div>
  );
}
