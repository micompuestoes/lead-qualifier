// Capa de acceso a la API FastAPI — todas las llamadas centralizadas aquí.
//
// En desarrollo (sin NEXT_PUBLIC_API_URL):
//   Las peticiones van a /api/... y Next.js las redirige a localhost:8000 via rewrites.
//
// En producción (NEXT_PUBLIC_API_URL definida):
//   Las peticiones van directamente a la URL del backend.
//
// Auth: el token JWT de Clerk se adjunta automáticamente en cada petición.

import type {
  Lead,
  LeadQualificado,
  NuevoLeadPayload,
  ActualizarEstadoPayload,
} from '@/types/lead';

const BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
  : '/api';

// ── Obtención del token JWT de Clerk ─────────────────────────────────────────
// window.Clerk es inyectado por el ClerkProvider y disponible en client components.

async function obtenerToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const clerk = (window as any).Clerk;
    if (!clerk?.session) return null;
    return await clerk.session.getToken();
  } catch {
    return null;
  }
}

// ── Helper de fetch con auth automática ──────────────────────────────────────

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await obtenerToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return fetch(`${BASE}${path}`, { ...options, headers });
}

// ── Helper: lanza un error con el mensaje del servidor si la respuesta no es 2xx

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let mensaje = `Error ${res.status}`;
    try {
      const data = await res.json();
      mensaje = data.detail ?? JSON.stringify(data);
    } catch {
      // si el body no es JSON, usamos el mensaje genérico
    }
    throw new Error(mensaje);
  }
  return res.json() as Promise<T>;
}

// ── Cualificar un lead nuevo ──────────────────────────────────────────────────

export async function cualificarLead(
  payload: NuevoLeadPayload
): Promise<LeadQualificado> {
  const res = await apiFetch('/qualify-lead', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return handleResponse<LeadQualificado>(res);
}

// ── Obtener todos los leads ───────────────────────────────────────────────────

export async function obtenerLeads(): Promise<Lead[]> {
  const res = await apiFetch('/leads', { cache: 'no-store' } as RequestInit);
  const data = await handleResponse<{ leads: Lead[] }>(res);
  return normalizarLeads(data.leads);
}

// ── Obtener un lead por ID ────────────────────────────────────────────────────

export async function obtenerLead(id: string): Promise<Lead> {
  const res = await apiFetch(`/leads/${id}`, { cache: 'no-store' } as RequestInit);
  const data = await handleResponse<Lead>(res);
  return normalizarLead(data);
}

// ── Actualizar el estado de un lead ──────────────────────────────────────────

export async function actualizarEstado(
  id: string,
  payload: ActualizarEstadoPayload
): Promise<Lead> {
  const res = await apiFetch(`/leads/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return handleResponse<Lead>(res);
}

// ── Eliminar un lead ──────────────────────────────────────────────────────────

export async function eliminarLead(id: string): Promise<void> {
  const res = await apiFetch(`/leads/${id}`, { method: 'DELETE' });
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

function parsearAcciones(
  value: string[] | string | null | undefined
): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value as string);
  } catch {
    return [value as string];
  }
}
