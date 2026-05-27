'use client';

import { useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';

interface Props {
  acciones: string[];
}

export default function AccionesRecomendadas({ acciones }: Props) {
  const { c } = useTheme();
  const [hechas, setHechas] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setHechas(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="rounded-2xl p-6 mb-6" style={{ background: c.card, border: c.cardBorder }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: c.text2 }}>
        Próximos pasos recomendados
      </p>
      <ul className="space-y-3">
        {acciones.map((accion, i) => {
          const hecha = hechas.has(i);
          return (
            <li key={i}>
              <button onClick={() => toggle(i)} className="flex items-start gap-3 w-full text-left group">
                {/* Checkbox */}
                <span
                  className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
                  style={{
                    background:  hecha ? '#c8a96e' : 'transparent',
                    borderColor: hecha ? '#c8a96e' : 'rgba(200,169,110,0.4)',
                  }}
                >
                  {hecha && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="#1a1814">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </span>
                {/* Texto */}
                <span
                  className="text-sm leading-relaxed transition-all"
                  style={{
                    color:          hecha ? c.text2 : c.text1,
                    textDecoration: hecha ? 'line-through' : 'none',
                  }}
                >
                  {accion}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
