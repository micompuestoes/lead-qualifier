'use client';

// Navegación lateral — indica el enlace activo y muestra el UserButton de Clerk

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';

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
];

export default function Sidebar() {
  const pathname = usePathname();

  function esActivo(href: string) {
    if (href === '/leads') return pathname.startsWith('/leads');
    return pathname === href;
  }

  // En páginas de auth no mostramos el sidebar
  const esAuth = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
  if (esAuth) return null;

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-gray-900 flex flex-col z-10">
      {/* Logo / marca */}
      <div className="px-6 py-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"
              strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Lead Qualifier</p>
            <p className="text-gray-400 text-xs">Agente de IA</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navLinks.map((link) => {
          const activo = esActivo(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                font-medium transition-colors ${
                activo
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              }`}
            >
              {activo && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-400 rounded-r-full" />
              )}
              {link.icon}
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Perfil de usuario — UserButton de Clerk */}
      <div className="px-4 py-4 border-t border-gray-800">
        {/* El redirect tras logout se configura con NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL */}
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
