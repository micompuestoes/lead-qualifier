'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconLeads() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconAd() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}

function IconStats() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function IconAdmin() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  );
}

function IconLightning() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

// ── Types & config ────────────────────────────────────────────────────────────

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface Perfil {
  plan: string;
  name: string;
  is_admin: boolean;
}

const planConfig: Record<string, { label: string; bg: string; color: string }> = {
  free:    { label: 'Gratuito', bg: 'rgba(122,116,104,0.2)',  color: '#9a9490' },
  pro:     { label: 'Pro',      bg: 'rgba(200,169,110,0.2)',  color: '#c8a96e' },
  agencia: { label: 'Agencia',  bg: 'rgba(200,169,110,0.25)', color: '#d4b87a' },
};

const principalLinks: NavLink[] = [
  { href: '/leads',      label: 'Leads',      icon: <IconLeads /> },
  { href: '/nuevo-lead', label: 'Nuevo lead', icon: <IconPlus />  },
];

const herramientasLinks: NavLink[] = [
  { href: '/anuncios',    label: 'Anuncios IA',  icon: <IconAd />    },
  { href: '/estadisticas', label: 'Estadísticas', icon: <IconStats /> },
];

const cuentaLinks: NavLink[] = [
  { href: '/perfil', label: 'Mi perfil', icon: <IconProfile /> },
];

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 mb-1.5 mt-0.5 text-xs font-semibold tracking-widest uppercase select-none"
      style={{ color: 'rgba(200,169,110,0.35)', letterSpacing: '0.1em' }}>
      {children}
    </p>
  );
}

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
      style={{
        color:      active ? '#f5f0e8' : '#6e6660',
        background: active ? 'rgba(200,169,110,0.13)' : 'transparent',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = '#c8baa8';
          (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,110,0.07)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = '#6e6660';
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }
      }}
    >
      {/* Left active bar */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
          style={{ background: 'linear-gradient(180deg, #d4b87a 0%, #c8a96e 100%)' }} />
      )}
      {/* Icon */}
      <span style={{ color: active ? '#c8a96e' : 'inherit', flexShrink: 0 }}>
        {link.icon}
      </span>
      <span className="truncate">{link.label}</span>
    </Link>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname  = usePathname();
  const { getToken } = useAuth();
  const [perfil, setPerfil] = useState<Perfil>({ plan: 'free', name: '', is_admin: false });

  useEffect(() => {
    async function cargarPerfil() {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setPerfil({ plan: data.plan ?? 'free', name: data.name ?? '', is_admin: data.is_admin ?? false });
        }
      } catch { /* silencioso */ }
    }
    cargarPerfil();
  }, [getToken]);

  const esActivo = (href: string) =>
    href === '/leads' ? pathname.startsWith('/leads') : pathname === href;

  const esAuth       = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
  const esFormPublico = pathname.startsWith('/form/');
  if (esAuth || esFormPublico) return null;

  const plan = planConfig[perfil.plan] ?? planConfig.free;

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-60 flex flex-col z-10 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #211e18 0%, #1d1a14 60%, #1a1814 100%)',
        borderRight: '1px solid rgba(200,169,110,0.1)',
      }}
    >
      {/* Subtle noise overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.015\'/%3E%3C/svg%3E")', opacity: 0.4 }} />

      {/* ── Brand ── */}
      <Link
        href="/leads"
        className="relative px-5 py-5 flex flex-col gap-3 transition-opacity hover:opacity-90 shrink-0"
        style={{ borderBottom: '1px solid rgba(200,169,110,0.1)' }}
      >
        <div className="flex items-center gap-3">
          {/* Logo icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #c8a96e 0%, #a8895a 100%)',
              boxShadow: '0 4px 12px rgba(200,169,110,0.3)',
            }}
          >
            <svg className="w-4.5 h-4.5" width="18" height="18" viewBox="0 0 24 24"
              fill="none" strokeWidth={2.2} stroke="white">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>

          {/* Name + subtitle */}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-tight truncate" style={{ color: '#f0e8d8' }}>
              {perfil.name || 'Lead Qualifier'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#5a5450' }}>Agente de IA</p>
          </div>
        </div>

        {/* Plan badge */}
        <div
          className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ background: plan.bg, color: plan.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: plan.color }} />
          Plan {plan.label}
        </div>
      </Link>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">

        {/* PRINCIPAL */}
        <SectionLabel>Principal</SectionLabel>
        {principalLinks.map(link => (
          <NavItem key={link.href} link={link} active={esActivo(link.href)} />
        ))}

        {/* HERRAMIENTAS — agencia only */}
        {perfil.plan === 'agencia' && (
          <>
            <div className="pt-4">
              <SectionLabel>Herramientas</SectionLabel>
            </div>
            {herramientasLinks.map(link => (
              <NavItem key={link.href} link={link} active={esActivo(link.href)} />
            ))}
          </>
        )}

        {/* CUENTA */}
        <div className="pt-4">
          <SectionLabel>Cuenta</SectionLabel>
        </div>
        {cuentaLinks.map(link => (
          <NavItem key={link.href} link={link} active={esActivo(link.href)} />
        ))}
        {perfil.is_admin && (
          <NavItem
            link={{ href: '/admin', label: 'Empresas', icon: <IconAdmin /> }}
            active={pathname.startsWith('/admin')}
          />
        )}
      </nav>

      {/* ── Upgrade CTA ── */}
      {perfil.plan !== 'agencia' && (
        <div className="px-4 pb-3 shrink-0">
          <Link
            href="/pricing"
            className="block rounded-2xl p-4 transition-all duration-200 group"
            style={{
              background: 'linear-gradient(135deg, rgba(200,169,110,0.12) 0%, rgba(200,169,110,0.04) 100%)',
              border: '1px solid rgba(200,169,110,0.2)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,169,110,0.4)';
              (e.currentTarget as HTMLElement).style.background =
                'linear-gradient(135deg, rgba(200,169,110,0.18) 0%, rgba(200,169,110,0.07) 100%)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,169,110,0.2)';
              (e.currentTarget as HTMLElement).style.background =
                'linear-gradient(135deg, rgba(200,169,110,0.12) 0%, rgba(200,169,110,0.04) 100%)';
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span style={{ color: '#c8a96e' }}><IconLightning /></span>
                <span className="text-sm font-semibold" style={{ color: '#c8a96e' }}>
                  {perfil.plan === 'free' ? 'Mejorar a Pro' : 'Mejorar a Agencia'}
                </span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                strokeWidth={2.5} stroke="#c8a96e" style={{ opacity: 0.6 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(200,169,110,0.55)' }}>
              {perfil.plan === 'free'
                ? 'Más leads, IA avanzada y sin límites'
                : 'Anuncios IA y estadísticas avanzadas'}
            </p>
          </Link>
        </div>
      )}

      {/* ── User section ── */}
      <div
        className="px-4 py-4 flex items-center gap-3 shrink-0"
        style={{ borderTop: '1px solid rgba(200,169,110,0.1)' }}
      >
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8 ring-2 ring-offset-2',
              userButtonPopoverCard: 'shadow-2xl',
            },
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate" style={{ color: '#9a9490' }}>Mi cuenta</p>
        </div>
      </div>
    </aside>
  );
}
