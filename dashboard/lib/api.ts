// Capa de acceso a la API FastAPI — todas las llamadas centralizadas aquí.
// Auth: recibe getToken de useAuth() de Clerk — nunca usa window.Clerk directamente.

import type {
  Lead,
  LeadQualificado,
  NuevoLeadPayload,
  ActualizarEstadoPayload,
} from '@/types/lead';

export const BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
  : 'http://localhost:8000';

// GetToken: firma que devuelve useAuth() de Clerk
export type GetToken = () => Promise<string | null>;

// ── Helper de fetch con auth automática ──────────────────────────────────────

export async function apiFetch(
  path: string,
  getToken: GetToken | null,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken ? await getToken() : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${BASE}${path}`, { ...options, headers });
}

// ── Helper: lanza error con mensaje del servidor si no es 2xx ────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let mensaje = `Error ${res.status}`;
    try {
      const data = await res.json();
      mensaje = data.detail ?? JSON.stringify(data);
    } catch { /* body no es JSON */ }
    throw new Error(mensaje);
  }
  return res.json() as Promise<T>;
}

// ── Funciones de API (reciben getToken como primer argumento) ─────────────────

export async function obtenerLeads(getToken: GetToken): Promise<Lead[]> {
  const res = await apiFetch('/leads', getToken, { cache: 'no-store' } as RequestInit);
  const data = await handleResponse<{ leads: Lead[] }>(res);
  return normalizarLeads(data.leads);
}

export async function obtenerLead(id: string, getToken: GetToken): Promise<Lead> {
  const res = await apiFetch(`/leads/${id}`, getToken, { cache: 'no-store' } as RequestInit);
  return handleResponse<Lead>(res).then(normalizarLead);
}

export async function cualificarLead(
  payload: NuevoLeadPayload,
  getToken: GetToken
): Promise<LeadQualificado> {
  const res = await apiFetch('/qualify-lead', getToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return handleResponse<LeadQualificado>(res);
}

export async function actualizarEstado(
  id: string,
  payload: ActualizarEstadoPayload,
  getToken: GetToken
): Promise<Lead> {
  const res = await apiFetch(`/leads/${id}/status`, getToken, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return handleResponse<Lead>(res);
}

export async function eliminarLead(id: string, getToken: GetToken): Promise<void> {
  const res = await apiFetch(`/leads/${id}`, getToken, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? `Error ${res.status}`);
  }
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function normalizarLead(lead: Lead): Lead {
  return {
    ...lead,
    status: lead.status ?? 'PENDIENTE',
    recommended_actions: parsearAcciones(lead.recommended_actions),
  };
}

function normalizarLeads(leads: Lead[]): Lead[] {
  return leads.map(normalizarLead);
}

function parsearAcciones(value: string[] | string | null | undefined): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value as string); }
  catch { return [value as string]; }
}
