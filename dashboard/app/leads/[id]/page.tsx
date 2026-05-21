'use client';

// Detalle completo de un lead con UI de email real, reasoning en puntos y acciones con checkbox

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { obtenerLead, actualizarEstado, eliminarLead } from '@/lib/api';
import type { Lead, EstadoLead } from '@/types/lead';
import LeadBadge from '@/components/LeadBadge';
import ScoreBar from '@/components/ScoreBar';
import { useToast } from '@/components/Toast';

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

// Genera un asunto de email a partir del nombre y clasificación
function generarAsunto(name: string, clasificacion: string | null): string {
  const prefijos: Record<string, string> = {
    CALIENTE: 'Oportunidad — ',
    TIBIO:    'Seguimiento — ',
    'FRÍO':   'Información solicitada — ',
  };
  const prefijo = clasificacion ? (prefijos[clasificacion] ?? '') : '';
  return `${prefijo}${name}`;
}

// Convierte el reasoning en una lista de puntos
function parsearReasoning(texto: string): string[] {
  // Primero intenta dividir por saltos de línea
  const porLinea = texto.split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter((l) => l.length > 8);
  if (porLinea.length > 1) return porLinea;
  // Si es un párrafo, parte por ". "
  return texto
    .split(/\.\s+/)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter((s) => s.length > 10);
}

// ── Componente EmailUI ────────────────────────────────────────────────────────

function EmailUI({
  email,
  leadEmail,
  asunto,
}: {
  email: string;
  leadEmail: string;
  asunto: string;
}) {
  const { addToast } = useToast();
  const [copiado, setCopiado] = useState(false);

  async function copiarCompleto() {
    const texto = `Para: ${leadEmail}\nAsunto: ${asunto}\n\n${email}`;
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    addToast('Email copiado al portapapeles', 'success');
    setTimeout(() => setCopiado(false), 2000);
  }

  function abrirGmail() {
    const url = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(leadEmail)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(email)}`;
    window.open(url, '_blank');
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Cabecera de email */}
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <span className="text-sm font-semibold text-gray-700">Email generado por el agente</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copiarCompleto}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                copiado
                  ? 'bg-green-100 text-green-700'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {copiado ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Copiado
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                  Copiar email completo
                </>
              )}
            </button>
            <button
              onClick={abrirGmail}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Abrir en Gmail
            </button>
          </div>
        </div>

        {/* Campos Para / Asunto */}
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 w-14 shrink-0 text-right text-xs font-semibold uppercase tracking-wide">Para</span>
            <span className="text-gray-700 font-medium">{leadEmail}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 w-14 shrink-0 text-right text-xs font-semibold uppercase tracking-wide">Asunto</span>
            <span className="text-gray-800 font-semibold">{asunto}</span>
          </div>
        </div>
      </div>

      {/* Cuerpo del email */}
      <div className="p-5 bg-white">
        <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
          {email}
        </pre>
      </div>
    </div>
  );
}

// ── Acciones con checkbox visual ──────────────────────────────────────────────

function AccionesRecomendadas({ acciones }: { acciones: string[] }) {
  const [hechas, setHechas] = useState<Set<number>>(new Set());

  function toggleHecha(i: number) {
    setHechas((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Próximos pasos recomendados
      </p>
      <ul className="space-y-3">
        {acciones.map((accion, i) => {
          const hecha = hechas.has(i);
          return (
            <li key={i}>
              <button
                onClick={() => toggleHecha(i)}
                className="flex items-start gap-3 w-full text-left group"
              >
                {/* Checkbox visual */}
                <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center
                  transition-colors ${hecha
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300 group-hover:border-blue-400'}`}
                >
                  {hecha && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </span>
                <span className={`text-sm transition-colors leading-relaxed ${
                  hecha ? 'text-gray-400 line-through' : 'text-gray-700'
                }`}>
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

// ── Página principal ──────────────────────────────────────────────────────────

export default function LeadDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

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
      addToast(`Estado actualizado a ${nuevoEstado}`, 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error al actualizar', 'error');
    } finally {
      setActualizando(false);
    }
  }

  async function handleEliminar() {
    if (eliminando) return;
    try {
      setEliminando(true);
      await eliminarLead(id);
      addToast('Lead eliminado', 'success');
      router.push('/leads');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error al eliminar', 'error');
      setEliminando(false);
    }
  }

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
  const asunto = generarAsunto(lead.name, lead.classification);
  const puntos = lead.reasoning ? parsearReasoning(lead.reasoning) : [];

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <Link href="/leads"
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Volver a todos los leads
      </Link>

      {/* Cabecera del lead */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 animate-reveal-in">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
            <p className="text-gray-500 mt-0.5">{lead.email}</p>
            {lead.phone && <p className="text-gray-500 text-sm">{lead.phone}</p>}
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

        {/* Razonamiento como lista de puntos */}
        {puntos.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-4 mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Razonamiento del agente
            </p>
            <ul className="space-y-2">
              {puntos.map((punto, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-sm text-gray-700 leading-relaxed">{punto}</span>
                </li>
              ))}
            </ul>
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
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 animate-reveal-in"
        style={{ animationDelay: '80ms' }}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Mensaje original
        </p>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {lead.message}
        </p>
      </div>

      {/* Email generado como UI de email real */}
      <div className="mb-6 animate-reveal-in" style={{ animationDelay: '160ms' }}>
        {lead.generated_email ? (
          <EmailUI
            email={lead.generated_email}
            leadEmail={lead.email}
            asunto={asunto}
          />
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-400 italic">
            Email no disponible
          </div>
        )}
      </div>

      {/* Acciones recomendadas con checkbox */}
      {lead.recommended_actions && lead.recommended_actions.length > 0 && (
        <div className="animate-reveal-in" style={{ animationDelay: '240ms' }}>
          <AccionesRecomendadas acciones={lead.recommended_actions} />
        </div>
      )}

      {/* Selector de estado */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 animate-reveal-in"
        style={{ animationDelay: '320ms' }}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Estado del lead{' '}
          {actualizando && <span className="text-blue-500 normal-case font-normal">(guardando...)</span>}
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
      <div className="border border-red-200 rounded-2xl p-6 animate-reveal-in"
        style={{ animationDelay: '400ms' }}>
        <p className="text-sm font-semibold text-red-700 mb-3">Zona de peligro</p>
        {!confirmarEliminar ? (
          <button
            onClick={() => setConfirmarEliminar(true)}
            className="px-4 py-2 border border-red-300 text-red-600 text-sm rounded-xl hover:bg-red-50 transition-colors"
          >
            Eliminar lead
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-gray-600">¿Seguro? Esta acción no se puede deshacer.</p>
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
