'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useTheme } from './ThemeProvider';
import NotificationBell from './NotificationBell';

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconHome() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
    </svg>
  );
}

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

function IconHelp() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
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

function IconSun() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavLink { href: string; label: string; icon: React.ReactNode }
interface Perfil  { plan: string; name: string; is_admin: boolean }

const planConfig: Record<string, { label: string; bg: string; color: string }> = {
  free:    { label: 'Gratuito', bg: 'rgba(122,116,104,0.1)',  color: '#9a9490' },
  pro:     { label: 'Pro',      bg: 'rgba(200,169,110,0.15)', color: '#9a7a3a' },
  agencia: { label: 'Agencia',  bg: 'rgba(200,169,110,0.18)', color: '#9a7a3a' },
};

const principalLinks: NavLink[] = [
  { href: '/',           label: 'Inicio',     icon: <IconHome />  },
  { href: '/leads',      label: 'Leads',      icon: <IconLeads /> },
  { href: '/nuevo-lead', label: 'Nuevo lead', icon: <IconPlus />  },
];
const herramientasLinks: NavLink[] = [
  { href: '/anuncios',     label: 'Anuncios IA',  icon: <IconAd />    },
  { href: '/estadisticas', label: 'Estadísticas', icon: <IconStats /> },
];
const cuentaLinks: NavLink[] = [
  { href: '/perfil', label: 'Mi perfil', icon: <IconProfile /> },
  { href: '/ayuda',  label: 'Ayuda',     icon: <IconHelp />    },
];

const BASE        = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const CACHE_KEY   = 'inmonia-perfil';
const FETCH_MS    = 10_000;   // timeout para cada intento
const RETRY_MS    = 20_000;   // espera entre reintentos si el backend está frío

// ── Cache helpers ─────────────────────────────────────────────────────────────

function leerCache(): Perfil | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Perfil) : null;
  } catch { return null; }
}

function escribirCache(perfil: Perfil) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(perfil)); } catch {}
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children, c }: { children: React.ReactNode; c: ReturnType<typeof useTheme>['c'] }) {
  return (
    <p style={{
      padding: '0 12px', marginBottom: 4, marginTop: 0,
      fontSize: 10, fontWeight: 700,
      color: 'rgba(200,169,110,0.5)',
      letterSpacing: '0.12em', textTransform: 'uppercase', userSelect: 'none',
    }}>
      {children}
    </p>
  );
}

