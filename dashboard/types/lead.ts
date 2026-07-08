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
}
