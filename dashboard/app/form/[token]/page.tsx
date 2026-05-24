'use client';

// Formulario público de captación de leads.
// No requiere login — cualquier visitante de la web de la inmobiliaria puede rellenarlo.
// URL: /form/lq_xxxxxxxxxxxxxxxxxx

import { useState } from 'react';

interface FormState {
  name: string;
  email: string;
  phone: string;
  message: string;
}

type Paso = 'formulario' | 'enviando' | 'ok' | 'error';

export default function FormularioPublico({
  params,
}: {
  params: { token: string };
}) {
  const [form, setForm] = useState<FormState>({
    name: '', email: '', phone: '', message: '',
  });
  const [paso, setPaso] = useState<Paso>('formulario');
  const [error, setError] = useState('');

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;

    setPaso('enviando');
    setError('');

    try {
      const res = await fetch(`${apiBase}/intake/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          message: form.message,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? 'Error al enviar el formulario');
      }

      setPaso('ok');
    } catch (err: any) {
      setError(err.message ?? 'Error desconocido');
      setPaso('error');
    }
  }

  // ── Enviando ──────────────────────────────────────────────────────────────
  if (paso === 'enviando') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 font-medium">Enviando tu consulta…</p>
        </div>
      </div>
    );
  }

  // ── Éxito ─────────────────────────────────────────────────────────────────
  if (paso === 'ok') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">¡Consulta recibida!</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Hemos recibido tu mensaje. En breve un agente se pondrá en contacto contigo.
          </p>
          <p className="text-xs text-gray-400">
            También te hemos enviado un email de confirmación a <strong>{form.email}</strong>
          </p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (paso === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Algo fue mal</h2>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setPaso('formulario')}
            className="text-sm text-blue-600 hover:underline"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  // ── Formulario ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-lg w-full">

        {/* Cabecera */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">¿Buscas una propiedad?</h1>
          <p className="text-gray-500 text-sm mt-1">
            Cuéntanos qué necesitas y te contactamos en menos de 24 horas.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="María García"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="maria@ejemplo.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="+34 600 000 000"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Mensaje */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ¿Qué estás buscando? <span className="text-red-500">*</span>
            </label>
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              required
              rows={4}
              placeholder="Busco un piso de 3 habitaciones en el centro, con presupuesto de 250.000 €. Quiero comprar, no alquilar."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Cuanto más detallado, mejor podremos ayudarte.
            </p>
          </div>

          {/* Botón */}
          <button
            type="submit"
            disabled={!form.name || !form.email || !form.message}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            Enviar consulta
          </button>

          <p className="text-xs text-gray-400 text-center">
            Tus datos están protegidos y nunca serán compartidos con terceros.
          </p>
        </form>
      </div>
    </div>
  );
}
