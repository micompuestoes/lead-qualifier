'use client';

// Lista de leads con filtros, polling cada 30s, métricas con porcentaje y empty states

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { obtenerLeads } from '@/lib/api';
import type { Lead, Clasificacion, EstadoLead } from '@/types/lead';
import LeadCard from '@/components/LeadCard';

const CLASIFICACIONES: (Clasificacion | 'TODAS')[] = ['TODAS', 'CALIENTE', 'TIBIO', 'FRÍO'];
const ESTADOS: (EstadoLead | 'TODOS')[] = ['TODOS', 'PENDIENTE', 'CONTACTADO', 'CERRADO', 'DESCARTADO'];

export default function LeadsPage() {
  const { getToken } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroClasif, setFiltroClasif] = useState<Clasificacion | 'TODAS'>('TODAS');
  const [filtroEstado, setFiltroEstado] = useState<EstadoLead | 'TODOS'>('TODOS');

  // Polling — detecta leads nuevos sin molestar al usuario
  const idsConocidos = useRef<Set<string>>(new Set());
  const pendingLeads = useRef<Lead[]>([]);
  const [leadsNuevos, setLeadsNuevos] = useState(0);

  useEffect(() => {
    cargarLeads();
  }, []);

  // Inicializa los IDs conocidos cuando se cargan los leads por primera vez
  useEffect(() => {
    if (!cargando && leads.length > 0 && idsConocidos.current.size === 0) {
      idsConocidos.current = new Set(leads.map((l) => l.id));
    }
  }, [cargando, leads]);

  // Polling cada 30 segundos
  useEffect(() => {
    const intervalo = setInterval(async () => {
      try {
        const data = await obtenerLeads(getToken);
        const nuevos = data.filter((l) => !idsConocidos.current.has(l.id));
        if (nuevos.length > 0) {
          pendingLeads.current = data;
          setLeadsNuevos(nuevos.length);
        }
      } catch {
        // silencioso — no interrumpir al usuario si el poll falla
      }
    }, 30_000);
    return () => clearInterval(intervalo);
  }, []);

  async function cargarLeads() {
    try {
      setCargando(true);
      setError(null);
      const data = await obtenerLeads(getToken);
      setLeads(data);
      idsConocidos.current = new Set(data.map((l) => l.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar leads');
    } finally {
      setCargando(false);
    }
  }

  // Aplica los leads pendientes del polling y oculta el banner
  function aplicarLeadsNuevos() {
    if (pendingLeads.current.length > 0) {
      setLeads(pendingLeads.current);
      idsConocidos.current = new Set(pendingLeads.current.map((l) => l.id));
      pendingLeads.current = [];
    }
    setLeadsNuevos(0);
  }

  const leadsFiltrados = leads.filter((lead) => {
    const pasaClasif = filtroClasif === 'TODAS' || lead.classification === filtroClasif;
    const pasaEstado = filtroEstado === 'TODOS' || (lead.status ?? 'PENDIENTE') === filtroEstado;
    return pasaClasif && pasaEstado;
  });

  const calientes = leads.filter((l) => l.classification === 'CALIENTE').length;
  const tibios    = leads.filter((l) => l.classification === 'TIBIO').length;
  const frios     = leads.filter((l) => l.classification === 'FRÍO').length;
  const total     = leads.length;

  // ¿Hay filtros activos?
  const hayFiltros = filtroClasif !== 'TODAS' || filtroEstado !== 'TODOS';

  return (
    <div className="p-8">
      {/* Banner de leads nuevos */}
      {leadsNuevos > 0 && (
        <button
          onClick={aplicarLeadsNuevos}
          className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-3
            bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl
            transition-colors animate-fade-up"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {leadsNuevos === 1
            ? '1 lead nuevo — haz clic para actualizar'
            : `${leadsNuevos} leads nuevos — haz clic para actualizar`}
        </button>
      )}

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total > 0 ? `${total} leads en total` : 'Sin leads todavía'}
          </p>
        </div>
        <Link
          href="/nuevo-lead"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700
            text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Cualificar nuevo lead
        </Link>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricaCard label="Calientes" valor={calientes} total={total} nivel={3}
          iconColor="text-red-500"   bgColor="bg-red-50"   valueColor="text-red-600"   barColor="bg-red-400" />
        <MetricaCard label="Tibios"    valor={tibios}    total={total} nivel={2}
          iconColor="text-amber-500" bgColor="bg-amber-50" valueColor="text-amber-600" barColor="bg-amber-400" />
        <MetricaCard label="Fríos"     valor={frios}     total={total} nivel={1}
          iconColor="text-blue-500"  bgColor="bg-blue-50"  valueColor="text-blue-600"  barColor="bg-blue-400" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-6 mb-6">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Clasificación
          </p>
          <div className="flex gap-2">
            {CLASIFICACIONES.map((c) => (
              <button key={c} onClick={() => setFiltroClasif(c)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filtroClasif === c
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Estado
          </p>
          <div className="flex gap-2">
            {ESTADOS.map((e) => (
              <button key={e} onClick={() => setFiltroEstado(e)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filtroEstado === e
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      {cargando ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Cargando leads...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">No se pudieron cargar los leads</p>
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button onClick={cargarLeads}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors">
            Reintentar
          </button>
        </div>
      ) : leadsFiltrados.length === 0 ? (
        <EmptyState sinLeads={total === 0} onLimpiarFiltros={hayFiltros ? () => { setFiltroClasif('TODAS'); setFiltroEstado('TODOS'); } : undefined} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {leadsFiltrados.map((lead, i) => (
            <LeadCard key={lead.id} lead={lead} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  sinLeads,
  onLimpiarFiltros,
}: {
  sinLeads: boolean;
  onLimpiarFiltros?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center animate-fade-up">
      {/* Ilustración SVG */}
      <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-6">
        {sinLeads ? (
          <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        ) : (
          <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
          </svg>
        )}
      </div>

      <h2 className="text-lg font-bold text-gray-800 mb-2">
        {sinLeads ? 'Aún no hay leads aquí' : 'Ningún lead coincide con estos filtros'}
      </h2>
      <p className="text-sm text-gray-500 mb-8 max-w-sm leading-relaxed">
        {sinLeads
          ? 'Cualifica tu primer lead y aparecerá aquí automáticamente con su clasificación y email generado.'
          : 'Prueba a cambiar o limpiar los filtros activos para ver más resultados.'}
      </p>

      {sinLeads ? (
        <Link
          href="/nuevo-lead"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700
            text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Cualificar primer lead
        </Link>
      ) : (
        <button
          onClick={onLimpiarFiltros}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-700
            text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

// ── Tarjeta de métrica con porcentaje y barra ─────────────────────────────────

function MetricaCard({
  label, valor, total, nivel, iconColor, bgColor, valueColor, barColor,
}: {
  label: string; valor: number; total: number; nivel: 1 | 2 | 3;
  iconColor: string; bgColor: string; valueColor: string; barColor: string;
}) {
  const porcentaje = total > 0 ? Math.round((valor / total) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
      <div className="flex items-center gap-4 mb-3">
        {/* Icono de barras — igual que en LeadBadge */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bgColor}`}>
          <svg className={`w-5 h-5 ${iconColor}`} viewBox="0 0 20 16" fill="currentColor">
            <rect x="0"  y={nivel >= 1 ? 8  : 13} width="4" height={nivel >= 1 ? 8  : 3} rx="1" opacity={nivel >= 1 ? 1 : 0.25} />
            <rect x="8"  y={nivel >= 2 ? 4  : 13} width="4" height={nivel >= 2 ? 12 : 3} rx="1" opacity={nivel >= 2 ? 1 : 0.25} />
            <rect x="16" y={nivel >= 3 ? 0  : 13} width="4" height={nivel >= 3 ? 16 : 3} rx="1" opacity={nivel >= 3 ? 1 : 0.25} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-2xl font-bold ${valueColor}`}>
              {total === 0 ? '—' : valor}
            </p>
            {total > 0 && (
              <span className="text-xs text-gray-400 font-medium">{porcentaje}%</span>
            )}
          </div>
        </div>
      </div>
      {/* Barra de progreso proporcional */}
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}
