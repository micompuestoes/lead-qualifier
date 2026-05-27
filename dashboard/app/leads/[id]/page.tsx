'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';

import { obtenerLead, actualizarEstado, eliminarLead } from '@/lib/api';
import { formatearFecha, generarAsunto, parsearReasoning } from '@/lib/utils';
import type { Lead, EstadoLead } from '@/types/lead';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';
import LeadBadge from '@/components/LeadBadge';
import ScoreBar from '@/components/ScoreBar';
import EmailUI from '@/components/EmailUI';
import AccionesRecomendadas from '@/components/AccionesRecomendadas';

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTADOS: EstadoLead[] = ['PENDIENTE', 'CONTACTADO', 'CERRADO', 'DESCARTADO'];

const ESTADO_ESTILOS: Record<EstadoLead, { bg: string; color: string; border: string }> = {
  PENDIENTE:  { bg: 'rgba(200,169,110,0.12)', color: '#9a7a3a', border: 'rgba(200,169,110,0.4)'  },
  CONTACTADO: { bg: 'rgba(110,168,200,0.1)',  color: '#3a7a9a', border: 'rgba(110,168,200,0.35)' },
  CERRADO:    { bg: 'rgba(110,200,122,0.1)',  color: '#2d7a3a', border: 'rgba(110,200,122,0.35)' },
  DESCARTADO: { bg: 'rgba(122,116,104,0.08)', color: '#7a7468', border: 'rgba(122,116,104,0.25)' },
};

// ── Página ────────────────────────────────────────────────────────────────────

