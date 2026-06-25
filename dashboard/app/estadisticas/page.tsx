'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { obtenerLeads } from '@/lib/api';
import type { Lead, AgenteRanking } from '@/types/lead';
import { useTheme } from '@/components/ThemeProvider';
import PageHeader from '@/components/PageHeader';
import { TEMP } from '@/lib/temperature';

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

const ESTADO_META: Record<string, { label: string; color: string }> = {
  PENDIENTE:  { label: 'Pendiente',  color: '#c8a96e' },
  CONTACTADO: { label: 'Contactado', color: '#6ea8c8' },
  CERRADO:    { label: 'Cerrado',    color: '#6ec87a' },
  DESCARTADO: { label: 'Descartado', color: '#9a9490' },
};

// ── SVG icons ─────────────────────────────────────────────────────────────────

function IconFlame({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        fill={color} fillOpacity="0.9"
      />
    </svg>
  );
}

function IconThermometer({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
    </svg>
  );
}

function IconSnowflake({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.75" strokeLinecap="round">
      <line x1="12" y1="2"  x2="12" y2="22"/>
      <line x1="2"  y1="12" x2="22" y2="12"/>
      <line x1="12" y1="2"  x2="9"  y2="5"/><line x1="12" y1="2"  x2="15" y2="5"/>
      <line x1="12" y1="22" x2="9"  y2="19"/><line x1="12" y1="22" x2="15" y2="19"/>
      <line x1="2"  y1="12" x2="5"  y2="9"/><line x1="2"  y1="12" x2="5"  y2="15"/>
      <line x1="22" y1="12" x2="19" y2="9"/><line x1="22" y1="12" x2="19" y2="15"/>
    </svg>
  );
}

