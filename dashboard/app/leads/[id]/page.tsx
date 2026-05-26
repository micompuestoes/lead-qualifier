'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { obtenerLead, actualizarEstado, eliminarLead } from '@/lib/api';
import type { Lead, EstadoLead } from '@/types/lead';
import LeadBadge from '@/components/LeadBadge';
import ScoreBar from '@/components/ScoreBar';
import { useToast } from '@/components/Toast';

const ESTADOS: EstadoLead[] = ['PENDIENTE', 'CONTACTADO', 'CERRADO', 'DESCARTADO'];

const estadoEstilos: Record<EstadoLead, { bg: string; color: string; border: string }> = {
  PENDIENTE:  { bg: 'rgba(200,169,110,0.12)', color: '#9a7a3a', border: 'rgba(200,169,110,0.4)' },
  CONTACTADO: { bg: 'rgba(110,168,200,0.1)',  color: '#3a7a9a', border: 'rgba(110,168,200,0.35)' },
  CERRADO:    { bg: 'rgba(110,200,122,0.1)',  color: '#2d7a3a', border: 'rgba(110,200,122,0.35)' },
  DESCARTADO: { bg: 'rgba(122,116,104,0.08)', color: '#7a7468', border: 'rgba(122,116,104,0.25)' },
};

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function generarAsunto(name: string, clasificacion: string | null): string {
  const prefijos: Record<string, string> = {
    CALIENTE: 'Oportunidad — ', TIBIO: 'Seguimiento — ', 'FRÍO': 'Información solicitada — ',
  };
  return `${clasificacion ? (prefijos[clasificacion] ?? '') : ''}${name}`;
}

function parsearReasoning(texto: string): string[] {
  const porLinea = texto.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(l => l.length > 8);
  if (porLinea.length > 1) return porLinea;
  return texto.split(/\.\s+/).map(s => s.trim().replace(/\.$/, '')).filter(s => s.length > 10);
}

// ── Email UI ──────────────────────────────────────────────────────────────────

