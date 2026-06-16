// Paleta y rangos canónicos de temperatura de leads.
// FUENTE ÚNICA: debe coincidir con el backend (score_lead / get_lead_counts):
//   CALIENTE >= 8 · TIBIO 5-7 · FRÍO 1-4
// Los colores casan con el LeadBadge para que toda la app sea coherente.

export interface TempMeta {
  label: string;   // plural, para tarjetas de métrica
  rango: string;   // rango de score legible
  color: string;   // color de texto/número (igual que el badge)
  accent: string;  // color de barra/acento
}

export const TEMP: { calientes: TempMeta; tibios: TempMeta; frios: TempMeta } = {
  calientes: { label: 'Calientes', rango: 'Score 8 – 10', color: '#b45309', accent: 'rgba(180,83,9,0.7)' },
  tibios:    { label: 'Tibios',    rango: 'Score 5 – 7',  color: '#9a7a3a', accent: '#c8a96e' },
  frios:     { label: 'Fríos',     rango: 'Score 1 – 4',  color: '#3a7a9a', accent: 'rgba(110,168,200,0.8)' },
};
