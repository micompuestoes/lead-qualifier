'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { obtenerLeads } from '@/lib/api';
import type { Lead, Clasificacion, EstadoLead } from '@/types/lead';
import LeadCard from '@/components/LeadCard';
import { useTheme } from '@/components/ThemeProvider';

const CLASIFICACIONES: (Clasificacion | 'TODAS')[] = ['TODAS', 'CALIENTE', 'TIBIO', 'FRÍO'];
const ESTADOS: (EstadoLead | 'TODOS')[] = ['TODOS', 'PENDIENTE', 'CONTACTADO', 'CERRADO', 'DESCARTADO'];

export default function LeadsPage() {
  const { getToken } = useAuth();
  const { c } = useTheme();

  const [leads, setLeads]         = useState<Lead[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [filtroClasif, setFiltroClasif] = useState<Clasificacion | 'TODAS'>('TODAS');
  const [filtroEstado, setFiltroEstado] = useState<EstadoLead | 'TODOS'>('TODOS');

  const idsConocidos = useRef<Set<string>>(new Set());
  const pendingLeads = useRef<Lead[]>([]);
  const [leadsNuevos, setLeadsNuevos] = useState(0);

  useEffect(() => { cargarLeads(); }, []);

  useEffect(() => {
    if (!cargando && leads.length > 0 && idsConocidos.current.size === 0)
      idsConocidos.current = new Set(leads.map(l => l.id));
  }, [cargando, leads]);

  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const data = await obtenerLeads(getToken);
        const nuevos = data.filter(l => !idsConocidos.current.has(l.id));
        if (nuevos.length > 0) { pendingLeads.current = data; setLeadsNuevos(nuevos.length); }
      } catch { /* silencioso */ }
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  async function cargarLeads() {
    try {
      setCargando(true); setError(null);
      const data = await obtenerLeads(getToken);
      setLeads(data);
      idsConocidos.current = new Set(data.map(l => l.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar leads');
    } finally { setCargando(false); }
  }

  function aplicarLeadsNuevos() {
    if (pendingLeads.current.length > 0) {
      setLeads(pendingLeads.current);
      idsConocidos.current = new Set(pendingLeads.current.map(l => l.id));
      pendingLeads.current = [];
    }
    setLeadsNuevos(0);
  }

  const leadsFiltrados = leads.filter(l => {
    const pasaClasif = filtroClasif === 'TODAS' || l.classification === filtroClasif;
    const pasaEstado = filtroEstado === 'TODOS' || (l.status ?? 'PENDIENTE') === filtroEstado;
    return pasaClasif && pasaEstado;
  });

  const calientes  = leads.filter(l => l.classification === 'CALIENTE').length;
  const tibios     = leads.filter(l => l.classification === 'TIBIO').length;
  const frios      = leads.filter(l => l.classification === 'FRÍO').length;
  const total      = leads.length;
  const hayFiltros = filtroClasif !== 'TODAS' || filtroEstado !== 'TODOS';

  return (
    <div className="p-8">

      {/* Banner nuevos leads */}
      {leadsNuevos > 0 && (
        <button onClick={aplicarLeadsNuevos}
          className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold animate-fade-up"
          style={{ background: '#c8a96e', color: '#1a1814', border: 'none', cursor: 'pointer' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {leadsNuevos === 1 ? '1 lead nuevo — haz clic para actualizar' : `${leadsNuevos} leads nuevos — haz clic para actualizar`}
        </button>
      )}

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ color: c.text1 }}>Leads</h1>
          <p className="text-sm mt-0.5" style={{ color: c.text2 }}>
            {total > 0 ? `${total} leads en total` : 'Sin leads todavía'}
          </p>
        </div>
        <Link href="/nuevo-lead"
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
          style={{ background: '#c8a96e', color: '#1a1814', textDecoration: 'none' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo lead
        </Link>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricaCard label="Calientes" valor={calientes} total={total} nivel={3}
          color="#b45309" bgColor="rgba(180,83,9,0.08)" barColor="rgba(180,83,9,0.5)" c={c} />
        <MetricaCard label="Tibios"    valor={tibios}    total={total} nivel={2}
          color="#9a7a3a" bgColor="rgba(200,169,110,0.1)" barColor="#c8a96e" c={c} />
        <MetricaCard label="Fríos"     valor={frios}     total={total} nivel={1}
          color="#3a7a9a" bgColor="rgba(110,168,200,0.08)" barColor="rgba(110,168,200,0.6)" c={c} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-6 mb-6">
        {[
          { title: 'Clasificación', opciones: CLASIFICACIONES, valor: filtroClasif, setter: setFiltroClasif },
          { title: 'Estado',        opciones: ESTADOS,         valor: filtroEstado, setter: setFiltroEstado },
        ].map(({ title, opciones, valor, setter }) => (
          <div key={title}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: c.text2, letterSpacing: '0.08em' }}>
              {title}
            </p>
            <div className="flex gap-1.5">
              {opciones.map(o => {
                const activo = valor === o;
                return (
                  <button key={o}
                    onClick={() => (setter as (v: typeof o) => void)(o)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: activo ? c.btnActive    : c.btnInactive,
                      color:      activo ? c.btnActiveTxt : c.btnInactiveTxt,
                      border:     activo ? 'none'         : `1px solid ${c.btnInactiveBorder}`,
                      transition: 'background 0.15s, color 0.15s',
                    }}>
                    {o}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Contenido */}
      {cargando ? (
        <div className="flex items-center justify-center py-24 flex-col gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgba(200,169,110,0.3)', borderTopColor: '#c8a96e' }} />
          <p className="text-sm" style={{ color: c.text2 }}>Cargando leads…</p>
        </div>
      ) : error ? (
        <div className="rounded-xl p-6 text-center"
          style={{ background: 'rgba(180,83,9,0.05)', border: '1px solid rgba(180,83,9,0.15)' }}>
          <p className="font-medium mb-2" style={{ color: '#b45309' }}>No se pudieron cargar los leads</p>
          <p className="text-sm mb-4" style={{ color: c.text2 }}>{error}</p>
          <button onClick={cargarLeads} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#c8a96e', color: '#1a1814', border: 'none', cursor: 'pointer' }}>
            Reintentar
          </button>
        </div>
      ) : leadsFiltrados.length === 0 ? (
        <EmptyState sinLeads={total === 0} c={c}
          onLimpiarFiltros={hayFiltros ? () => { setFiltroClasif('TODAS'); setFiltroEstado('TODOS'); } : undefined} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {leadsFiltrados.map((lead, i) => <LeadCard key={lead.id} lead={lead} index={i} />)}
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ sinLeads, onLimpiarFiltros, c }: {
  sinLeads: boolean;
  onLimpiarFiltros?: () => void;
  c: ReturnType<typeof useTheme>['c'];
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center animate-fade-up">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: 'rgba(200,169,110,0.1)' }}>
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="rgba(200,169,110,0.6)">
          {sinLeads ? (
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
          )}
        </svg>
      </div>
      <h2 className="text-lg font-semibold mb-2" style={{ color: c.text1 }}>
        {sinLeads ? 'Aún no hay leads aquí' : 'Ningún lead coincide con los filtros'}
      </h2>
      <p className="text-sm mb-8 max-w-sm leading-relaxed" style={{ color: c.text2 }}>
        {sinLeads
          ? 'Cualifica tu primer lead y aparecerá aquí con su clasificación y email generado por la IA.'
          : 'Prueba a cambiar o limpiar los filtros activos para ver más resultados.'}
      </p>
      {sinLeads ? (
        <Link href="/nuevo-lead"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
          style={{ background: '#c8a96e', color: '#1a1814', textDecoration: 'none' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Cualificar primer lead
        </Link>
      ) : (
        <button onClick={onLimpiarFiltros}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
          style={{ background: c.btnActive, color: c.btnActiveTxt, border: 'none', cursor: 'pointer' }}>
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

// ── Métrica card ──────────────────────────────────────────────────────────────

function MetricaCard({ label, valor, total, nivel, color, bgColor, barColor, c }: {
  label: string; valor: number; total: number; nivel: 1 | 2 | 3;
  color: string; bgColor: string; barColor: string;
  c: ReturnType<typeof useTheme>['c'];
}) {
  const porcentaje = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="rounded-xl px-5 py-4 transition-all duration-200"
      style={{ background: c.card, border: c.cardBorder }}>
      <div className="flex items-center gap-4 mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: bgColor }}>
          <svg style={{ color }} width="20" height="16" viewBox="0 0 20 16" fill="currentColor">
            <rect x="0"  y={nivel >= 1 ? 8  : 13} width="4" height={nivel >= 1 ? 8  : 3} rx="1" opacity={nivel >= 1 ? 1 : 0.25} />
            <rect x="8"  y={nivel >= 2 ? 4  : 13} width="4" height={nivel >= 2 ? 12 : 3} rx="1" opacity={nivel >= 2 ? 1 : 0.25} />
            <rect x="16" y={nivel >= 3 ? 0  : 13} width="4" height={nivel >= 3 ? 16 : 3} rx="1" opacity={nivel >= 3 ? 1 : 0.25} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm" style={{ color: c.text2 }}>{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold" style={{ color }}>
              {total === 0 ? '—' : valor}
            </p>
            {total > 0 && <span className="text-xs" style={{ color: c.text2 }}>{porcentaje}%</span>}
          </div>
        </div>
      </div>
      <div className="h-1 rounded-full" style={{ background: 'rgba(200,169,110,0.1)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${porcentaje}%`, background: barColor }} />
      </div>
    </div>
  );
}