export default function LeadDetallePage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const { addToast } = useToast();
  const { getToken } = useAuth();
  const { c }     = useTheme();

  const [lead, setLead]                           = useState<Lead | null>(null);
  const [cargando, setCargando]                   = useState(true);
  const [error, setError]                         = useState<string | null>(null);
  const [actualizando, setActualizando]           = useState(false);
  const [eliminando, setEliminando]               = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  // ── Carga inicial ───────────────────────────────────────────────────────────

  useEffect(() => {
    async function cargar() {
      try {
        setLead(await obtenerLead(id, getToken));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar el lead');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function cambiarEstado(nuevoEstado: EstadoLead) {
    if (!lead || actualizando) return;
    try {
      setActualizando(true);
      const actualizado = await actualizarEstado(id, { status: nuevoEstado }, getToken);
      setLead({ ...lead, status: actualizado.status });
      addToast(`Estado → ${nuevoEstado}`, 'success');
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
      await eliminarLead(id, getToken);
      addToast('Lead eliminado', 'success');
      router.push('/leads');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error al eliminar', 'error');
      setEliminando(false);
    }
  }

  // ── Estados de carga / error ─────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen flex-col gap-3">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgba(200,169,110,0.3)', borderTopColor: '#c8a96e' }} />
        <p className="text-sm" style={{ color: c.text2 }}>Cargando lead…</p>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-8">
        <div className="rounded-xl p-6 text-center max-w-md mx-auto mt-20"
          style={{ background: 'rgba(180,83,9,0.05)', border: '1px solid rgba(180,83,9,0.15)' }}>
          <p className="font-medium mb-2" style={{ color: '#b45309' }}>Lead no encontrado</p>
          <p className="text-sm mb-4" style={{ color: c.text2 }}>{error}</p>
          <Link href="/leads" className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#1a1814', color: '#f5f0e8', textDecoration: 'none' }}>
            Volver a leads
          </Link>
        </div>
      </div>
    );
  }

  // ── Datos derivados ──────────────────────────────────────────────────────────

  const statusActual = (lead.status ?? 'PENDIENTE') as EstadoLead;
  const asunto       = generarAsunto(lead.name, lead.classification);
  const puntos       = lead.reasoning ? parsearReasoning(lead.reasoning) : [];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-4xl">

      {/* Breadcrumb */}
      <Link href="/leads"
        className="flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: c.text2, textDecoration: 'none' }}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Volver a todos los leads
      </Link>

      {/* ── Tarjeta principal ── */}
      <div className="rounded-2xl p-6 mb-6 animate-reveal-in"
        style={{ background: c.card, border: c.cardBorder }}>

        {/* Nombre, email, badge */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl" style={{ color: c.text1 }}>{lead.name}</h1>
            <p className="mt-0.5" style={{ color: c.text2 }}>{lead.email}</p>
            {lead.phone && <p className="text-sm mt-0.5" style={{ color: c.text2 }}>{lead.phone}</p>}
          </div>
          <LeadBadge clasificacion={lead.classification} />
        </div>

        {/* Score */}
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: c.text2 }}>
            Puntuación del agente
          </p>
          <ScoreBar score={lead.score} />
        </div>

        {/* Razonamiento */}
        {puntos.length > 0 && (
          <div className="rounded-xl p-4 mb-5" style={{ background: c.muted }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: c.text2 }}>
              Razonamiento del agente
            </p>
            <ul className="space-y-2">
              {puntos.map((punto, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#c8a96e' }} />
                  <span className="text-sm leading-relaxed" style={{ color: c.text1 }}>{punto}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fechas */}
        <div className="flex gap-6 text-xs pt-4" style={{ borderTop: `1px solid ${c.divider}`, color: c.text2 }}>
          <span>Recibido: {formatearFecha(lead.created_at)}</span>
          {lead.processed_at && <span>Procesado: {formatearFecha(lead.processed_at)}</span>}
        </div>
      </div>

      {/* ── Mensaje original ── */}
      <div className="rounded-2xl p-6 mb-6 animate-reveal-in"
        style={{ background: c.card, border: c.cardBorder, animationDelay: '80ms' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: c.text2 }}>
          Mensaje original
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: c.text1 }}>
          {lead.message}
        </p>
      </div>

      {/* ── Email generado ── */}
      <div className="mb-6 animate-reveal-in" style={{ animationDelay: '160ms' }}>
        {lead.generated_email ? (
          <EmailUI email={lead.generated_email} leadEmail={lead.email} asunto={asunto} />
        ) : (
          <div className="rounded-xl p-4 text-sm italic"
            style={{ background: c.muted, border: `1px solid ${c.divider}`, color: c.text2 }}>
            Email no disponible
          </div>
        )}
      </div>

      {/* ── Acciones recomendadas ── */}
      {lead.recommended_actions && lead.recommended_actions.length > 0 && (
        <div className="animate-reveal-in" style={{ animationDelay: '240ms' }}>
          <AccionesRecomendadas acciones={lead.recommended_actions} />
        </div>
      )}

      {/* ── Selector de estado ── */}
      <div className="rounded-2xl p-6 mb-6 animate-reveal-in"
        style={{ background: c.card, border: c.cardBorder, animationDelay: '320ms' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: c.text2 }}>
          Estado del lead{' '}
          {actualizando && (
            <span className="normal-case font-normal" style={{ color: '#c8a96e' }}>(guardando…)</span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.map(estado => {
            const activo = statusActual === estado;
            const est    = ESTADO_ESTILOS[estado];
            return (
              <button key={estado} onClick={() => cambiarEstado(estado)} disabled={actualizando}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{
                  background: activo ? est.bg    : 'transparent',
                  color:      activo ? est.color : c.text2,
                  border:     activo ? `1.5px solid ${est.border}` : `1.5px solid ${c.inputBorder}`,
                }}>
                {estado}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Zona de peligro ── */}
      <div className="rounded-2xl p-6 animate-reveal-in"
        style={{ border: '1px solid rgba(180,83,9,0.15)', animationDelay: '400ms' }}>
        <p className="text-sm font-semibold mb-3" style={{ color: '#b45309' }}>Zona de peligro</p>
        {!confirmarEliminar ? (
          <button
            onClick={() => setConfirmarEliminar(true)}
            className="px-4 py-2 rounded-xl text-sm transition-all"
            style={{ border: '1px solid rgba(180,83,9,0.25)', color: '#b45309', background: 'transparent' }}
          >
            Eliminar lead
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm" style={{ color: c.text2 }}>¿Seguro? Esta acción no se puede deshacer.</p>
            <button onClick={handleEliminar} disabled={eliminando}
              className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-all"
              style={{ background: '#b45309', color: '#fff', border: 'none' }}>
              {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button onClick={() => setConfirmarEliminar(false)}
              className="px-4 py-2 rounded-xl text-sm transition-all"
              style={{ border: `1.5px solid ${c.inputBorder}`, color: c.text2, background: 'transparent' }}>
              Cancelar
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
