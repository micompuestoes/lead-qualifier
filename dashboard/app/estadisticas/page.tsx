'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface Stats {
  total: number;
  este_mes: number;
  mes_anterior: number;
  por_estado: Record<string, number>;
  score_avg: number;
  calientes: number;
  tibios: number;
  frios: number;
  por_mes: { mes: string; total: number }[];
}

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE:  'Pendiente',
  CONTACTADO: 'Contactado',
  CERRADO:    'Cerrado',
  DESCARTADO: 'Descartado',
};
const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE:  '#c8a96e',
  CONTACTADO: '#6ea8c8',
  CERRADO:    '#6ec87a',
  DESCARTADO: '#c8796e',
};

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(200,169,110,0.12)' }}>
        <div className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs w-6 text-right" style={{ color: '#7a7468' }}>{value}</span>
    </div>
  );
}

export default function EstadisticasPage() {
  const { getToken } = useAuth();
  const { c } = useTheme();
  const [stats, setStats]       = useState<Stats | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const token = await getToken();
        const res = await fetch(`${BASE}/stats`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.status === 403) { setError('plan'); return; }
        if (!res.ok) throw new Error();
        setStats(await res.json());
      } catch {
        setError('general');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [getToken]); // eslint-disable-line react-hooks/exhaustive-deps

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgba(200,169,110,0.3)', borderTopColor: '#c8a96e' }} />
      </div>
    );
  }

  if (error === 'plan') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(200,169,110,0.12)' }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#c8a96e">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: c.text1 }}>Plan Agencia requerido</h2>
          <p className="text-sm mb-6" style={{ color: c.text2 }}>
            Las estadísticas avanzadas están disponibles en el plan Agencia.
          </p>
          <Link href="/pricing"
            className="inline-flex px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#c8a96e', color: '#1a1814' }}>
            Ver planes
          </Link>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const maxEstado = Math.max(...Object.values(stats.por_estado), 1);
  const maxMes    = Math.max(...stats.por_mes.map(m => m.total), 1);
  const variacion = stats.mes_anterior > 0
    ? Math.round(((stats.este_mes - stats.mes_anterior) / stats.mes_anterior) * 100)
    : null;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 style={{ color: c.text1 }}>Estadísticas</h1>
        <p className="text-sm mt-1" style={{ color: c.text2 }}>Resumen de la actividad de tu dashboard</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total leads',   value: stats.total,                sub: 'todos los tiempos' },
          {
            label: 'Este mes', value: stats.este_mes,
            sub: variacion !== null
              ? `${variacion >= 0 ? '+' : ''}${variacion}% vs mes anterior`
              : 'primer mes',
            subColor: variacion !== null ? (variacion >= 0 ? '#6ec87a' : '#c8796e') : undefined,
          },
          { label: 'Score medio',   value: stats.score_avg.toFixed(1), sub: 'sobre 10' },
          { label: 'Mes anterior',  value: stats.mes_anterior,         sub: 'leads' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl p-5 transition-all duration-200"
            style={{ background: c.card, border: c.cardBorder }}>
            <p className="text-xs font-medium mb-1" style={{ color: c.text2 }}>{kpi.label}</p>
            <p className="text-3xl font-bold" style={{ color: c.text1 }}>{kpi.value}</p>
            <p className="text-xs mt-1" style={{ color: kpi.subColor ?? c.text2 }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Por estado */}
        <div className="rounded-xl p-5 space-y-4 transition-all duration-200"
          style={{ background: c.card, border: c.cardBorder }}>
          <h2 className="text-sm font-semibold" style={{ color: c.text1 }}>Por estado</h2>
          <div className="space-y-3">
            {Object.entries(ESTADO_LABEL).map(([key, label]) => (
              <div key={key}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs" style={{ color: c.text2 }}>{label}</span>
                </div>
                <Bar value={stats.por_estado[key] ?? 0} max={maxEstado} color={ESTADO_COLOR[key]} />
              </div>
            ))}
          </div>
        </div>

        {/* Temperatura */}
        <div className="rounded-xl p-5 space-y-4 transition-all duration-200"
          style={{ background: c.card, border: c.cardBorder }}>
          <h2 className="text-sm font-semibold" style={{ color: c.text1 }}>Temperatura (score)</h2>
          <div className="space-y-4">
            {[
              { label: '🔥 Calientes', sub: 'score 7–10', value: stats.calientes, color: '#c8796e' },
              { label: '🌤 Tibios',    sub: 'score 4–6',  value: stats.tibios,    color: '#c8a96e' },
              { label: '❄️ Fríos',     sub: 'score 0–3',  value: stats.frios,     color: '#6ea8c8' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: c.text1 }}>{item.label}</span>
                  <span className="text-xs" style={{ color: c.text2 }}>{item.sub}</span>
                </div>
                <Bar value={item.value} max={stats.calientes + stats.tibios + stats.frios || 1} color={item.color} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tendencia mensual */}
      {stats.por_mes.length > 0 && (
        <div className="rounded-xl p-5 transition-all duration-200"
          style={{ background: c.card, border: c.cardBorder }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: c.text1 }}>Tendencia mensual</h2>
          <div className="flex items-end gap-3 h-32">
            {[...stats.por_mes].reverse().map(m => {
              const pct = Math.round((m.total / maxMes) * 100);
              const [año, mes] = m.mes.split('-');
              const label = new Date(parseInt(año), parseInt(mes) - 1)
                .toLocaleDateString('es-ES', { month: 'short' });
              return (
                <div key={m.mes} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs" style={{ color: c.text2 }}>{m.total}</span>
                  <div className="w-full rounded-t-md transition-all duration-700"
                    style={{ height: `${Math.max(pct, 4)}%`, background: '#c8a96e', opacity: 0.8 }} />
                  <span className="text-xs" style={{ color: c.text2 }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
