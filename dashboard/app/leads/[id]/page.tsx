'use client';

// Detalle completo de un lead: datos, email generado, acciones y gestión de estado

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { obtenerLead, actualizarEstado, eliminarLead } from '@/lib/api';
import type { Lead, EstadoLead } from '@/types/lead';
import LeadBadge from '@/components/LeadBadge';
import ScoreBar from '@/components/ScoreBar';
import EmailPreview from '@/components/EmailPreview';

const ESTADOS: EstadoLead[] = ['PENDIENTE', 'CONTACTADO', 'CERRADO', 'DESCARTADO'];

const estadoColor: Record<EstadoLead, string> = {
  PENDIENTE:  'bg-yellow-100 text-yellow-700 border-yellow-300',
  CONTACTADO: 'bg-blue-100 text-blue-700 border-blue-300',
  CERRADO:    'bg-green-100 text-green-700 border-green-300',
  DESCARTADO: 'bg-gray-100 text-gray-500 border-gray-300',
};

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function LeadDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lead, setLead] = useState<Lead | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  useEffect(() => {
    async function cargar() {
      try {
        const data = await obtenerLead(id);
        setLead(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar el lead');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [id]);

  async function cambiarEstado(nuevoEstado: EstadoLead) {
    if (!lead || actualizando) return;
    try {
      setActualizando(true);
      const actualizado = await actualizarEstado(id, { status: nuevoEstado });
      setLead({ ...lead, status: actualizado.status });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setActualizando(false);
    }
  }

  async function handleEliminar() {
    if (eliminando) return;
    try {
      setEliminando(true);
      await eliminarLead(id);
      router.push('/leads');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar');
      setEliminando(false);
    }
  }

  // ── Estados de carga ──────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Cargando lead...</p>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-md mx-auto mt-20">
          <p className="text-red-700 font-medium mb-2">Lead no encontrado</p>
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <Link href="/leads" className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors">
            Volver a leads
          </Link>
        </div>
      </div>
    );
  }

  const statusActual = lead.status ?? 'PENDIENTE';

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <Link href="/leads" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6">
        <span>←</span> Volver a todos los leads
      </Link>

      {/* Cabecera del lead */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
            <p className="text-gray-500 mt-0.5">{lead.email}</p>
            {lead.phone && (
              <p className="text-gray-500 text-sm">{lead.phone}</p>
            )}
          </div>
          <LeadBadge clasificacion={lead.classification} />
        </div>

        {/* Score */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Puntuación del agente
          </p>
          <ScoreBar score={lead.score} />
        </div>

        {/* Razonamiento */}
        {lead.reasoning && (
          <div className="bg-gray-50 rounded-xl p-4 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Razonamiento del agente
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{lead.reasoning}</p>
          </div>
        )}

        {/* Fechas */}
        <div className="flex gap-6 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <span>Recibido: {formatearFecha(lead.created_at)}</span>
          {lead.processed_at && (
            <span>Procesado: {formatearFecha(lead.processed_at)}</span>
          )}
        </div>
      </div>

      {/* Mensaje original */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Mensaje original
        </p>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {lead.message}
        </p>
      </div>

      {/* Email generado */}
      <div className="mb-6">
        <EmailPreview email={lead.generated_email} />
      </div>

      {/* Acciones recomendadas */}
      {lead.recommended_actions && lead.recommended_actions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Próximos pasos recomendados
          </p>
          <ul className="space-y-2">
            {lead.recommended_actions.map((accion, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700">{accion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Selector de estado */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Estado del lead {actualizando && <span className="text-blue-500 normal-case font-normal">(guardando...)</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.map((estado) => (
            <button
              key={estado}
              onClick={() => cambiarEstado(estado)}
              disabled={actualizando}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                statusActual === estado
                  ? estadoColor[estado]
                  : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {estado}
            </button>
          ))}
        </div>
      </div>

      {/* Zona de peligro */}
      <div className="border border-red-200 rounded-2xl p-6">
        <p className="text-sm font-semibold text-red-700 mb-3">Zona de peligro</p>
        {!confirmarEliminar ? (
          <button
            onClick={() => setConfirmarEliminar(true)}
            className="px-4 py-2 border border-red-300 text-red-600 text-sm rounded-xl hover:bg-red-50 transition-colors"
          >
            Eliminar lead
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600">¿Seguro que quieres eliminar este lead? Esta acción no se puede deshacer.</p>
            <button
              onClick={handleEliminar}
              disabled={eliminando}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
            <button
              onClick={() => setConfirmarEliminar(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
