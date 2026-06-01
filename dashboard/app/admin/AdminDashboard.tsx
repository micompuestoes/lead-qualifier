'use client';

import { useMemo, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import PageHeader from '@/components/PageHeader';

// ── Tipos ───────────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  email: string;
  name: string;
  plan: string;
  status: 'active' | 'cancelled';
  lead_count: number;
  created_at: string;
  cancelled_at?: string;
}

type EstadoFiltro = 'TODOS' | 'active' | 'cancelled';
type PlanFiltro   = 'TODOS' | 'free' | 'pro' | 'agencia';
type SortKey      = 'created' | 'leads' | 'name';
type SortDir      = 'asc' | 'desc';

const PLAN_PRICE: Record<string, number> = { free: 0, pro: 49, agencia: 99 };
const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', agencia: 'Agencia' };

const PLAN_STYLE: Record<string, { bg: string; color: string }> = {
  free:    { bg: 'rgba(122,116,104,0.12)', color: '#9a9490' },
  pro:     { bg: 'rgba(200,169,110,0.16)', color: '#9a7a3a' },
  agencia: { bg: 'rgba(200,169,110,0.24)', color: '#9a7a3a' },
};

const ESTADOS: { id: EstadoFiltro; label: string; dot: string | null }[] = [
  { id: 'TODOS',     label: 'Todas',      dot: null      },
  { id: 'active',    label: 'Activas',    dot: '#6ec87a' },
  { id: 'cancelled', label: 'Canceladas', dot: '#c8796e' },
];

const PLANES: { id: PlanFiltro; label: string }[] = [
  { id: 'TODOS',   label: 'Todos'   },
  { id: 'free',    label: 'Free'    },
  { id: 'pro',     label: 'Pro'     },
  { id: 'agencia', label: 'Agencia' },
];

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Componente ──────────────────────────────────────────────────────────────

