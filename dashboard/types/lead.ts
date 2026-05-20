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
  created_at: string;
  processed_at: string | null;
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
