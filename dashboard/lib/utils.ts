// Funciones de utilidad compartidas entre páginas y componentes.

// ── Fechas ────────────────────────────────────────────────────────────────────

export function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Fecha relativa: "Hace 5 min", "Hace 3h", "Ayer", "Lunes", "12 ene" */
export function formatearFechaRelativa(iso: string): string {
  const ahora = Date.now();
  const ts    = new Date(iso).getTime();
  const diff  = ahora - ts;

  const min   = Math.floor(diff / 60_000);
  const horas = Math.floor(diff / 3_600_000);
  const dias  = Math.floor(diff / 86_400_000);

  if (min < 2)   return 'Ahora mismo';
  if (min < 60)  return `Hace ${min} min`;
  if (horas < 24) return `Hace ${horas}h`;
  if (dias === 1) return 'Ayer';
  if (dias < 7)  {
    return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long' })
      .replace(/^\w/, c => c.toUpperCase());
  }
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

// ── Lead helpers ──────────────────────────────────────────────────────────────

const PREFIJOS_ASUNTO: Record<string, string> = {
  CALIENTE: 'Oportunidad — ',
  TIBIO:    'Seguimiento — ',
  'FRÍO':   'Información solicitada — ',
};

export function generarAsunto(name: string, clasificacion: string | null): string {
  const prefijo = clasificacion ? (PREFIJOS_ASUNTO[clasificacion] ?? '') : '';
  return `${prefijo}${name}`;
}

export function parsearReasoning(texto: string): string[] {
  const porLinea = texto
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(l => l.length > 8);
  if (porLinea.length > 1) return porLinea;
  return texto
    .split(/\.\s+/)
    .map(s => s.trim().replace(/\.$/, ''))
    .filter(s => s.length > 10);
}
