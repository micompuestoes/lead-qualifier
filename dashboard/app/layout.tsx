// Layout global — ClerkProvider + ThemeProvider envuelven todo

import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { esES } from '@clerk/localizations';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import AppShell from '@/components/AppShell';
import SentryInit from '@/components/SentryInit';
import { ToastProvider } from '@/components/Toast';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: {
    default: 'Inmobia — Cualificación de leads inmobiliarios con IA',
    template: '%s · Inmobia',
  },
  description:
    'La plataforma que cualifica tus leads inmobiliarios con inteligencia artificial, prioriza los que van a cerrar y redacta la respuesta perfecta.',
  applicationName: 'Inmobia',
  authors: [{ name: 'Inmobia' }],
  keywords: ['leads inmobiliarios', 'cualificación de leads', 'IA inmobiliaria', 'CRM inmobiliario'],
  openGraph: {
    title: 'Inmobia — Cualificación de leads inmobiliarios con IA',
    description: 'Convierte cada consulta en una oportunidad real.',
    type: 'website',
    locale: 'es_ES',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  return (
    <ClerkProvider localization={esES} signInUrl="/sign-in" signUpUrl="/sign-up">
      <html lang="es" suppressHydrationWarning>
        {/* Anti-FOUC: aplica el tema antes de que React hidrate */}
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var t=localStorage.getItem('inmobia-theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);})();`,
            }}
          />
        </head>
        <body>
          <ThemeProvider>
            <SentryInit />
            <ToastProvider>
              {userId ? (
                <div className="flex min-h-screen">
                  <Sidebar />
                  <AppShell>{children}</AppShell>
                </div>
              ) : (
                // Visitante no autenticado: sin sidebar (landing, login, formularios, legal)
                children
              )}
            </ToastProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
