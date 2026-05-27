// Funciones de utilidad compartidas entre páginas y componentes.

// ── Fechas ────────────────────────────────────────────────────────────────────

export function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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
