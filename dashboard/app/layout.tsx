// Layout global — ClerkProvider envuelve todo para la sesión de autenticación

import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { esES } from '@clerk/localizations';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'Lead Qualifier — Dashboard',
  description: 'Gestión de leads cualificados por IA',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      localization={esES}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <html lang="es">
        <body>
          <ToastProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 ml-60 min-h-screen">
                {children}
              </main>
            </div>
          </ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
