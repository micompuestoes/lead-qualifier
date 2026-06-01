'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useAuth } from '@clerk/nextjs';
import { obtenerLeads, apiFetch } from '@/lib/api';
import type { Lead, EstadoLead } from '@/types/lead';
import LeadCard from '@/components/LeadCard';
import { KpiSkeleton, LeadCardSkeleton } from '@/components/Skeleton';
import OnboardingChecklist, { type OnbStep } from '@/components/OnboardingChecklist';
import { useTheme } from '@/components/ThemeProvider';
import PageHeader from '@/components/PageHeader';

// ── Helpers ───────────────────────────────────────────────────────────────────

function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function fechaHoy(): string {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Acciones rápidas ──────────────────────────────────────────────────────────

const ACCIONES = [
  {
    href:  '/nuevo-lead',
    label: 'Cualificar lead',
    desc:  'Analiza y puntúa un nuevo contacto con IA',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="19" y1="8" x2="19" y2="14"/>
        <line x1="22" y1="11" x2="16" y2="11"/>
      </svg>
    ),
  },
  {
    href:  '/anuncios',
    label: 'Generar anuncio',
    desc:  'Redacta textos para Idealista, RRSS o email',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
  {
    href:  '/estadisticas',
    label: 'Estadísticas',
    desc:  'Analiza tu cartera y tendencias mensuales',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
      </svg>
    ),
  },
];

// ── Página principal ──────────────────────────────────────────────────────────

