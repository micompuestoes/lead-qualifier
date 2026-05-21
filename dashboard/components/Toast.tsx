'use client';

// Sistema de toasts — proveedor + hook useToast exportado desde aquí
// Uso: const { addToast } = useToast()
//      addToast('Mensaje', 'success' | 'error' | 'info')

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Hook para consumir el contexto desde cualquier componente
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

// ── Iconos ────────────────────────────────────────────────────────────────────

function IconCheck() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function IconX() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

// Estilos por tipo
const estilos: Record<ToastType, { contenedor: string; icono: string; IconComponent: () => JSX.Element }> = {
  success: {
    contenedor: 'bg-gray-900 border border-green-500/40 text-white',
    icono: 'text-green-400',
    IconComponent: IconCheck,
  },
  error: {
    contenedor: 'bg-gray-900 border border-red-500/40 text-white',
    icono: 'text-red-400',
    IconComponent: IconX,
  },
  info: {
    contenedor: 'bg-gray-900 border border-blue-500/40 text-white',
    icono: 'text-blue-400',
    IconComponent: IconBolt,
  },
};

// ── Componente individual ─────────────────────────────────────────────────────

function ToastItem({
  toast,
  onRemove,
}: {
  toast: ToastItem;
  onRemove: (id: number) => void;
}) {
  const { contenedor, icono, IconComponent } = estilos[toast.type];

  return (
    <div
      className={`animate-toast-in flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl
        text-sm font-medium min-w-[260px] max-w-[380px] ${contenedor}`}
    >
      <span className={icono}>
        <IconComponent />
      </span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-1 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        aria-label="Cerrar notificación"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Proveedor principal ───────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random(); // evitar colisiones si se llama rápido
    setToasts((prev) => [...prev, { id, message, type }]);
    // Auto-eliminar tras 4 segundos
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Contenedor fijo en esquina inferior derecha */}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