function EmailUI({ email, leadEmail, asunto }: { email: string; leadEmail: string; asunto: string }) {
  const { addToast } = useToast();
  const [copiado, setCopiado] = useState(false);

  async function copiarCompleto() {
    await navigator.clipboard.writeText(`Para: ${leadEmail}\nAsunto: ${asunto}\n\n${email}`);
    setCopiado(true);
    addToast('Email copiado al portapapeles', 'success');
    setTimeout(() => setCopiado(false), 2000);
  }

  function abrirGmail() {
    window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(leadEmail)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(email)}`, '_blank');
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid rgba(200,169,110,0.2)' }}>
      {/* Cabecera */}
      <div className="px-5 py-4" style={{ background: 'rgba(249,245,238,0.7)', borderBottom: '1px solid rgba(200,169,110,0.15)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2" style={{ color: '#7a7468' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: '#1a1814' }}>Email generado por el agente</span>
          </div>
          <div className="flex gap-2">
            <button onClick={copiarCompleto}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: copiado ? 'rgba(110,200,122,0.1)' : '#fff',
                color: copiado ? '#2d7a3a' : '#7a7468',
                border: '1px solid rgba(200,169,110,0.25)',
              }}>
              {copiado ? '✓ Copiado' : 'Copiar email'}
            </button>
            <button onClick={abrirGmail}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: '#fff', color: '#7a7468', border: '1px solid rgba(200,169,110,0.25)' }}>
              Abrir en Gmail
            </button>
          </div>
        </div>
        <div className="space-y-1.5 text-sm">
          {[{ label: 'Para', value: leadEmail }, { label: 'Asunto', value: asunto }].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: '#7a7468' }}>{label}</span>
              <span className="font-medium" style={{ color: '#1a1814' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Cuerpo */}
      <div className="p-5 bg-white">
        <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed" style={{ color: '#1a1814' }}>
          {email}
        </pre>
      </div>
    </div>
  );
}

// ── Acciones recomendadas ────────────────────────────────────────────────────

function AccionesRecomendadas({ acciones }: { acciones: string[] }) {
  const [hechas, setHechas] = useState<Set<number>>(new Set());
  function toggle(i: number) {
    setHechas(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }
  return (
    <div className="rounded-2xl p-6 mb-6" style={{ background: '#fff', border: '1.5px solid rgba(200,169,110,0.18)' }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#7a7468' }}>
        Próximos pasos recomendados
      </p>
      <ul className="space-y-3">
        {acciones.map((accion, i) => {
          const hecha = hechas.has(i);
          return (
            <li key={i}>
              <button onClick={() => toggle(i)} className="flex items-start gap-3 w-full text-left group">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
                  style={{
                    background: hecha ? '#c8a96e' : 'transparent',
                    borderColor: hecha ? '#c8a96e' : 'rgba(200,169,110,0.4)',
                  }}>
                  {hecha && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="#1a1814">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </span>
                <span className="text-sm leading-relaxed transition-all"
                  style={{ color: hecha ? '#7a7468' : '#1a1814', textDecoration: hecha ? 'line-through' : 'none' }}>
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
  const { getToken } = useAuth();

  const [lead, setLead]                     = useState<Lead | null>(null);
  const [cargando, setCargando]             = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [actualizando, setActualizando]     = useState(false);
  const [eliminando, setEliminando]         = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  useEffect(() => {
    async function cargar() {
      try {
        setLead(await obtenerLead(id, getToken));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar el lead');
      } finally { setCargando(false); }
    }
    cargar();
  }, [id]);

  async function cambiarEstado(nuevoEstado: EstadoLead) {
    if (!lead || actualizando) return;
    try {
      setActualizando(true);
      const actualizado = await actualizarEstado(id, { status: nuevoEstado }, getToken);
      setLead({ ...lead, status: actualizado.status });
      addToast(`Estado → ${nuevoEstado}`, 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error al actualizar', 'error');
    } finally { setActualizando(false); }
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

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen flex-col gap-3">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgba(200,169,110,0.3)', borderTopColor: '#c8a96e' }} />
        <p className="text-sm" style={{ color: '#7a7468' }}>Cargando lead…</p>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-8">
        <div className="rounded-xl p-6 text-center max-w-md mx-auto mt-20"
          style={{ background: 'rgba(180,83,9,0.05)', border: '1px solid rgba(180,83,9,0.15)' }}>
          <p className="font-medium mb-2" style={{ color: '#b45309' }}>Lead no encontrado</p>
          <p className="text-sm mb-4" style={{ color: '#7a7468' }}>{error}</p>
          <Link href="/leads" className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#1a1814', color: '#f5f0e8' }}>
            Volver a leads
          </Link>
        </div>
      </div>
    );
  }

  const statusActual = (lead.status ?? 'PENDIENTE') as EstadoLead;
  const asunto = generarAsunto(lead.name, lead.classification);
  const puntos = lead.reasoning ? parsearReasoning(lead.reasoning) : [];

  return (
    <div className="p-8 max-w-4xl">

      {/* Breadcrumb */}
      <Link href="/leads"
        className="flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: '#7a7468' }}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Volver a todos los leads
      </Link>

      {/* Cabecera */}
      <div className="rounded-2xl p-6 mb-6 animate-reveal-in"
        style={{ background: '#fff', border: '1.5px solid rgba(200,169,110,0.18)' }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl" style={{ color: '#1a1814' }}>{lead.name}</h1>
            <p className="mt-0.5" style={{ color: '#7a7468' }}>{lead.email}</p>
            {lead.phone && <p className="text-sm mt-0.5" style={{ color: '#7a7468' }}>{lead.phone}</p>}
          </div>
          <LeadBadge clasificacion={lead.classification} />
        </div>

        {/* Score */}
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#7a7468' }}>
            Puntuación del agente
          </p>
          <ScoreBar score={lead.score} />
        </div>

        {/* Razonamiento */}
        {puntos.length > 0 && (
          <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(249,245,238,0.6)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#7a7468' }}>
              Razonamiento del agente
            </p>
            <ul className="space-y-2">
              {puntos.map((punto, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#c8a96e' }} />
                  <span className="text-sm leading-relaxed" style={{ color: '#1a1814' }}>{punto}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fechas */}
        <div className="flex gap-6 text-xs pt-4" style={{ borderTop: '1px solid rgba(200,169,110,0.12)', color: '#7a7468' }}>
          <span>Recibido: {formatearFecha(lead.created_at)}</span>
          {lead.processed_at && <span>Procesado: {formatearFecha(lead.processed_at)}</span>}
        </div>
      </div>

      {/* Mensaje original */}
      <div className="rounded-2xl p-6 mb-6 animate-reveal-in"
        style={{ background: '#fff', border: '1.5px solid rgba(200,169,110,0.18)', animationDelay: '80ms' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#7a7468' }}>
          Mensaje original
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#1a1814' }}>
          {lead.message}
        </p>
      </div>

      {/* Email generado */}
      <div className="mb-6 animate-reveal-in" style={{ animationDelay: '160ms' }}>
        {lead.generated_email ? (
          <EmailUI email={lead.generated_email} leadEmail={lead.email} asunto={asunto} />
        ) : (
          <div className="rounded-xl p-4 text-sm italic"
            style={{ background: 'rgba(249,245,238,0.6)', border: '1px solid rgba(200,169,110,0.15)', color: '#7a7468' }}>
            Email no disponible
          </div>
        )}
      </div>

      {/* Acciones recomendadas */}
      {lead.recommended_actions && lead.recommended_actions.length > 0 && (
        <div className="animate-reveal-in" style={{ animationDelay: '240ms' }}>
          <AccionesRecomendadas acciones={lead.recommended_actions} />
        </div>
      )}

      {/* Selector de estado */}
      <div className="rounded-2xl p-6 mb-6 animate-reveal-in"
        style={{ background: '#fff', border: '1.5px solid rgba(200,169,110,0.18)', animationDelay: '320ms' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#7a7468' }}>
          Estado del lead{' '}
          {actualizando && <span className="normal-case font-normal" style={{ color: '#c8a96e' }}>(guardando…)</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.map(estado => {
            const activo = statusActual === estado;
            const est = estadoEstilos[estado];
            return (
              <button key={estado} onClick={() => cambiarEstado(estado)} disabled={actualizando}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{
                  background: activo ? est.bg : 'transparent',
                  color:      activo ? est.color : '#7a7468',
                  border:     activo ? `1.5px solid ${est.border}` : '1.5px solid rgba(200,169,110,0.2)',
                }}>
                {estado}
              </button>
            );
          })}
        </div>
      </div>

      {/* Zona de peligro */}
      <div className="rounded-2xl p-6 animate-reveal-in"
        style={{ border: '1px solid rgba(180,83,9,0.15)', animationDelay: '400ms' }}>
        <p className="text-sm font-semibold mb-3" style={{ color: '#b45309' }}>Zona de peligro</p>
        {!confirmarEliminar ? (
          <button onClick={() => setConfirmarEliminar(true)}
            className="px-4 py-2 rounded-xl text-sm transition-all"
            style={{ border: '1px solid rgba(180,83,9,0.25)', color: '#b45309' }}>
            Eliminar lead
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm" style={{ color: '#7a7468' }}>¿Seguro? Esta acción no se puede deshacer.</p>
            <button onClick={handleEliminar} disabled={eliminando}
              className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-all"
              style={{ background: '#b45309', color: '#fff' }}>
              {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button onClick={() => setConfirmarEliminar(false)}
              className="px-4 py-2 rounded-xl text-sm transition-all"
              style={{ border: '1px solid rgba(200,169,110,0.25)', color: '#7a7468' }}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
