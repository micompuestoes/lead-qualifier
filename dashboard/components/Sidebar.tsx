'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconLeads() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconAd() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}

function IconStats() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function IconAdmin() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  );
}

// ── Types & config ─────────────────────────────────────────────────────────────

interface NavLink { href: string; label: string; icon: React.ReactNode }
interface Perfil  { plan: string; name: string; is_admin: boolean }

const planConfig: Record<string, { label: string; bg: string; color: string }> = {
  free:    { label: 'Gratuito', bg: 'rgba(122,116,104,0.1)',  color: '#9a9490' },
  pro:     { label: 'Pro',      bg: 'rgba(200,169,110,0.15)', color: '#9a7a3a' },
  agencia: { label: 'Agencia',  bg: 'rgba(200,169,110,0.18)', color: '#9a7a3a' },
};

const principalLinks: NavLink[] = [
  { href: '/leads',      label: 'Leads',      icon: <IconLeads /> },
  { href: '/nuevo-lead', label: 'Nuevo lead', icon: <IconPlus />  },
];
const herramientasLinks: NavLink[] = [
  { href: '/anuncios',     label: 'Anuncios IA',  icon: <IconAd />    },
  { href: '/estadisticas', label: 'Estadísticas', icon: <IconStats /> },
];
const cuentaLinks: NavLink[] = [
  { href: '/perfil', label: 'Mi perfil', icon: <IconProfile /> },
];

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      padding: '0 12px',
      marginBottom: 4,
      fontSize: 10,
      fontWeight: 700,
      color: 'rgba(200,169,110,0.55)',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      userSelect: 'none',
    }}>
      {children}
    </p>
  );
}

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      className="relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150"
      style={{
        padding: '9px 12px',
        color:      active ? '#1a1814' : '#9a9490',
        background: active ? 'rgba(200,169,110,0.11)' : 'transparent',
        fontWeight: active ? 600 : 500,
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = '#1a1814';
          (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,110,0.07)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = '#9a9490';
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }
      }}
    >
      {/* Active left bar */}
      {active && (
        <span style={{
          position: 'absolute', left: 0,
          top: '50%', transform: 'translateY(-50%)',
          width: 3, height: 20,
          borderRadius: '0 3px 3px 0',
          background: 'linear-gradient(180deg, #d4b87a, #c8a96e)',
        }} />
      )}
      {/* Icon */}
      <span style={{ color: active ? '#c8a96e' : 'inherit', flexShrink: 0, display: 'flex' }}>
        {link.icon}
      </span>
      <span className="truncate">{link.label}</span>
    </Link>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname     = usePathname();
  const { getToken } = useAuth();
  const [perfil, setPerfil] = useState<Perfil>({ plan: 'free', name: '', is_admin: false });

  useEffect(() => {
    async function cargarPerfil() {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json();
          setPerfil({ plan: d.plan ?? 'free', name: d.name ?? '', is_admin: d.is_admin ?? false });
        }
      } catch { /* silencioso */ }
    }
    cargarPerfil();
  }, [getToken]);

  const esActivo = (href: string) =>
    href === '/leads' ? pathname.startsWith('/leads') : pathname === href;

  const esAuth        = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
  const esFormPublico = pathname.startsWith('/form/');
  if (esAuth || esFormPublico) return null;

  const plan = planConfig[perfil.plan] ?? planConfig.free;

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-60 flex flex-col z-10"
      style={{
        background: '#ffffff',
        borderRight: '1px solid rgba(200,169,110,0.2)',
        boxShadow: '2px 0 20px rgba(26,24,20,0.04)',
      }}
    >
      {/* ── Brand ── */}
      <Link
        href="/leads"
        className="px-5 py-5 flex flex-col gap-3 shrink-0 transition-opacity hover:opacity-80"
        style={{ borderBottom: '1px solid rgba(200,169,110,0.12)' }}
      >
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #c8a96e 0%, #a8895a 100%)',
            boxShadow: '0 4px 12px rgba(200,169,110,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth={2.2} stroke="white">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1814', lineHeight: 1.3 }} className="truncate">
              {perfil.name || 'Lead Qualifier'}
            </p>
            <p style={{ fontSize: 11, color: '#b8a898', marginTop: 1 }}>Agente de IA</p>
          </div>
        </div>

        {/* Plan badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 99,
          fontSize: 11, fontWeight: 600,
          background: plan.bg, color: plan.color,
          alignSelf: 'flex-start',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: plan.color, flexShrink: 0 }} />
          Plan {plan.label}
        </span>
      </Link>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>

        <SectionLabel>Principal</SectionLabel>
        {principalLinks.map(l => <NavItem key={l.href} link={l} active={esActivo(l.href)} />)}

        {perfil.plan === 'agencia' && (
          <>
            <div style={{ marginTop: 18 }}>
              <SectionLabel>Herramientas</SectionLabel>
            </div>
            {herramientasLinks.map(l => <NavItem key={l.href} link={l} active={esActivo(l.href)} />)}
          </>
        )}

        <div style={{ marginTop: 18 }}>
          <SectionLabel>Cuenta</SectionLabel>
        </div>
        {cuentaLinks.map(l => <NavItem key={l.href} link={l} active={esActivo(l.href)} />)}
        {perfil.is_admin && (
          <NavItem
            link={{ href: '/admin', label: 'Empresas', icon: <IconAdmin /> }}
            active={pathname.startsWith('/admin')}
          />
        )}
      </nav>

      {/* ── Upgrade CTA ── */}
      {perfil.plan !== 'agencia' && (
        <div style={{ padding: '0 12px 12px' }}>
          <Link
            href="/pricing"
            className="block rounded-2xl transition-all duration-200"
            style={{
              padding: '14px 16px',
              background: 'linear-gradient(135deg, rgba(200,169,110,0.1) 0%, rgba(200,169,110,0.03) 100%)',
              border: '1px solid rgba(200,169,110,0.22)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = 'rgba(200,169,110,0.45)';
              el.style.background = 'linear-gradient(135deg, rgba(200,169,110,0.16) 0%, rgba(200,169,110,0.06) 100%)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = 'rgba(200,169,110,0.22)';
              el.style.background = 'linear-gradient(135deg, rgba(200,169,110,0.1) 0%, rgba(200,169,110,0.03) 100%)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" strokeWidth={2.2} stroke="#c8a96e">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#9a7a3a' }}>
                  {perfil.plan === 'free' ? 'Mejorar a Pro' : 'Mejorar a Agencia'}
                </span>
              </div>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="rgba(200,169,110,0.5)">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(154,122,58,0.65)', lineHeight: 1.45 }}>
              {perfil.plan === 'free'
                ? 'Más leads, IA avanzada y sin límites'
                : 'Anuncios IA y estadísticas avanzadas'}
            </p>
          </Link>
        </div>
      )}

      {/* ── User ── */}
      <div
        style={{
          padding: '14px 20px',
          borderTop: '1px solid rgba(200,169,110,0.12)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8',
              userButtonPopoverCard: 'shadow-2xl',
            },
          }}
        />
        <p style={{ fontSize: 12, color: '#b8a898', fontWeight: 500 }}>Mi cuenta</p>
      </div>
    </aside>
  );
}
