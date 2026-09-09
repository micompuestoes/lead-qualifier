'use client';

// Hook para el patrón repetido en varias páginas: una petición GET al entrar
// a la página, con cargando/error consistentes. Solo cubre ese caso simple
// (una carga inicial) — páginas con paginación, filtros o múltiples mutaciones
// (leads, perfil) tienen necesidades propias y no se fuerzan a este molde.

import { useCallback, useEffect, useState } from 'react';

interface EstadoRecurso<T> {
  datos: T | null;
  cargando: boolean;
  error: Error | null;
  recargar: () => void;
}

export function useApiResource<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): EstadoRecurso<T> {
  const [datos, setDatos]       = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState<Error | null>(null);
  const [tick, setTick]         = useState(0);

  const recargar = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    fetcher()
      .then(d => { if (vivo) setDatos(d); })
      .catch(e => { if (vivo) setError(e instanceof Error ? e : new Error('Error al cargar')); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { datos, cargando, error, recargar };
}
