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
      const d = data.detail;
      if (typeof d === 'string') {
        mensaje = d;
      } else if (Array.isArray(d)) {
        // Errores de validación de FastAPI (422): [{ msg, loc, ... }]
        const msgs = d.map((e: { msg?: string }) => e?.msg).filter(Boolean);
        mensaje = msgs.length ? msgs.join('. ') : JSON.stringify(d);
      } else if (d && typeof d === 'object') {
        mensaje = d.message ?? d.msg ?? JSON.stringify(d);
      } else {
        mensaje = JSON.stringify(data);
      }
    } catch { /* body no es JSON */ }
    throw new Error(mensaje);
  }
  return res.json() as Promise<T>;
}

// ── Funciones de API (reciben getToken como primer argumento) ─────────────────

export interface LeadCounts { total: number; calientes: number; tibios: number; frios: number }
export interface LeadsPagina { leads: Lead[]; total: number; counts: LeadCounts; scope: 'mine' | 'all' }

// Filtros que se resuelven en el SERVIDOR (búsqueda sobre todos los leads, no solo los cargados)
export interface FiltrosLeads { q?: string; classification?: string; status?: string }

const COUNTS_VACIO: LeadCounts = { total: 0, calientes: 0, tibios: 0, frios: 0 };

function filtrosAQuery(qs: URLSearchParams, filtros?: FiltrosLeads) {
  if (filtros?.q)              qs.set('q', filtros.q);
  if (filtros?.classification) qs.set('classification', filtros.classification);
  if (filtros?.status)         qs.set('status', filtros.status);
}

export async function obtenerLeads(
  getToken: GetToken,
  opts?: { limit?: number; offset?: number },
): Promise<Lead[]> {
  const qs = new URLSearchParams();
  if (opts?.limit  != null) qs.set('limit',  String(opts.limit));
  if (opts?.offset != null) qs.set('offset', String(opts.offset));
  const path = '/leads' + (qs.toString() ? `?${qs.toString()}` : '');
  const res = await apiFetch(path, getToken, { cache: 'no-store' } as RequestInit);
  const data = await handleResponse<{ leads: Lead[] }>(res);
  return normalizarLeads(data.leads);
}

// Igual que obtenerLeads pero devuelve también los totales REALES por temperatura
// y el ámbito (mine/all), para que las métricas no mientan con la paginación.
// Admite filtros server-side (q/classification/status).
export async function obtenerLeadsPagina(
  getToken: GetToken,
  opts?: { limit?: number; offset?: number } & FiltrosLeads,
): Promise<LeadsPagina> {
  const qs = new URLSearchParams();
  if (opts?.limit  != null) qs.set('limit',  String(opts.limit));
  if (opts?.offset != null) qs.set('offset', String(opts.offset));
  filtrosAQuery(qs, opts);
  const path = '/leads' + (qs.toString() ? `?${qs.toString()}` : '');
  const res = await apiFetch(path, getToken, { cache: 'no-store' } as RequestInit);
  const data = await handleResponse<{ leads: Lead[]; total?: number; counts?: LeadCounts; scope?: 'mine' | 'all' }>(res);
  return {
    leads: normalizarLeads(data.leads),
    total: data.total ?? data.leads.length,
    counts: data.counts ?? COUNTS_VACIO,
    scope: data.scope ?? 'all',
  };
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

// Descarga el CSV con TODOS los leads que cumplen los filtros (lo genera el servidor)
export async function exportarLeadsCSV(getToken: GetToken, filtros?: FiltrosLeads): Promise<void> {
  const qs = new URLSearchParams();
  filtrosAQuery(qs, filtros);
  const path = '/leads/export' + (qs.toString() ? `?${qs.toString()}` : '');
  const res = await apiFetch(path, getToken);
  if (!res.ok) return handleResponse<never>(res);   // lanza con el mensaje del servidor
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `leads-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// Envía el email de respuesta al lead (borrador aprobado, opcionalmente editado)
export async function enviarEmailLead(
  id: string,
  emailBody: string | null,
  getToken: GetToken
): Promise<Lead> {
  const res = await apiFetch(`/leads/${id}/send-email`, getToken, {
    method: 'POST',
    body: JSON.stringify({ email_body: emailBody }),
  });
  return handleResponse<Lead>(res).then(normalizarLead);
}

// Valoración del agente sobre la clasificación de la IA (👍/👎, null borra)
export async function feedbackLead(
  id: string,
  feedback: 'up' | 'down' | null,
  getToken: GetToken
): Promise<Lead> {
  const res = await apiFetch(`/leads/${id}/feedback`, getToken, {
    method: 'PATCH',
    body: JSON.stringify({ feedback }),
  });
  return handleResponse<Lead>(res).then(normalizarLead);
}

export async function asignarLead(
  id: string,
  agentId: string | null,
  getToken: GetToken
): Promise<Lead> {
  const res = await apiFetch(`/leads/${id}/assign`, getToken, {
    method: 'PATCH',
    body: JSON.stringify({ agent_id: agentId }),
  });
  return handleResponse<Lead>(res).then(normalizarLead);
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
