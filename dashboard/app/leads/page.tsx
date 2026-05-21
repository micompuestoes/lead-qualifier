'use client';

// Lista de todos los leads con filtros por clasificación y estado

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { obtenerLeads } from '@/lib/api';
import type { Lead, Clasificacion, EstadoLead } from '@/types/lead';
import LeadCard from '@/components/LeadCard';

const CLASIFICACIONES: (Clasificacion | 'TODAS')[] = ['TODAS', 'CALIENTE', 'TIBIO', 'FRÍO'];
const ESTADOS: (EstadoLead | 'TODOS')[] = ['TODOS', 'PENDIENTE', 'CONTACTADO', 'CERRADO', 'DESCARTADO'];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroClasif, setFiltroClasif] = useState<Clasificacion | 'TODAS'>('TODAS');
  const [filtroEstado, setFiltroEstado] = useState<EstadoLead | 'TODOS'>('TODOS');

  useEffect(() => {
    cargarLeads();
  }, []);

  async function cargarLeads() {
    try {
      setCargando(true);
      setError(null);
      const data = await obtenerLeads();
      setLeads(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar leads');
    } finally {
      setCargando(false);
    }
  }

  const leadsFiltrados = leads.filter((lead) => {
    const pasaClasif = filtroClasif === 'TODAS' || lead.classification === filtroClasif;
    const pasaEstado = filtroEstado === 'TODOS' || (lead.status ?? 'PENDIENTE') === filtroEstado;
    return pasaClasif && pasaEstado;
  });

  const calientes = leads.filter((l) => l.classification === 'CALIENTE').length;
  const tibios    = leads.filter((l) => l.classification === 'TIBIO').length;
  const frios     = leads.filter((l) => l.classification === 'FRÍO').length;

  return (
    <div className="p-8">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{leads.length} leads en total</p>
        </div>
        <Link
          href="/nuevo-lead"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Cualificar nuevo lead
        </Link>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricaCard label="Calientes" valor={calientes} nivel={3} iconColor="text-red-500"   bgColor="bg-red-50"   valueColor="text-red-600"   />
        <MetricaCard label="Tibios"    valor={tibios}    nivel={2} iconColor="text-amber-500" bgColor="bg-amber-50" valueColor="text-amber-600" />
        <MetricaCard label="Fríos"     valor={frios}     nivel={1} iconColor="text-blue-500"  bgColor="bg-blue-50"  valueColor="text-blue-600"  />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-6 mb-6">
        {/* Clasificación */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Clasificación
          </p>
          <div className="flex gap-2">
            {CLASIFICACIONES.map((c) => (
              <button
                key={c}
                onClick={() => setFiltroClasif(c)}
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

        {/* Estado */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Estado
          </p>
          <div className="flex gap-2">
            {ESTADOS.map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
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

      {/* Contenido */}
      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Cargando leads...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-2">No se pudieron cargar los leads</p>
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={cargarLeads}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : leadsFiltrados.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          {/* Icono lupa SVG */}
          <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
          </svg>
          <p className="mt-4 text-gray-600 font-medium">
            {leads.length === 0
              ? 'Todavía no hay leads. ¡Cualifica el primero!'
              : 'Ningún lead coincide con los filtros aplicados.'}
          </p>
          {leads.length === 0 && (
            <Link
              href="/nuevo-lead"
              className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              Cualificar lead
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {leadsFiltrados.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de métrica ────────────────────────────────────────────────────────

function MetricaCard({
  label,
  valor,
  nivel,
  iconColor,
  bgColor,
  valueColor,
}: {
  label: string;
  valor: number;
  nivel: 1 | 2 | 3;
  iconColor: string;
  bgColor: string;
  valueColor: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4">
      {/* Icono de barras — consistente con LeadBadge */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bgColor}`}>
        <svg className={`w-5 h-5 ${iconColor}`} viewBox="0 0 20 16" fill="currentColor">
          <rect x="0"  y={nivel >= 1 ? 8  : 13} width="4" height={nivel >= 1 ? 8  : 3} rx="1" opacity={nivel >= 1 ? 1 : 0.25} />
          <rect x="8"  y={nivel >= 2 ? 4  : 13} width="4" height={nivel >= 2 ? 12 : 3} rx="1" opacity={nivel >= 2 ? 1 : 0.25} />
          <rect x="16" y={nivel >= 3 ? 0  : 13} width="4" height={nivel >= 3 ? 16 : 3} rx="1" opacity={nivel >= 3 ? 1 : 0.25} />
        </svg>
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className={`text-2xl font-bold ${valueColor}`}>{valor}</p>
      </div>
    </div>
  );
}
