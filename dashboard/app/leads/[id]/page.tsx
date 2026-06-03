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
import { LeadDetailSkeleton } from '@/components/Skeleton';

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTADOS: EstadoLead[] = ['PENDIENTE', 'CONTACTADO', 'CERRADO', 'DESCARTADO'];

const ESTADO_META: Record<EstadoLead, { label: string; color: string; bg: string; border: string; dot: string }> = {
  PENDIENTE:  { label: 'Pendiente',  color: '#9a7a3a', bg: 'rgba(200,169,110,0.1)',  border: 'rgba(200,169,110,0.35)',  dot: '#c8a96e' },
  CONTACTADO: { label: 'Contactado', color: '#3a7a9a', bg: 'rgba(110,168,200,0.08)', border: 'rgba(110,168,200,0.3)',   dot: '#6ea8c8' },
  CERRADO:    { label: 'Cerrado',    color: '#2d7a3a', bg: 'rgba(110,200,122,0.08)', border: 'rgba(110,200,122,0.3)',   dot: '#6ec87a' },
  DESCARTADO: { label: 'Descartado', color: '#7a7468', bg: 'rgba(122,116,104,0.07)', border: 'rgba(122,116,104,0.2)',   dot: '#9a9490' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 52 }: { name: string; size?: number }) {
  const letras = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, rgba(200,169,110,0.3) 0%, rgba(200,169,110,0.14) 100%)',
      border: '2px solid rgba(200,169,110,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: size * 0.28, fontWeight: 700, color: '#9a7a3a', letterSpacing: '0.02em' }}>
        {letras}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: '#c8a96e', marginBottom: 14,
    }}>
      {children}
    </p>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function LeadDetallePage() {
  const { id }       = useParams<{ id: string }>();
  const router       = useRouter();
  const { addToast } = useToast();
  const { getToken } = useAuth();
  const { c }        = useTheme();

  const [lead, setLead]                           = useState<Lead | null>(null);
  const [cargando, setCargando]                   = useState(true);
  const [error, setError]                         = useState<string | null>(null);
  const [statusLocal, setStatusLocal]             = useState<EstadoLead>('PENDIENTE');
  const [actualizando, setActualizando]           = useState(false);
  const [eliminando, setEliminando]               = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  useEffect(() => {
    async function cargar() {
      try {
        const data = await obtenerLead(id, getToken);
        setLead(data);
        setStatusLocal((data.status ?? 'PENDIENTE') as EstadoLead);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar el lead');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cambiarEstado(nuevo: EstadoLead) {
    if (nuevo === statusLocal || actualizando || !lead) return;
    const prev = statusLocal;
    setStatusLocal(nuevo);      // optimistic
    setActualizando(true);
    try {
      const updated = await actualizarEstado(id, { status: nuevo }, getToken);
      setLead({ ...lead, status: updated.status });
      addToast(`Estado actualizado a ${ESTADO_META[nuevo].label}`, 'success');
    } catch {
      setStatusLocal(prev);
      addToast('No se pudo actualizar el estado', 'error');
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
    } catch {
      addToast('Error al eliminar el lead', 'error');
      setEliminando(false);
    }
  }

  // ── Estados de UI ────────────────────────────────────────────────────────────

  if (cargando) return <LeadDetailSkeleton />;

  if (error || !lead) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{
          borderRadius: 14, padding: 32, textAlign: 'center',
          maxWidth: 380, margin: '80px auto',
          background: 'rgba(180,83,9,0.05)', border: '1px solid rgba(180,83,9,0.15)',
        }}>
          <p style={{ fontWeight: 600, color: '#b45309', marginBottom: 8 }}>Lead no encontrado</p>
          <p style={{ fontSize: 13, color: c.text2, marginBottom: 20 }}>{error}</p>
          <Link href="/leads" style={{
            padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: '#1a1814', color: '#f5f0e8', textDecoration: 'none',
          }}>
            Volver a leads
          </Link>
        </div>
      </div>
    );
  }

  // ── Datos derivados ──────────────────────────────────────────────────────────

  const asunto = generarAsunto(lead.name, lead.classification);
  const puntos = lead.reasoning ? parsearReasoning(lead.reasoning) : [];
  const meta   = ESTADO_META[statusLocal];

  const card = { background: c.card, border: c.cardBorder, borderRadius: 16 };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="r-pad" style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Breadcrumb ── */}
      <Link href="/leads" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: c.text2, textDecoration: 'none',
        marginBottom: 28, transition: 'color 0.15s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = c.text1; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = c.text2; }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/>
          <polyline points="12 19 5 12 12 5"/>
        </svg>
        Todos los leads
      </Link>

      {/* ── Hero card ── */}
      <div style={{ ...card, padding: 24, marginBottom: 24 }} className="animate-reveal-in">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 20 }}>
          <Avatar name={lead.name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <h1 style={{ fontSize: '1.6rem', color: c.text1 }}>{lead.name}</h1>
              <div style={{ flexShrink: 0, paddingTop: 4 }}>
                <LeadBadge clasificacion={lead.classification} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, color: c.text2 }}>{lead.email}</span>
              {lead.phone && (
                <>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: c.text3, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: c.text2 }}>{lead.phone}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Score */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.text2, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Puntuación IA
              <Link href="/ayuda#cualificacion" title="¿Cómo funciona la puntuación?"
                style={{ display: 'inline-flex', color: c.text3 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </Link>
            </p>
            {lead.score !== null && (
              <span style={{ fontSize: 26, fontWeight: 700, color: c.text1, lineHeight: 1 }}>
                {lead.score}
                <span style={{ fontSize: 13, color: c.text2, fontWeight: 400 }}>/10</span>
              </span>
            )}
          </div>
          <ScoreBar score={lead.score} />
        </div>

        {/* Fechas */}
        <div style={{
          display: 'flex', gap: 24, paddingTop: 16, flexWrap: 'wrap',
          borderTop: `1px solid ${c.divider}`,
        }}>
          <span style={{ fontSize: 12, color: c.text2 }}>
            <span style={{ color: c.text3 }}>Recibido · </span>
            {formatearFecha(lead.created_at)}
          </span>
          {lead.processed_at && (
            <span style={{ fontSize: 12, color: c.text2 }}>
              <span style={{ color: c.text3 }}>Procesado · </span>
              {formatearFecha(lead.processed_at)}
            </span>
          )}
        </div>
      </div>

      {/* ── Dos columnas ── */}
      <div className="r-col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, alignItems: 'start' }}>

        {/* ── Columna izquierda ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Mensaje original */}
          <div style={{ ...card, padding: 22 }} className="animate-reveal-in" data-delay="80">
            <SectionLabel>Mensaje original</SectionLabel>
            <p style={{ fontSize: 14, lineHeight: 1.75, color: c.text1, whiteSpace: 'pre-wrap' }}>
              {lead.message}
            </p>
          </div>

          {/* Email generado */}
          <div className="animate-reveal-in" style={{ animationDelay: '120ms' }}>
            {lead.generated_email ? (
              <EmailUI email={lead.generated_email} leadEmail={lead.email} asunto={asunto} />
            ) : (
              <div style={{
                ...card, padding: 20,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.text3} strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <span style={{ fontSize: 13, color: c.text3, fontStyle: 'italic' }}>Email no generado aún</span>
              </div>
            )}
          </div>

          {/* Acciones recomendadas */}
          {lead.recommended_actions && lead.recommended_actions.length > 0 && (
            <div className="animate-reveal-in" style={{ animationDelay: '160ms' }}>
              <AccionesRecomendadas acciones={lead.recommended_actions} />
            </div>
          )}
        </div>

        {/* ── Columna derecha (sidebar) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Estado */}
          <div style={{ ...card, padding: 20 }} className="animate-reveal-in" data-delay="80">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <SectionLabel>Estado del lead</SectionLabel>
              {actualizando && (
                <span style={{ fontSize: 11, color: '#c8a96e' }}>Guardando…</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {ESTADOS.map(estado => {
                const m      = ESTADO_META[estado];
                const activo = statusLocal === estado;
                return (
                  <button key={estado} onClick={() => cambiarEstado(estado)} disabled={actualizando}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 10, width: '100%',
                      fontSize: 13, fontWeight: activo ? 600 : 400,
                      background: activo ? m.bg : 'transparent',
                      color: activo ? m.color : c.text2,
                      border: activo ? `1.5px solid ${m.border}` : '1.5px solid transparent',
                      cursor: actualizando ? 'default' : 'pointer',
                      textAlign: 'left', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      if (!activo && !actualizando)
                        (e.currentTarget as HTMLElement).style.background = `${m.dot}0a`;
                    }}
                    onMouseLeave={e => {
                      if (!activo)
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: m.dot, opacity: activo ? 1 : 0.4,
                      transition: 'opacity 0.15s',
                    }} />
                    {m.label}
                    {activo && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke={m.color} strokeWidth="2.5" strokeLinecap="round"
                        style={{ marginLeft: 'auto' }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Razonamiento IA */}
          {puntos.length > 0 && (
            <div style={{ ...card, padding: 20 }} className="animate-reveal-in" data-delay="120">
              <SectionLabel>Razonamiento del agente</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {puntos.map((punto, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%', background: '#c8a96e',
                      flexShrink: 0, marginTop: 6,
                    }} />
                    <p style={{ fontSize: 13, lineHeight: 1.65, color: c.text1 }}>{punto}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zona de peligro */}
          <div style={{
            borderRadius: 16, padding: 20,
            border: '1px solid rgba(180,83,9,0.13)',
          }} className="animate-reveal-in" data-delay="160">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b45309', marginBottom: 14 }}>
              Zona de peligro
            </p>
            {!confirmarEliminar ? (
              <button onClick={() => setConfirmarEliminar(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  fontSize: 13, padding: '9px 14px', borderRadius: 10,
                  border: '1px solid rgba(180,83,9,0.2)',
                  color: '#b45309', background: 'transparent', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
                Eliminar lead
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, color: c.text2, lineHeight: 1.5 }}>
                  Esta acción es permanente y no se puede deshacer.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleEliminar} disabled={eliminando}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      background: '#b45309', color: '#fff', border: 'none', cursor: eliminando ? 'default' : 'pointer',
                      opacity: eliminando ? 0.6 : 1,
                    }}>
                    {eliminando ? 'Eliminando…' : 'Confirmar'}
                  </button>
                  <button onClick={() => setConfirmarEliminar(false)}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 10, fontSize: 13,
                      border: `1.5px solid ${c.inputBorder}`, color: c.text2,
                      background: 'transparent', cursor: 'pointer',
                    }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