function NavItem({ link, active, c }: { link: NavLink; active: boolean; c: ReturnType<typeof useTheme>['c'] }) {
  return (
    <Link
      href={link.href}
      className="relative flex items-center gap-3 rounded-xl text-sm transition-all duration-150"
      style={{
        padding: '9px 12px',
        color:      active ? c.text1 : c.text2,
        background: active ? 'rgba(200,169,110,0.11)' : 'transparent',
        fontWeight: active ? 600 : 500,
        textDecoration: 'none',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = c.text1;
          (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,110,0.07)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = c.text2;
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }
      }}
    >
      {active && (
        <span style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 3, height: 20, borderRadius: '0 3px 3px 0',
          background: 'linear-gradient(180deg, #d4b87a, #c8a96e)',
        }} />
      )}
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
  const { c, isDark, toggle } = useTheme();

  // Arranca con el cache para que el plan sea correcto al instante
  const [perfil, setPerfil]         = useState<Perfil>(() => leerCache() ?? { plan: 'free', name: '', is_admin: false });
  const [reconectando, setReconectando] = useState(false);
  const [abierto, setAbierto]       = useState(false);  // cajón móvil

  // Cierra el cajón al cambiar de página
  useEffect(() => { setAbierto(false); }, [pathname]);

  useEffect(() => {
    let cancelado = false;

    async function cargarPerfil(esReintento = false) {
      try {
        const token = await getToken();
        if (!token || cancelado) return;

        // Timeout explícito para detectar backend frío
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), FETCH_MS);

        try {
          const res = await fetch(`${BASE}/me`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          clearTimeout(tid);
          if (cancelado) return;

          if (res.ok) {
            const d = await res.json();
            const p: Perfil = { plan: d.plan ?? 'free', name: d.name ?? '', is_admin: d.is_admin ?? false };
            setPerfil(p);
            escribirCache(p);
            setReconectando(false);
          }
        } catch {
          // AbortError → backend frío. Reintentamos una vez.
          clearTimeout(tid);
          if (cancelado) return;
          if (!esReintento) {
            setReconectando(true);
            setTimeout(() => { if (!cancelado) cargarPerfil(true); }, RETRY_MS);
          } else {
            setReconectando(false); // rendirse tras 2 intentos
          }
        }
      } catch { /* error de getToken — silencioso */ }
    }

    cargarPerfil();
    return () => { cancelado = true; };
  }, [getToken]);

  const esActivo      = (href: string) =>
    href === '/leads' ? pathname.startsWith('/leads') : pathname === href;
  const esAuth        = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
  const esFormPublico = pathname.startsWith('/form/');
  const esLegal       = pathname === '/terminos' || pathname === '/privacidad';
  if (esAuth || esFormPublico || esLegal) return null;

  const plan = planConfig[perfil.plan] ?? planConfig.free;

  return (
    <>
      {/* ── Barra superior (solo móvil) ── */}
      <header className="mobile-topbar">
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            background: 'rgba(200,169,110,0.1)',
            border: '1px solid rgba(200,169,110,0.22)',
            color: '#9a7a3a', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #d4b87a 0%, #c8a96e 45%, #a8895a 100%)',
            boxShadow: '0 3px 10px rgba(200,169,110,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth={2.2} stroke="#1a1814" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <span style={{
            fontSize: 15, fontWeight: 600, color: c.text1, letterSpacing: '-0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {perfil.name || 'Inmonia'}
          </span>
        </div>

        {/* Notificaciones (derecha) */}
        <div style={{ marginLeft: 'auto' }}>
          <NotificationBell placement="topbar" />
        </div>
      </header>

      {/* ── Velo del cajón (solo móvil) ── */}
      {abierto && <div className="sidebar-overlay" onClick={() => setAbierto(false)} />}

      <aside
        className={`fixed top-0 left-0 h-screen w-60 flex flex-col z-10 app-sidebar${abierto ? ' is-open' : ''}`}
        style={{
        background:   c.sidebar,
        borderRight:  `1px solid ${c.sidebarBorder}`,
        boxShadow:    c.sidebarShadow,
        transition:   'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
      }}
    >
      {/* ── Brand ── */}
      <Link
        href="/"
        className="px-5 py-5 flex flex-col gap-3 shrink-0 transition-opacity hover:opacity-80"
        style={{ borderBottom: `1px solid ${c.divider}` }}
      >
        <div className="flex items-center gap-3">
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #c8a96e 0%, #a8895a 100%)',
            boxShadow: '0 4px 12px rgba(200,169,110,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth={2.2} stroke="white">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p style={{ fontSize: 14, fontWeight: 600, color: c.text1, lineHeight: 1.3, transition: 'color 0.2s' }}
              className="truncate">
              {perfil.name || 'Tu agencia'}
            </p>
            <p style={{ fontSize: 11, marginTop: 2, transition: 'color 0.2s' }} className="truncate">
              <span style={{ color: '#9a7a3a', fontWeight: 700 }}>Inmonia</span>
              <span style={{ color: c.text3 }}> · IA inmobiliaria</span>
            </p>
          </div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 99, alignSelf: 'flex-start',
          fontSize: 11, fontWeight: 600,
          background: plan.bg, color: plan.color,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: plan.color, flexShrink: 0 }} />
          Plan {plan.label}
        </span>
      </Link>

      {/* ── Navigation ── */}
      <nav data-tour="nav" className="flex-1 overflow-y-auto" style={{ padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <SectionLabel c={c}>Principal</SectionLabel>
        {principalLinks.map(l => <NavItem key={l.href} link={l} active={esActivo(l.href)} c={c} />)}

        {perfil.plan === 'agencia' && (
          <>
            <div style={{ marginTop: 18 }}>
              <SectionLabel c={c}>Herramientas</SectionLabel>
            </div>
            {herramientasLinks.map(l => <NavItem key={l.href} link={l} active={esActivo(l.href)} c={c} />)}
          </>
        )}

        <div style={{ marginTop: 18 }}>
          <SectionLabel c={c}>Cuenta</SectionLabel>
        </div>
        {cuentaLinks.map(l => <NavItem key={l.href} link={l} active={esActivo(l.href)} c={c} />)}
        {perfil.is_admin && (
          <NavItem
            link={{ href: '/admin', label: 'Empresas', icon: <IconAdmin /> }}
            active={pathname.startsWith('/admin')}
            c={c}
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

      {/* ── Indicador de reconexión ── */}
      {reconectando && (
        <div style={{
          margin: '0 12px 10px',
          padding: '8px 12px',
          borderRadius: 10,
          background: 'rgba(200,169,110,0.08)',
          border: '1px solid rgba(200,169,110,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            border: '2px solid rgba(200,169,110,0.3)',
            borderTopColor: '#c8a96e',
            flexShrink: 0,
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ fontSize: 11, color: '#9a7a3a', lineHeight: 1.3 }}>
            Reconectando con el servidor…
          </p>
        </div>
      )}

      {/* ── User + Toggle ── */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${c.divider}`,
        display: 'flex', alignItems: 'center', gap: 10,
        transition: 'border-color 0.25s',
      }}>
        <UserButton
          appearance={{
            elements: { avatarBox: 'w-8 h-8', userButtonPopoverCard: 'shadow-2xl' },
          }}
        />
        <p style={{ fontSize: 12, color: c.text3, fontWeight: 500, flex: 1, transition: 'color 0.2s' }}>
          Mi cuenta
        </p>
        {/* Notificaciones (esta instancia gestiona el sonido/aviso del navegador) */}
        <NotificationBell placement="sidebar" enableAlerts />
        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="flex items-center justify-center rounded-lg transition-all duration-150"
          style={{
            width: 30, height: 30,
            background: isDark ? 'rgba(200,169,110,0.12)' : 'rgba(122,116,104,0.08)',
            border: isDark ? '1px solid rgba(200,169,110,0.2)' : '1px solid rgba(122,116,104,0.15)',
            color: isDark ? '#c8a96e' : '#9a9490',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,110,0.15)';
            (e.currentTarget as HTMLElement).style.color = '#c8a96e';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = isDark
              ? 'rgba(200,169,110,0.12)' : 'rgba(122,116,104,0.08)';
            (e.currentTarget as HTMLElement).style.color = isDark ? '#c8a96e' : '#9a9490';
          }}
        >
          {isDark ? <IconSun /> : <IconMoon />}
        </button>
      </div>
    </aside>
    </>
  );
}
