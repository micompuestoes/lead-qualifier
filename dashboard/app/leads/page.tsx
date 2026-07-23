'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { obtenerLeadsPagina, exportarLeadsCSV, type LeadCounts, type FiltrosLeads } from '@/lib/api';
import type { Lead, Clasificacion, EstadoLead } from '@/types/lead';
import { TEMP } from '@/lib/temperature';
import LeadCard from '@/components/LeadCard';
import { LeadCardSkeleton } from '@/components/Skeleton';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';
import PageHeader from '@/components/PageHeader';

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTADOS: (EstadoLead | 'TODOS')[] = ['TODOS', 'PENDIENTE', 'CONTACTADO', 'CERRADO', 'DESCARTADO'];

const ESTADO_CONFIG: Record<string, { label: string; dot: string | null }> = {
  TODOS:      { label: 'Todos',       dot: null      },
  PENDIENTE:  { label: 'Pendiente',   dot: '#c8a96e' },
  CONTACTADO: { label: 'Contactado',  dot: '#6ea8c8' },
  CERRADO:    { label: 'Cerrado',     dot: '#6ec87a' },
  DESCARTADO: { label: 'Descartado',  dot: '#9a9490' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function plural(n: number, singular: string, pluralStr: string) {
  return `${n} ${n === 1 ? singular : pluralStr}`;
}

const PAGE_SIZE = 24;   // leads por página

// ── Página ────────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const { getToken } = useAuth();
  const { c } = useTheme();
  const { addToast } = useToast();

  const [leads, setLeads]               = useState<Lead[]>([]);
  const [cargando, setCargando]         = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [filtroClasif, setFiltroClasif] = useState<Clasificacion | 'TODAS'>('TODAS');
  const [filtroEstado, setFiltroEstado] = useState<EstadoLead | 'TODOS'>('TODOS');
  const [busqueda, setBusqueda]         = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [busquedaFocus, setBusquedaFocus] = useState(false);
  const [plan, setPlan]                 = useState('free');
  const [offset, setOffset]             = useState(0);
  const [hayMas, setHayMas]             = useState(false);
  const [cargandoMas, setCargandoMas]   = useState(false);
  const [counts, setCounts]             = useState<LeadCounts>({ total: 0, calientes: 0, tibios: 0, frios: 0 });
  const [scope, setScope]               = useState<'mine' | 'all'>('all');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('inmuebia-perfil');
      if (raw) setPlan(JSON.parse(raw).plan ?? 'free');
    } catch {}
  }, []);

  const idsConocidos = useRef<Set<string>>(new Set());
  const pendingLeads = useRef<{ leads: Lead[]; counts: LeadCounts } | null>(null);
  const [leadsNuevos, setLeadsNuevos] = useState(0);

  // La búsqueda espera 350 ms de pausa de tecleo antes de ir al servidor
  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda.trim()), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Filtros activos → se resuelven en el SERVIDOR (buscan sobre todos los leads)
  const filtros: FiltrosLeads = {
    q:              busquedaDebounced || undefined,
    classification: filtroClasif !== 'TODAS' ? filtroClasif : undefined,
    status:         filtroEstado !== 'TODOS' ? filtroEstado : undefined,
  };
  const hayFiltros = Boolean(filtros.q || filtros.classification || filtros.status);

  // Recarga la primera página cada vez que cambian los filtros (y al montar)
  useEffect(() => { cargarLeads(); }, [busquedaDebounced, filtroClasif, filtroEstado]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cargando && leads.length > 0 && idsConocidos.current.size === 0)
      idsConocidos.current = new Set(leads.map(l => l.id));
  }, [cargando, leads]);

  // Polling de leads nuevos — solo sin filtros (con filtros compararía listas distintas)
  useEffect(() => {
    if (hayFiltros) return;
    const iv = setInterval(async () => {
      try {
        const data = await obtenerLeadsPagina(getToken, { limit: PAGE_SIZE, offset: 0 });
        const nuevos = data.leads.filter(l => !idsConocidos.current.has(l.id));
        if (nuevos.length > 0) {
          pendingLeads.current = { leads: data.leads, counts: data.counts };
          setLeadsNuevos(nuevos.length);
        }
      } catch { /* silencioso */ }
    }, 30_000);
    return () => clearInterval(iv);
  }, [hayFiltros]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cargarLeads() {
    try {
      setCargando(true); setError(null);
      const data = await obtenerLeadsPagina(getToken, { limit: PAGE_SIZE, offset: 0, ...filtros });
      setLeads(data.leads);
      setCounts(data.counts);
      setScope(data.scope);
      setOffset(data.leads.length);
      setHayMas(data.leads.length === PAGE_SIZE);
      idsConocidos.current = new Set(data.leads.map(l => l.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar leads');
    } finally { setCargando(false); }
  }

  async function cargarMas() {
    if (cargandoMas) return;
    try {
      setCargandoMas(true);
      const data = await obtenerLeadsPagina(getToken, { limit: PAGE_SIZE, offset, ...filtros });
      setLeads(prev => {
        const vistos = new Set(prev.map(l => l.id));
        const nuevos = data.leads.filter(l => !vistos.has(l.id));
        nuevos.forEach(l => idsConocidos.current.add(l.id));
        return [...prev, ...nuevos];
      });
      setOffset(prev => prev + data.leads.length);
      setHayMas(data.leads.length === PAGE_SIZE);
    } catch {
      addToast('No se pudieron cargar más leads', 'error');
    } finally { setCargandoMas(false); }
  }

  function aplicarLeadsNuevos() {
    const pend = pendingLeads.current;
    if (pend) {
      setLeads(pend.leads);
      setCounts(pend.counts);   // las métricas también se refrescan, no solo la lista
      setOffset(pend.leads.length);
      setHayMas(pend.leads.length === PAGE_SIZE);
      idsConocidos.current = new Set(pend.leads.map(l => l.id));
      pendingLeads.current = null;
    }
    setLeadsNuevos(0);
  }

  // Clic en tarjeta métrica: toggle de clasificación
  function toggleClasif(clasif: Clasificacion) {
    setFiltroClasif(prev => prev === clasif ? 'TODAS' : clasif);
  }

  async function handleExportCSV() {
    if (plan === 'free') {
      addToast('El export CSV requiere el plan Pro o Agencia', 'error');
      return;
    }
    try {
      // El servidor genera el CSV con TODOS los leads (sin corte de paginación),
      // aplicando los filtros activos: exportas exactamente lo que estás viendo.
      await exportarLeadsCSV(getToken, filtros);
      addToast(hayFiltros ? 'CSV exportado (con los filtros aplicados)' : 'CSV exportado', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'No se pudo exportar', 'error');
    }
  }

  // Cambio inline de estado desde la tarjeta
  function handleStatusChange(id: string, status: EstadoLead) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  }

  // ── Datos derivados ──────────────────────────────────────────────────────────

  // Totales REALES del backend (no solo lo paginado en pantalla)
  const { total, calientes, tibios, frios } = counts;

  // El filtrado y la búsqueda ya vienen resueltos del servidor
  const leadsFiltrados = leads;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="r-pad" style={{ padding: 32 }}>

      {/* Banner nuevos leads */}
      {leadsNuevos > 0 && (
        <button onClick={aplicarLeadsNuevos}
          className="animate-fade-up"
          style={{
            width: '100%', marginBottom: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: '#c8a96e', color: '#1a1814', border: 'none', cursor: 'pointer',
          }}>
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {plural(leadsNuevos, 'lead nuevo', 'leads nuevos')} — haz clic para actualizar
        </button>
      )}

      {/* Cabecera */}
      <PageHeader
        title={scope === 'mine' ? 'Mis leads' : 'Leads'}
        description={
          total === 0 ? (
            <p style={{ fontSize: 14, color: c.text2 }}>Sin leads todavía</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, color: c.text2 }}>{plural(total, 'lead', 'leads')}</span>
              {calientes > 0 && <><span style={{ color: c.divider }}>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: '#b45309' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#b45309', flexShrink: 0 }} />
                  {plural(calientes, 'caliente', 'calientes')}
                </span></>}
              {tibios > 0 && <><span style={{ color: c.divider }}>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: '#9a7a3a' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8a96e', flexShrink: 0 }} />
                  {plural(tibios, 'tibio', 'tibios')}
                </span></>}
              {frios > 0 && <><span style={{ color: c.divider }}>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: '#3a7a9a' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6ea8c8', flexShrink: 0 }} />
                  {plural(frios, 'frío', 'fríos')}
                </span></>}
            </div>
          )
        }
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Export CSV */}
            <button onClick={handleExportCSV}
              title={plan === 'free' ? 'Disponible en plan Pro o Agencia' : `Exportar ${leads.length} leads a CSV`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 500, padding: '9px 14px',
                borderRadius: 11, border: `1.5px solid ${c.inputBorder}`,
                background: 'transparent', color: plan === 'free' ? c.text3 : c.text2,
                cursor: plan === 'free' ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}>
              {plan === 'free' ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              )}
              CSV
            </button>

            {/* Nuevo lead */}
            <Link href="/nuevo-lead"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              fontSize: 14, fontWeight: 600, padding: '10px 18px',
              borderRadius: 12, textDecoration: 'none',
              background: '#c8a96e', color: '#1a1814',
              boxShadow: '0 2px 12px rgba(200,169,110,0.35)',
              transition: 'box-shadow 0.15s, opacity 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(200,169,110,0.5)';
              (e.currentTarget as HTMLElement).style.opacity   = '0.92';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(200,169,110,0.35)';
              (e.currentTarget as HTMLElement).style.opacity   = '1';
            }}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuevo lead
          </Link>
          </div>
        }
      />

      {/* ── Métricas (filtro de clasificación) ── */}
      <div className="r-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <MetricaCard
          label={TEMP.calientes.label} valor={calientes} total={total}
          color={TEMP.calientes.color} barColor={TEMP.calientes.accent} c={c}
          isActive={filtroClasif === 'CALIENTE'}
          isDimmed={filtroClasif !== 'TODAS' && filtroClasif !== 'CALIENTE'}
          onClick={() => toggleClasif('CALIENTE')}
        />
        <MetricaCard
          label={TEMP.tibios.label} valor={tibios} total={total}
          color={TEMP.tibios.color} barColor={TEMP.tibios.accent} c={c}
          isActive={filtroClasif === 'TIBIO'}
          isDimmed={filtroClasif !== 'TODAS' && filtroClasif !== 'TIBIO'}
          onClick={() => toggleClasif('TIBIO')}
        />
        <MetricaCard
          label={TEMP.frios.label} valor={frios} total={total}
          color={TEMP.frios.color} barColor={TEMP.frios.accent} c={c}
          isActive={filtroClasif === 'FRÍO'}
          isDimmed={filtroClasif !== 'TODAS' && filtroClasif !== 'FRÍO'}
          onClick={() => toggleClasif('FRÍO')}
        />
      </div>

      {/* Ayuda contextual */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -12, marginBottom: 18 }}>
        <Link href="/ayuda#cualificacion" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 12, color: c.text2, textDecoration: 'none',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          ¿Cómo se puntúan los leads?
        </Link>
      </div>

      {/* ── Buscador + Estado ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>

        {/* Buscador */}
        <div style={{ position: 'relative', flex: '0 0 220px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={busquedaFocus ? '#c8a96e' : c.text2} strokeWidth="2" strokeLinecap="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', transition: 'stroke 0.15s' }}>
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onFocus={() => setBusquedaFocus(true)}
            onBlur={() => setBusquedaFocus(false)}
            placeholder="Buscar leads…"
            style={{
              width: '100%', padding: '8px 12px 8px 34px',
              borderRadius: 11, fontSize: 13, outline: 'none',
              background: c.input, color: c.text1,
              border: busquedaFocus ? `1.5px solid ${c.inputFocus}` : `1.5px solid ${c.inputBorder}`,
              boxShadow: busquedaFocus ? '0 0 0 3px rgba(200,169,110,0.1)' : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: c.text2, padding: 2, display: 'flex',
              }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Segmented control de Estado */}
        <div style={{
          display: 'inline-flex', background: c.muted,
          border: `1px solid ${c.inputBorder}`, borderRadius: 13, padding: 4, gap: 2,
        }}>
          {ESTADOS.map(estado => {
            const activo = filtroEstado === estado;
            const cfg    = ESTADO_CONFIG[estado];
            return (
              <button key={estado}
                onClick={() => setFiltroEstado(estado)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 13px', borderRadius: 10,
                  fontSize: 12, fontWeight: activo ? 600 : 400,
                  background: activo ? c.card : 'transparent',
                  color: activo ? c.text1 : c.text2,
                  border: 'none', cursor: 'pointer',
                  boxShadow: activo ? '0 1px 6px rgba(26,24,20,0.09)' : 'none',
                  transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {cfg.dot && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: cfg.dot, opacity: activo ? 1 : 0.4,
                    transition: 'opacity 0.15s',
                  }} />
                )}
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Nº de resultados cuando hay filtros activos */}
        {hayFiltros && !cargando && (
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: c.text2 }}>
            {leadsFiltrados.length}{hayMas ? '+' : ''}{' '}
            {leadsFiltrados.length === 1 ? 'resultado' : 'resultados'}
          </span>
        )}
      </div>

      {/* ── Contenido ── */}
      {cargando ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => <LeadCardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div style={{
          borderRadius: 12, padding: 24, textAlign: 'center',
          background: 'rgba(180,83,9,0.05)', border: '1px solid rgba(180,83,9,0.15)',
        }}>
          <p style={{ fontWeight: 600, color: '#b45309', marginBottom: 8 }}>No se pudieron cargar los leads</p>
          <p style={{ fontSize: 13, color: c.text2, marginBottom: 16 }}>{error}</p>
          <button onClick={cargarLeads}
            style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: '#c8a96e', color: '#1a1814', border: 'none', cursor: 'pointer' }}>
            Reintentar
          </button>
        </div>
      ) : leadsFiltrados.length === 0 ? (
        <EmptyState sinLeads={total === 0} c={c}
          onLimpiarFiltros={hayFiltros ? () => { setFiltroClasif('TODAS'); setFiltroEstado('TODOS'); setBusqueda(''); } : undefined} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {leadsFiltrados.map((lead, i) => (
              <LeadCard key={lead.id} lead={lead} index={i} onStatusChange={handleStatusChange} />
            ))}
          </div>

          {/* Cargar más */}
          {hayMas && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
              <button onClick={cargarMas} disabled={cargandoMas}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '11px 24px', borderRadius: 12, fontSize: 13.5, fontWeight: 600,
                  background: c.card, color: c.text1, border: `1.5px solid ${c.inputBorder}`,
                  cursor: cargandoMas ? 'default' : 'pointer', opacity: cargandoMas ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!cargandoMas) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,169,110,0.5)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = c.inputBorder; }}
              >
                {cargandoMas ? (
                  <>
                    <span className="animate-spin" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(200,169,110,0.3)', borderTopColor: '#c8a96e' }} />
                    Cargando…
                  </>
                ) : 'Cargar más leads'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Métrica card ──────────────────────────────────────────────────────────────

function MetricaCard({ label, valor, total, color, barColor, c, isActive, isDimmed, onClick }: {
  label: string; valor: number; total: number;
  color: string; barColor: string;
  c: ReturnType<typeof useTheme>['c'];
  isActive: boolean; isDimmed: boolean;
  onClick: () => void;
}) {
  const porcentaje = total > 0 ? Math.round((valor / total) * 100) : 0;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-label={`Filtrar por ${label.toLowerCase()}`}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
      style={{
        background:  isActive ? `${color}0d` : c.card,
        border:      isActive ? `1.5px solid ${color}` : c.cardBorder,
        boxShadow:   isActive ? `0 6px 24px ${color}28` : '0 1px 4px rgba(26,24,20,0.04)',
        opacity:     isDimmed ? 0.38 : 1,
        transform:   isActive ? 'translateY(-1px)' : 'none',
        cursor:      'pointer', transition: 'all 0.2s ease',
        userSelect:  'none', borderRadius: 12, overflow: 'hidden',
      }}
    >
      <div style={{
        height: isActive ? 4 : 3,
        background: `linear-gradient(90deg, ${color}, ${color}50)`,
        opacity: total === 0 ? 0.25 : (isActive ? 1 : 0.65),
        transition: 'height 0.2s, opacity 0.2s',
      }} />
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: isActive ? color : c.text2, transition: 'color 0.2s',
          }}>{label}</p>
          {isActive && (
            <span style={{
              width: 18, height: 18, borderRadius: '50%', background: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="9" height="9" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 14 }}>
          <p style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: total === 0 ? c.text3 : color }}>
            {total === 0 ? '—' : valor}
          </p>
          {total > 0 && <p style={{ fontSize: 14, color: c.text2, paddingBottom: 4 }}>{porcentaje}%</p>}
        </div>
        <div style={{ height: 3, borderRadius: 2, overflow: 'hidden', background: 'rgba(200,169,110,0.1)' }}>
          <div style={{
            height: '100%', borderRadius: 2, width: `${porcentaje}%`, background: barColor,
            transition: 'width 0.7s ease',
          }} />
        </div>
      </div>
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
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 32px', textAlign: 'center',
    }} className="animate-fade-up">
      <div style={{
        width: 72, height: 72, borderRadius: 20, marginBottom: 20,
        background: 'rgba(200,169,110,0.08)', border: '1.5px solid rgba(200,169,110,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="36" height="36" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="rgba(200,169,110,0.55)">
          {sinLeads ? (
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
          )}
        </svg>
      </div>
      <h2 style={{ fontSize: 17, color: c.text1, marginBottom: 8 }}>
        {sinLeads ? 'Aún no hay leads aquí' : 'Ningún lead coincide con los filtros'}
      </h2>
      <p style={{ fontSize: 13, color: c.text2, marginBottom: 28, maxWidth: 340, lineHeight: 1.65 }}>
        {sinLeads
          ? 'Cualifica tu primer lead y aparecerá aquí con su clasificación y email generado por la IA.'
          : 'Prueba a cambiar o limpiar los filtros activos para ver más resultados.'}
      </p>
      {sinLeads ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/nuevo-lead?demo=1" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 22px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: '#c8a96e', color: '#1a1814', textDecoration: 'none',
            boxShadow: '0 2px 12px rgba(200,169,110,0.35)',
          }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            Probar con un ejemplo
          </Link>
          <Link href="/nuevo-lead" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 22px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            border: `1.5px solid ${c.inputBorder}`, color: c.text1,
            background: 'transparent', textDecoration: 'none',
          }}>
            Cualificar un lead real
          </Link>
        </div>
      ) : (
        <button onClick={onLimpiarFiltros}
          style={{
            padding: '10px 22px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: c.btnActive, color: c.btnActiveTxt, border: 'none', cursor: 'pointer',
          }}>
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