function IconUsers({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="#c8a96e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function IconCalendar({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="#c8a96e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8"  y1="2" x2="8"  y2="6"/>
      <line x1="3"  y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function IconStar({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="#c8a96e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

function IconTrend({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="#c8a96e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  );
}

// ── Loading / gate ─────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'rgba(200,169,110,0.3)', borderTopColor: '#c8a96e' }} />
    </div>
  );
}

function PlanGate({ c }: { c: ReturnType<typeof useTheme>['c'] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 360, padding: '0 24px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: '0 auto 20px',
          background: 'rgba(200,169,110,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="#c8a96e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: c.text1, marginBottom: 8 }}>
          Plan Agencia requerido
        </h2>
        <p style={{ fontSize: 14, color: c.text2, marginBottom: 24, lineHeight: 1.6 }}>
          Las estadísticas avanzadas están disponibles en el plan Agencia.
        </p>
        <Link href="/pricing" style={{
          display: 'inline-flex', padding: '10px 22px', borderRadius: 12,
          fontSize: 14, fontWeight: 600, textDecoration: 'none',
          background: '#c8a96e', color: '#1a1814',
          boxShadow: '0 2px 12px rgba(200,169,110,0.35)',
        }}>
          Ver planes
        </Link>
      </div>
    </div>
  );
}

// ── Calendario de actividad (heatmap estilo GitHub) ─────────────────────────────

const WEEKS = 22;
const NIVEL_COLOR = [
  'rgba(200,169,110,0.10)',  // 0
  'rgba(200,169,110,0.32)',  // 1
  'rgba(200,169,110,0.52)',  // 2
  'rgba(200,169,110,0.74)',  // 3
  '#c8a96e',                  // 4+
];
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function nivel(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n <= 2) return 2;
  if (n <= 4) return 3;
  return 4;
}

function CalendarHeatmap({ leads, c }: { leads: Lead[]; c: ReturnType<typeof useTheme>['c'] }) {
  // Conteo por día
  const counts = new Map<string, number>();
  for (const l of leads) {
    if (!l.created_at) continue;
    const k = ymd(new Date(l.created_at));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dowHoy = (hoy.getDay() + 6) % 7;                 // Lunes = 0
  const lunesActual = new Date(hoy); lunesActual.setDate(hoy.getDate() - dowHoy);
  const primerLunes = new Date(lunesActual); primerLunes.setDate(lunesActual.getDate() - (WEEKS - 1) * 7);

  interface Celda { date: Date; key: string; count: number; future: boolean }
  const semanas: Celda[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const dias: Celda[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(primerLunes);
      date.setDate(primerLunes.getDate() + w * 7 + d);
      const key = ymd(date);
      dias.push({ date, key, count: counts.get(key) ?? 0, future: date > hoy });
    }
    semanas.push(dias);
  }

  // Stats del periodo
  let totalPeriodo = 0;
  let mejorDia: Celda | null = null;
  for (const sem of semanas) for (const c2 of sem) {
    if (c2.future) continue;
    totalPeriodo += c2.count;
    if (!mejorDia || c2.count > mejorDia.count) mejorDia = c2;
  }

  // Etiquetas de mes (cuando cambia el mes respecto a la semana anterior)
  const etiquetasMes = semanas.map((sem, i) => {
    const mes = sem[0].date.getMonth();
    const prevMes = i > 0 ? semanas[i - 1][0].date.getMonth() : -1;
    return mes !== prevMes
      ? sem[0].date.toLocaleDateString('es-ES', { month: 'short' })
      : '';
  });

  const CELL = 14, GAP = 4;

  return (
    <div style={{ background: c.card, border: c.cardBorder, borderRadius: 16, padding: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.text2, marginBottom: 18 }}>
        Actividad de leads
      </p>

      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Heatmap */}
        <div style={{ display: 'flex', gap: 6 }}>
          {/* Etiquetas de día */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, paddingTop: 18 }}>
            {DIAS.map((d, i) => (
              <span key={i} style={{
                height: CELL, fontSize: 9, lineHeight: `${CELL}px`,
                color: c.text3, width: 12, textAlign: 'center',
                opacity: i % 2 === 0 ? 1 : 0,   // alterna para no saturar
              }}>{d}</span>
            ))}
          </div>

          {/* Columnas (semanas) */}
          <div>
            {/* Meses */}
            <div style={{ display: 'flex', gap: GAP, height: 18 }}>
              {etiquetasMes.map((m, i) => (
                <span key={i} style={{ width: CELL, fontSize: 9, color: c.text2, whiteSpace: 'nowrap', overflow: 'visible' }}>
                  {m}
                </span>
              ))}
            </div>
            {/* Celdas */}
            <div style={{ display: 'flex', gap: GAP }}>
              {semanas.map((sem, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                  {sem.map((cel) => (
                    <div
                      key={cel.key}
                      title={cel.future ? '' : `${cel.count} ${cel.count === 1 ? 'lead' : 'leads'} · ${cel.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                      style={{
                        width: CELL, height: CELL, borderRadius: 3,
                        background: cel.future ? 'transparent' : NIVEL_COLOR[nivel(cel.count)],
                        border: cel.future ? 'none' : `1px solid ${c.bg === '#0f0e0b' ? 'rgba(255,255,255,0.02)' : 'rgba(26,24,20,0.03)'}`,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel lateral de resumen */}
        <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 4 }}>
          <div>
            <p style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: c.text1 }}>{totalPeriodo}</p>
            <p style={{ fontSize: 12, color: c.text2, marginTop: 4 }}>leads en los últimos {Math.round(WEEKS / 4.345)} meses</p>
          </div>
          {mejorDia && mejorDia.count > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.text2, marginBottom: 4 }}>
                Día más activo
              </p>
              <p style={{ fontSize: 14, color: c.text1 }}>
                {mejorDia.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                <span style={{ color: '#9a7a3a', fontWeight: 600 }}> · {mejorDia.count} leads</span>
              </p>
            </div>
          )}
          {/* Leyenda */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 'auto' }}>
            <span style={{ fontSize: 10, color: c.text3 }}>menos</span>
            {NIVEL_COLOR.map((col, i) => (
              <span key={i} style={{ width: 11, height: 11, borderRadius: 3, background: col }} />
            ))}
            <span style={{ fontSize: 10, color: c.text3 }}>más</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function EstadisticasPage() {
  const { getToken } = useAuth();
  const { c } = useTheme();
  const [stats, setStats]       = useState<Stats | null>(null);
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [agentes, setAgentes]   = useState<AgenteRanking[]>([]);
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
        // Leads para el calendario de actividad (no crítico para el render)
        obtenerLeads(getToken).then(setLeads).catch(() => {});
        // Ranking de agentes (no crítico)
        fetch(`${BASE}/stats/agents`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
          .then(r => (r.ok ? r.json() : null))
          .then(d => { if (d) setAgentes(d.agents ?? []); })
          .catch(() => {});
      } catch {
        setError('general');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [getToken]); // eslint-disable-line react-hooks/exhaustive-deps

  if (cargando) return <LoadingScreen />;
  if (error === 'plan') return <PlanGate c={c} />;
  if (!stats) return null;

  const totalTemp  = stats.calientes + stats.tibios + stats.frios;
  const maxEstado  = Math.max(...Object.values(stats.por_estado), 1);
  const variacion  = stats.mes_anterior > 0
    ? Math.round(((stats.este_mes - stats.mes_anterior) / stats.mes_anterior) * 100)
    : null;

  const kpis = [
    {
      label: 'Total leads',
      value: stats.total,
      sub: 'todos los tiempos',
      subColor: c.text2,
      Icon: <IconUsers />,
    },
    {
      label: 'Este mes',
      value: stats.este_mes,
      sub: variacion !== null
        ? `${variacion >= 0 ? '+' : ''}${variacion}% vs mes anterior`
        : 'primer mes',
      subColor: variacion !== null
        ? (variacion >= 0 ? '#6ec87a' : '#ef4444')
        : c.text2,
      Icon: <IconCalendar />,
    },
    {
      label: 'Score medio',
      value: stats.score_avg.toFixed(1),
      sub: 'sobre 10',
      subColor: c.text2,
      Icon: <IconStar />,
    },
    {
      label: 'Mes anterior',
      value: stats.mes_anterior,
      sub: 'leads registrados',
      subColor: c.text2,
      Icon: <IconTrend />,
    },
  ];

  const cardStyle = {
    background: c.card,
    border: c.cardBorder,
    borderRadius: 16,
    padding: 20,
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: c.text2,
    marginBottom: 16,
  };

  return (
    <div className="r-pad" style={{ padding: 32, maxWidth: 960, margin: '0 auto' }}>

      <PageHeader
        eyebrow="Análisis"
        title="Estadísticas"
        description="Resumen de la actividad de tu cartera de leads"
      />

      {/* ── KPIs ── */}
      <div className="r-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: c.text2 }}>
                {kpi.label}
              </p>
              <div style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: 'rgba(200,169,110,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {kpi.Icon}
              </div>
            </div>
            <p style={{ fontSize: 38, fontWeight: 700, lineHeight: 1, color: c.text1, marginBottom: 6 }}>
              {kpi.value}
            </p>
            <p style={{ fontSize: 12, color: kpi.subColor }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Estado + Temperatura ── */}
      <div className="r-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Por estado */}
        <div style={cardStyle}>
          <p style={sectionLabel}>Por estado</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {Object.entries(ESTADO_META).map(([key, meta]) => {
              const value = stats.por_estado[key] ?? 0;
              const pct      = maxEstado > 0 ? Math.round((value / maxEstado) * 100) : 0;
              const pctTotal = stats.total > 0  ? Math.round((value / stats.total) * 100) : 0;
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: meta.color, flexShrink: 0, display: 'inline-block',
                      }} />
                      <span style={{ fontSize: 13, color: c.text1 }}>{meta.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: c.text2 }}>{pctTotal}%</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: c.text1, minWidth: 20, textAlign: 'right' }}>
                        {value}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, overflow: 'hidden', background: 'rgba(200,169,110,0.08)' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${pct}%`, background: meta.color,
                      transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Temperatura */}
        <div style={cardStyle}>
          <p style={sectionLabel}>Temperatura de leads</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { Icon: IconFlame,       label: TEMP.calientes.label, sub: TEMP.calientes.rango, value: stats.calientes, color: TEMP.calientes.color },
              { Icon: IconThermometer, label: TEMP.tibios.label,    sub: TEMP.tibios.rango,    value: stats.tibios,    color: TEMP.tibios.color },
              { Icon: IconSnowflake,   label: TEMP.frios.label,     sub: TEMP.frios.rango,     value: stats.frios,     color: TEMP.frios.color },
            ].map(item => {
              const pct = totalTemp > 0 ? Math.round((item.value / totalTemp) * 100) : 0;
              return (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                    background: `${item.color}16`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <item.Icon color={item.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: c.text1 }}>{item.label}</span>
                        <span style={{ fontSize: 11, color: c.text2, marginLeft: 7 }}>{item.sub}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: item.color }}>
                          {item.value}
                        </span>
                        <span style={{ fontSize: 11, color: c.text2 }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, overflow: 'hidden', background: 'rgba(200,169,110,0.08)' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${pct}%`, background: item.color, opacity: 0.75,
                        transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Ranking de agentes (solo agencias con equipo) ── */}
      {agentes.length > 1 && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <p style={sectionLabel}>Rendimiento por agente</p>

          <div className="r-scroll-x">
           <div className="r-table">
          {/* Cabecera */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1.7fr repeat(4, 1fr)', gap: 8,
            padding: '0 10px 10px', borderBottom: `1px solid ${c.divider}`,
          }}>
            <span style={{ fontSize: 11, color: c.text2 }}>Agente</span>
            {['Leads', 'Calientes', 'Cerrados', 'Score'].map(h => (
              <span key={h} style={{ fontSize: 11, color: c.text2, textAlign: 'right' }}>{h}</span>
            ))}
          </div>

          {/* Filas */}
          {agentes.map((a, i) => {
            const medalla = ['#d4af37', '#aab1b8', '#cd7f32'][i];   // oro / plata / bronce
            return (
              <div key={a.agent_id} style={{
                display: 'grid', gridTemplateColumns: '1.7fr repeat(4, 1fr)', gap: 8,
                padding: '12px 10px', alignItems: 'center',
                borderBottom: i < agentes.length - 1 ? `1px solid ${c.divider}` : 'none',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: medalla ? `${medalla}26` : 'rgba(200,169,110,0.10)',
                    color: medalla ?? c.text2,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 13.5, color: c.text1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name}
                  </span>
                </span>
                <span style={{ fontSize: 14, color: c.text1, textAlign: 'right', fontWeight: 600 }}>{a.total}</span>
                <span style={{ fontSize: 14, color: '#c8796e', textAlign: 'right' }}>{a.calientes}</span>
                <span style={{ fontSize: 14, color: '#2d7a3a', textAlign: 'right', fontWeight: 700 }}>{a.cerrados}</span>
                <span style={{ fontSize: 14, color: c.text2, textAlign: 'right' }}>{a.score_avg || '—'}</span>
              </div>
            );
          })}
           </div>
          </div>
        </div>
      )}

      {/* ── Calendario de actividad ── */}
      <CalendarHeatmap leads={leads} c={c} />
    </div>
  );
}
