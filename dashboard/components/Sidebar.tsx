'use client';

// Navegación lateral — indica el enlace activo y muestra el UserButton de Clerk

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

const navLinks = [
  {
    href: '/leads',
    label: 'Leads',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/nuevo-lead',
    label: 'Nuevo lead',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    href: '/perfil',
    label: 'Mi perfil',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
];

const adminLink = {
  href: '/admin',
  label: 'Empresas',
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  ),
};

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface Perfil {
  plan: string;
  name: string;
  is_admin: boolean;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { getToken } = useAuth();
  const [perfil, setPerfil] = useState<Perfil>({ plan: 'free', name: '', is_admin: false });

  useEffect(() => {
    async function cargarPerfil() {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${BASE}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPerfil({
            plan:     data.plan     ?? 'free',
            name:     data.name     ?? '',
            is_admin: data.is_admin ?? false,
          });
        }
      } catch { /* silencioso */ }
    }
    cargarPerfil();
  }, [getToken]);

  function esActivo(href: string) {
    if (href === '/leads') return pathname.startsWith('/leads');
    return pathname === href;
  }

  const esAuth = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
  const esFormPublico = pathname.startsWith('/form/');
  if (esAuth || esFormPublico) return null;

  // Links visibles: los comunes + admin solo si es administrador
  const links = perfil.is_admin ? [...navLinks, adminLink] : navLinks;

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 flex flex-col z-10"
      style={{ background: '#1a1814', borderRight: '1px solid rgba(200,169,110,0.15)' }}>

      {/* Logo / marca — lleva a /leads al hacer clic */}
      <Link href="/leads"
        className="px-6 py-6 flex items-center gap-3 transition-opacity hover:opacity-80"
        style={{ borderBottom: '1px solid rgba(200,169,110,0.12)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: '#c8a96e' }}>
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"
            strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight truncate"
            style={{ color: '#f5f0e8' }}>
            {perfil.name || 'Lead Qualifier'}
          </p>
          <p className="text-xs" style={{ color: '#7a7468' }}>Agente de IA</p>
        </div>
      </Link>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map((link) => {
          const activo = esActivo(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                color:      activo ? '#f5f0e8' : '#7a7468',
                background: activo ? 'rgba(200,169,110,0.12)' : 'transparent',
              }}
              onMouseEnter={e => {
                if (!activo) {
                  (e.currentTarget as HTMLElement).style.color = '#ede0c8';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,110,0.07)';
                }
              }}
              onMouseLeave={e => {
                if (!activo) {
                  (e.currentTarget as HTMLElement).style.color = '#7a7468';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              {activo && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ background: '#c8a96e' }} />
              )}
              {link.icon}
              {link.label}
            </Link>
          );
        })}

        {/* CTA upgrade — solo para plan free */}
        {perfil.plan === 'free' && (
          <Link
            href="/pricing"
            className="mt-2 relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              color:      pathname === '/pricing' ? '#1a1814' : '#c8a96e',
              background: pathname === '/pricing' ? '#c8a96e' : 'transparent',
              border:     pathname === '/pricing' ? 'none' : '1px solid rgba(200,169,110,0.3)',
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            Mejorar plan
          </Link>
        )}
      </nav>

      {/* Perfil de usuario — UserButton de Clerk */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(200,169,110,0.12)' }}>
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8',
              userButtonPopoverCard: 'shadow-xl',
            },
          }}
        />
      </div>
    </aside>
  );
}