export default function AdminDashboard({ tenants: inicial, error }: { tenants: Tenant[]; error: string | null }) {
  const { c } = useTheme();

  const [tenants, setTenants]   = useState<Tenant[]>(inicial);
  const [loading, setLoading]   = useState<string | null>(null);
  const [query, setQuery]       = useState('');
  const [estado, setEstado]     = useState<EstadoFiltro>('TODOS');
  const [plan, setPlan]         = useState<PlanFiltro>('TODOS');
  const [sortKey, setSortKey]   = useState<SortKey>('created');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');
  const [queryFocus, setQueryFocus] = useState(false);

  async function cambiarEstado(tenantId: string, nuevoEstado: 'active' | 'cancelled') {
    setLoading(tenantId);
    try {
      const res = await fetch(`/api/admin/tenant-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, status: nuevoEstado }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      setTenants(prev => prev.map(t =>
        t.id === tenantId
          ? { ...t, status: nuevoEstado, cancelled_at: nuevoEstado === 'cancelled' ? new Date().toISOString() : undefined }
          : t,
      ));
    } catch {
      alert('No se pudo cambiar el estado. Comprueba que ADMIN_SECRET_KEY está configurada.');
    } finally {
      setLoading(null);
    }
  }

  // ── Métricas ──
  const metrics = useMemo(() => {
    const total      = tenants.length;
    const activos    = tenants.filter(t => t.status === 'active').length;
    const cancelados = tenants.filter(t => t.status === 'cancelled').length;
    const mrr        = tenants
      .filter(t => t.status === 'active')
      .reduce((sum, t) => sum + (PLAN_PRICE[t.plan] ?? 0), 0);
    return { total, activos, cancelados, mrr };
  }, [tenants]);

  // ── Lista filtrada + ordenada ──
  const visibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtrados = tenants.filter(t => {
      const pasaQuery  = q === '' || [t.name, t.email, t.id].some(f => f?.toLowerCase().includes(q));
      const pasaEstado = estado === 'TODOS' || t.status === estado;
      const pasaPlan   = plan === 'TODOS' || t.plan === plan;
      return pasaQuery && pasaEstado && pasaPlan;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      if (sortKey === 'leads') return (a.lead_count - b.lead_count) * dir;
      if (sortKey === 'name')  return (a.name || a.email).localeCompare(b.name || b.email) * dir;
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
    });
  }, [tenants, query, estado, plan, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  }

  const hayFiltros = query !== '' || estado !== 'TODOS' || plan !== 'TODOS';

  // ── Estilos reutilizables ──
  const cardStyle: React.CSSProperties = { background: c.card, border: c.cardBorder, borderRadius: 14, padding: 18 };
  const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '12px 18px', fontSize: 10, fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: c.text2, userSelect: 'none',
  };

  const metricCards = [
    { label: 'Total empresas', value: String(metrics.total),       color: c.text1 },
    { label: 'Activas',        value: String(metrics.activos),     color: '#3a8a4a' },
    { label: 'Canceladas',     value: String(metrics.cancelados),  color: '#c8796e' },
    { label: 'MRR estimado',   value: `${metrics.mrr}€`,           color: '#9a7a3a', sub: 'ingresos mensuales' },
  ];

  return (
    <div style={{ padding: 32, maxWidth: 1080, margin: '0 auto' }}>

      <PageHeader
        eyebrow="Administración"
        title="Empresas"
        description="Gestiona todas las cuentas registradas en la plataforma"
      />

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.2)',
          borderRadius: 12, padding: 16, marginBottom: 24, fontSize: 13, color: '#b45309',
        }}>
          <strong>Error:</strong> {error}
          {error.includes('ADMIN_SECRET_KEY') && (
            <p style={{ marginTop: 4, color: '#9a5a2a' }}>
              Añade <code style={{ background: 'rgba(180,83,9,0.12)', padding: '1px 5px', borderRadius: 4 }}>ADMIN_SECRET_KEY</code> en Vercel → Settings → Environment Variables.
            </p>
          )}
        </div>
      )}

      {/* ── Métricas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {metricCards.map(m => (
          <div key={m.label} style={cardStyle}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.text2, marginBottom: 8 }}>
              {m.label}
            </p>
            <p style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: m.color }}>{m.value}</p>
            {m.sub && <p style={{ fontSize: 11, color: c.text3, marginTop: 5 }}>{m.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Barra de búsqueda + filtros ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* Buscador */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke={queryFocus ? '#c8a96e' : c.text2} strokeWidth="2" strokeLinecap="round"
            style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', transition: 'stroke 0.15s' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setQueryFocus(true)}
            onBlur={() => setQueryFocus(false)}
            placeholder="Buscar por empresa, email o ID…"
            style={{
              width: '100%', padding: '9px 12px 9px 36px', borderRadius: 11, fontSize: 13,
              outline: 'none', background: c.input, color: c.text1,
              border: queryFocus ? `1.5px solid ${c.inputFocus}` : `1.5px solid ${c.inputBorder}`,
              boxShadow: queryFocus ? '0 0 0 3px rgba(200,169,110,0.1)' : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: c.text2, display: 'flex', padding: 2 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Filtro de estado */}
        <Segmented
          c={c}
          options={ESTADOS.map(e => ({ id: e.id, label: e.label, dot: e.dot }))}
          value={estado}
          onChange={v => setEstado(v as EstadoFiltro)}
        />

        {/* Filtro de plan */}
        <Segmented
          c={c}
          options={PLANES.map(p => ({ id: p.id, label: p.label, dot: null }))}
          value={plan}
          onChange={v => setPlan(v as PlanFiltro)}
        />
      </div>

      {/* Contador de resultados */}
      <p style={{ fontSize: 12, color: c.text2, marginBottom: 14 }}>
        Mostrando <strong style={{ color: c.text1 }}>{visibles.length}</strong> de {tenants.length} empresas
        {hayFiltros && (
          <button onClick={() => { setQuery(''); setEstado('TODOS'); setPlan('TODOS'); }}
            style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#9a7a3a', fontSize: 12, textDecoration: 'underline' }}>
            Limpiar filtros
          </button>
        )}
      </p>

      {/* ── Tabla ── */}
      {visibles.length > 0 ? (
        <div style={{ background: c.card, border: c.cardBorder, borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${c.divider}`, background: c.muted }}>
                <SortableTh label="Empresa" active={sortKey === 'name'}  dir={sortDir} onClick={() => toggleSort('name')}  style={thStyle} c={c} />
                <th style={thStyle}>Plan</th>
                <SortableTh label="Leads"   active={sortKey === 'leads'} dir={sortDir} onClick={() => toggleSort('leads')} style={{ ...thStyle, textAlign: 'center' }} c={c} center />
                <SortableTh label="Registro" active={sortKey === 'created'} dir={sortDir} onClick={() => toggleSort('created')} style={thStyle} c={c} />
                <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((t, i) => {
                const ps = PLAN_STYLE[t.plan] ?? PLAN_STYLE.free;
                return (
                  <tr key={t.id}
                    style={{ borderBottom: i < visibles.length - 1 ? `1px solid ${c.divider}` : 'none', transition: 'background 0.12s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,110,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {/* Empresa */}
                    <td style={{ padding: '14px 18px' }}>
                      <p style={{ fontWeight: 600, color: c.text1 }}>{t.name || '—'}</p>
                      <p style={{ fontSize: 12, color: c.text2, marginTop: 1 }}>{t.email}</p>
                    </td>
                    {/* Plan */}
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: ps.bg, color: ps.color }}>
                        {PLAN_LABEL[t.plan] ?? t.plan}
                      </span>
                    </td>
                    {/* Leads */}
                    <td style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 600, color: c.text1, fontVariantNumeric: 'tabular-nums' }}>
                      {t.lead_count}
                    </td>
                    {/* Registro */}
                    <td style={{ padding: '14px 18px', color: c.text2 }}>{formatDate(t.created_at)}</td>
                    {/* Estado */}
                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      {t.status === 'active' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: 'rgba(110,200,122,0.12)', color: '#3a8a4a' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6ec87a' }} />
                          Activa
                        </span>
                      ) : (
                        <div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: 'rgba(200,121,110,0.12)', color: '#b45309' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8796e' }} />
                            Cancelada
                          </span>
                          {t.cancelled_at && (
                            <p style={{ fontSize: 11, color: c.text3, marginTop: 2 }}>{formatDate(t.cancelled_at)}</p>
                          )}
                        </div>
                      )}
                    </td>
                    {/* Acción */}
                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      {loading === t.id ? (
                        <div className="animate-spin" style={{ width: 15, height: 15, margin: '0 auto', borderRadius: '50%', border: '2px solid rgba(200,169,110,0.3)', borderTopColor: '#c8a96e' }} />
                      ) : t.status === 'active' ? (
                        <button onClick={() => cambiarEstado(t.id, 'cancelled')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#b45309' }}>
                          Cancelar
                        </button>
                      ) : (
                        <button onClick={() => cambiarEstado(t.id, 'active')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#3a8a4a' }}>
                          Reactivar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: '56px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: c.text1, marginBottom: 6 }}>
            {tenants.length === 0 ? 'Aún no hay empresas registradas' : 'Ninguna empresa coincide con los filtros'}
          </p>
          <p style={{ fontSize: 13, color: c.text2 }}>
            {tenants.length === 0
              ? 'Cuando alguien se registre aparecerá aquí.'
              : 'Prueba a cambiar la búsqueda o limpiar los filtros.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function SortableTh({ label, active, dir, onClick, style, c, center }: {
  label: string; active: boolean; dir: SortDir; onClick: () => void;
  style: React.CSSProperties; c: ReturnType<typeof useTheme>['c']; center?: boolean;
}) {
  return (
    <th style={style}>
      <button onClick={onClick}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
          cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit',
          color: active ? '#9a7a3a' : c.text2, padding: 0, margin: center ? '0 auto' : 0,
        }}>
        {label}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity: active ? 1 : 0.3, transform: active && dir === 'asc' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s, opacity 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
    </th>
  );
}

function Segmented({ options, value, onChange, c }: {
  options: { id: string; label: string; dot: string | null }[];
  value: string;
  onChange: (v: string) => void;
  c: ReturnType<typeof useTheme>['c'];
}) {
  return (
    <div style={{ display: 'inline-flex', background: c.muted, border: `1px solid ${c.inputBorder}`, borderRadius: 12, padding: 3, gap: 2 }}>
      {options.map(o => {
        const activo = value === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9,
              fontSize: 12.5, fontWeight: activo ? 600 : 400, whiteSpace: 'nowrap',
              background: activo ? c.card : 'transparent', color: activo ? c.text1 : c.text2,
              border: 'none', cursor: 'pointer',
              boxShadow: activo ? '0 1px 5px rgba(26,24,20,0.08)' : 'none',
              transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
            }}>
            {o.dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: o.dot, opacity: activo ? 1 : 0.45 }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
