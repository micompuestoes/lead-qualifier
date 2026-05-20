// Layout global: sidebar fijo + área de contenido con scroll

import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

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
    <html lang="es">
      <body>
        <div className="flex min-h-screen">
          {/* Sidebar fijo a la izquierda */}
          <Sidebar />

          {/* Contenido principal con margen izquierdo igual al ancho del sidebar */}
          <main className="flex-1 ml-60 min-h-screen">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
