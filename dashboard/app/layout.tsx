// Layout global — ClerkProvider + ThemeProvider envuelven todo

import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { esES } from '@clerk/localizations';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import { ToastProvider } from '@/components/Toast';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Lead Qualifier — Dashboard',
  description: 'Gestión de leads cualificados por IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
            <ToastProvider>
              <div className="flex min-h-screen">
                <Sidebar />
                <main className="flex-1 ml-60 min-h-screen">
                  {children}
                </main>
              </div>
            </ToastProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
