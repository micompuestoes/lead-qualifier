'use client';

import { usePathname } from 'next/navigation';

// Decide el ancho del área principal según la ruta.
// Las páginas de auth y los formularios públicos no tienen sidebar → a pantalla completa.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed =
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/form/') ||
    pathname === '/terminos' ||
    pathname === '/privacidad';

  return (
    <main className={fullBleed ? 'flex-1 min-h-screen' : 'flex-1 ml-60 min-h-screen app-main'}>
      {children}
    </main>
  );
}
