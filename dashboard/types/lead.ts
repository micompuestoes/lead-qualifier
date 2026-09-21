// Tipos del dominio de leads — espejo del schema FastAPI

export type Clasificacion = 'CALIENTE' | 'TIBIO' | 'FRÍO';

export type EstadoLead =
  | 'PENDIENTE'
  | 'CONTACTADO'
  | 'CERRADO'
  | 'DESCARTADO';

// Respuesta del endpoint POST /qualify-lead
export interface LeadQualificado {
  lead_id: string;
  classification: Clasificacion;
  score: number;
  reasoning: string;
  generated_email: string;
  recommended_actions: string[];
  email_sent?: boolean | null;   // false → quedó como borrador (modo revisión)
  processed_at: string;
}

// Registro completo almacenado en BD (GET /leads y GET /leads/{id})
export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  classification: Clasificacion | null;
  score: number | null;
  reasoning: string | null;
  generated_email: string | null;
  recommended_actions: string[] | null; // puede venir como JSON string desde la BD
  status: EstadoLead;
  assigned_to?: string | null;           // Clerk user_id del agente asignado
  email_sent?: number | boolean | null;  // 0/false → borrador pendiente de enviar
  score_feedback?: number | null;        // 1 = acierto, -1 = fallo, null = sin valorar
  followup_sent_at?: string | null;      // fecha del recordatorio automático (si se envió)
  deal_value?: number | null;            // importe (€) de la operación, si se cerró
  created_at: string;
  processed_at: string | null;
}

// Miembro del equipo (GET /me/team)
export interface AgenteEquipo {
  member_id: string;
  member_name: string;
  added_at: string;
}

// Fila del ranking de agentes (GET /stats/agents)
export interface AgenteRanking {
  agent_id: string;
  name: string;
  total: number;
  calientes: number;
  cerrados: number;
  pendientes: number;
  score_avg: number;
}

// Payload para crear un nuevo lead
export interface NuevoLeadPayload {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

// Payload para actualizar el estado
export interface ActualizarEstadoPayload {
  status: EstadoLead;
  deal_value?: number;
}

// Precisión de la IA reportada por el agente (👍/👎 sobre la clasificación)
export interface FeedbackStats {
  por_clasificacion: Record<string, { aciertos: number; fallos: number }>;
  total_valorados: number;
  precision: number | null;
}

// Respuesta de GET /stats (solo plan agencia)
export interface Stats {
  total: number;
  este_mes: number;
  mes_anterior: number;
  por_estado: Record<string, number>;
  score_avg: number;
  calientes: number;
  tibios: number;
  frios: number;
  por_mes: { mes: string; total: number }[];
  feedback: FeedbackStats;
  por_fuente: Record<string, { total: number; calientes: number }>;
  conversion: {
    calientes: number;
    calientes_cerrados: number;
    tasa_conversion: number | null;
    tiempo_medio_cierre_dias: number | null;
  };
}

export type PeriodoValor = 'semana' | 'mes' | 'año' | 'siempre';

// Respuesta de GET /stats/deal-value
export interface ValorOperaciones {
  total_value: number;
  count: number;
}

// Respuesta de GET /me
export interface Perfil {
  id: string;
  name: string;
  email: string;
  notify_email: string;
  api_key: string;
  plan: string;
  status: string;
  created_at: string;
  is_admin?: boolean;
  whatsapp_number?: string;
  whatsapp_enabled?: boolean;
  auto_send_email?: boolean;
  brand_voice?: string;
  followup_enabled?: boolean;
  brand_color?: string;
  logo_url?: string;
  form_title?: string;
  form_subtitle?: string;
  webhook_url?: string;
}

// Respuesta de GET /me/imap
export interface ImapStatus {
  configured: boolean;
  host?: string;
  port?: number;
  user?: string;
  enabled?: boolean;
  last_sync?: string | null;
}

// Miembro del equipo con los campos que devuelve GET /me/team (más completos
// que AgenteRanking/AgenteEquipo, que son vistas derivadas para otras pantallas)
export interface EquipoMiembro {
  member_id: string;
  member_name?: string;
  member_email?: string;
  member_whatsapp?: string;
  added_at: string;
}

// Recordatorio de seguimiento de un lead (GET/POST /leads/{id}/reminders, GET /reminders/pending)
export interface Reminder {
  id: string;
  lead_id: string;
  note: string;
  due_date: string;        // ISO "YYYY-MM-DD"
  done: boolean;
  created_at: string;
  completed_at: string | null;
  lead_name?: string;      // solo presente en /reminders/pending
}

export interface CrearRecordatorioPayload {
  note: string;
  due_date: string;
}

export interface ActualizarRecordatorioPayload {
  note?: string;
  due_date?: string;
  done?: boolean;
}