export default function HomePage() {
  const { user }     = useUser();
  const { getToken } = useAuth();
  const { c }        = useTheme();

  const [leads, setLeads]       = useState<Lead[]>([]);
  const [cargando, setCargando] = useState(true);

  // Estado para el onboarding
  const [setup, setSetup] = useState({ name: '', plan: 'free', imap: false });
  const [setupCargado, setSetupCargado] = useState(false);

  useEffect(() => {
    obtenerLeads(getToken)
      .then(setLeads)
      .catch(() => {})
      .finally(() => setCargando(false));

    // Info de configuración para el onboarding (no bloquea la UI principal)
    (async () => {
      try {
        const [meRes, imapRes] = await Promise.all([
          apiFetch('/me', getToken),
          apiFetch('/me/imap', getToken),
        ]);
        const next = { name: '', plan: 'free', imap: false };
        if (meRes.ok)   { const d = await meRes.json(); next.name = d.name ?? ''; next.plan = d.plan ?? 'free'; }
        if (imapRes.ok) { const i = await imapRes.json(); next.imap = !!i.configured; }
        setSetup(next);
      } catch { /* silencioso */ }
      finally { setSetupCargado(true); }
    })();
  }, [getToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stats computados desde los leads
  const total = leads.length;
  const ahora = new Date();
  const estesMes = leads.filter(l => {
    const d = new Date(l.created_at);
    return d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth();
  }).length;
  const conScore = leads.filter(l => l.score !== null);
  const scoreMedio = conScore.length > 0
    ? (conScore.reduce((s, l) => s + (l.score ?? 0), 0) / conScore.length).toFixed(1)
    : null;
  const ultimosLeads = leads.slice(0, 3);

  // Actualizar estado desde home
  function handleStatusChange(id: string, status: EstadoLead) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  }

  const nombre = user?.firstName ?? '';

  // ── Onboarding: pasos de configuración ──
  const pasosOnboarding: OnbStep[] = [
    { label: 'Configura tu empresa', desc: 'Nombre comercial y email de notificaciones', done: !!setup.name, href: '/perfil', cta: 'Configurar' },
    { label: 'Comparte tu formulario de captación', desc: 'Pega el enlace en tu web para recibir leads', done: total > 0, href: '/perfil', cta: 'Ver enlace' },
    ...(setup.plan === 'pro' || setup.plan === 'agencia'
      ? [{ label: 'Conecta tu bandeja de entrada', desc: 'Convierte tus emails en leads automáticamente', done: setup.imap, href: '/perfil', cta: 'Conectar' }]
      : []),
    { label: 'Cualifica tu primer lead', desc: 'Pruébalo con un contacto real', done: total > 0, href: '/nuevo-lead', cta: 'Empezar' },
  ];
  const onboardingCompleto = pasosOnboarding.every(p => p.done);
  const mostrarOnboarding = !cargando && setupCargado && !onboardingCompleto;

  const cardStyle = {
    background: c.card, border: c.cardBorder, borderRadius: 14, padding: 20,
  };

  const kpis = [
    {
      label: 'Total leads', value: total, sub: 'todos los tiempos',
      subColor: c.text2,
    },
    {
      label: 'Este mes', value: estesMes,
      sub: ahora.toLocaleDateString('es-ES', { month: 'long' }),
      subColor: c.text2,
    },
    {
      label: 'Score medio', value: scoreMedio ?? '—',
      sub: scoreMedio ? 'sobre 10' : 'sin datos aún',
      subColor: c.text2,
    },
  ];

  return (
    <div style={{ padding: 32, maxWidth: 1024, margin: '0 auto' }}>

      {/* ── Cabecera personalizada ── */}
      <PageHeader
        eyebrow={fechaHoy()}
        title={nombre ? `${saludo()}, ${nombre}` : saludo()}
        description="Aquí tienes el resumen de tu actividad"
        action={
          <Link href="/nuevo-lead" style={{
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
        }
      />

      {/* ── Onboarding (solo si la configuración no está completa) ── */}
      {mostrarOnboarding && <OnboardingChecklist steps={pasosOnboarding} />}

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {cargando
          ? Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)
          : kpis.map(kpi => (
              <div key={kpi.label} style={cardStyle}>
                <p style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: c.text2, marginBottom: 12,
                }}>
                  {kpi.label}
                </p>
                <p style={{ fontSize: 42, fontWeight: 700, lineHeight: 1, color: c.text1, marginBottom: 6 }}>
                  {kpi.value}
                </p>
                <p style={{ fontSize: 12, color: kpi.subColor }}>{kpi.sub}</p>
              </div>
            ))
        }
      </div>

      {/* ── Últimos leads ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.text2 }}>
              Últimos leads
            </p>
            {!cargando && total > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: 'rgba(200,169,110,0.1)', color: '#9a7a3a',
              }}>
                {total}
              </span>
            )}
          </div>
          {total > 0 && (
            <Link href="/leads" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 600, color: '#c8a96e', textDecoration: 'none',
              transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              Ver todos
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </Link>
          )}
        </div>

        {cargando ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
            {Array.from({ length: 3 }).map((_, i) => <LeadCardSkeleton key={i} />)}
          </div>
        ) : total === 0 ? (
          <div style={{
            ...cardStyle, textAlign: 'center', padding: '48px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'rgba(200,169,110,0.08)', border: '1.5px solid rgba(200,169,110,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="26" height="26" fill="none" viewBox="0 0 24 24" strokeWidth={1.3} stroke="rgba(200,169,110,0.6)">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: c.text1 }}>Todavía no hay leads</p>
            <p style={{ fontSize: 12, color: c.text2, maxWidth: 280, lineHeight: 1.6 }}>
              Cualifica tu primer contacto y aparecerá aquí con su análisis de IA.
            </p>
            <Link href="/nuevo-lead" style={{
              marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 11, fontSize: 13, fontWeight: 600,
              background: '#c8a96e', color: '#1a1814', textDecoration: 'none',
              boxShadow: '0 2px 10px rgba(200,169,110,0.3)',
            }}>
              Cualificar primer lead
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
            {ultimosLeads.map((lead, i) => (
              <LeadCard key={lead.id} lead={lead} index={i} onStatusChange={handleStatusChange} />
            ))}
          </div>
        )}
      </div>

      {/* ── Acceso rápido ── */}
      <div>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: c.text2, marginBottom: 14,
        }}>
          Acceso rápido
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {ACCIONES.map(accion => (
            <Link key={accion.href} href={accion.href} style={{ textDecoration: 'none' }}>
              <div style={{
                ...cardStyle, padding: '18px 20px',
                display: 'flex', alignItems: 'flex-start', gap: 14,
                cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
              }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'rgba(200,169,110,0.45)';
                  el.style.boxShadow   = '0 4px 20px rgba(200,169,110,0.1)';
                  el.style.transform   = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = '';
                  el.style.boxShadow   = '';
                  el.style.transform   = 'translateY(0)';
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                  background: 'rgba(200,169,110,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#c8a96e',
                }}>
                  {accion.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: c.text1, marginBottom: 3 }}>
                    {accion.label}
                  </p>
                  <p style={{ fontSize: 11, color: c.text2, lineHeight: 1.4 }}>
                    {accion.desc}
                  </p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={c.text2} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
