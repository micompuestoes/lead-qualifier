'use client';

// Formulario para cualificar un lead nuevo con el agente de IA

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cualificarLead } from '@/lib/api';
import type { LeadQualificado } from '@/types/lead';
import LeadBadge from '@/components/LeadBadge';
import ScoreBar from '@/components/ScoreBar';
import EmailPreview from '@/components/EmailPreview';

interface FormData {
  name: string;
  email: string;
  phone: string;
  message: string;
}

const FORM_VACIO: FormData = { name: '', email: '', phone: '', message: '' };

export default function NuevoLeadPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(FORM_VACIO);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<LeadQualificado | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    // Limpiar error al escribir
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (procesando) return;

    // Validación básica
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Nombre, email y mensaje son obligatorios.');
      return;
    }

    try {
      setProcesando(true);
      setError(null);
      const res = await cualificarLead({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        message: form.message.trim(),
      });
      setResultado(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el lead');
    } finally {
      setProcesando(false);
    }
  }

  function resetear() {
    setForm(FORM_VACIO);
    setResultado(null);
    setError(null);
  }

  // ── Vista de resultado ────────────────────────────────────────────────────
  if (resultado) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Resultado del análisis</h1>
        <p className="text-sm text-gray-500 mb-8">El agente ha procesado el lead correctamente.</p>

        {/* Clasificación y score */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <LeadBadge clasificacion={resultado.classification} />
            <span className="text-3xl font-bold text-gray-900">{resultado.score}<span className="text-base font-normal text-gray-400">/10</span></span>
          </div>
          <ScoreBar score={resultado.score} />
          <p className="text-sm text-gray-600 mt-4 leading-relaxed">
            <span className="font-semibold">Razonamiento: </span>
            {resultado.reasoning}
          </p>
        </div>

        {/* Email generado */}
        <div className="mb-6">
          <EmailPreview email={resultado.generated_email} />
        </div>

        {/* Acciones recomendadas */}
        {resultado.recommended_actions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Próximos pasos
            </p>
            <ul className="space-y-2">
              {resultado.recommended_actions.map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Acciones finales */}
        <div className="flex gap-3">
          <Link
            href="/leads"
            className="flex-1 text-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Ver todos los leads
          </Link>
          <Link
            href={`/leads/${resultado.lead_id}`}
            className="flex-1 text-center px-4 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold rounded-xl transition-colors"
          >
            Ver detalle del lead
          </Link>
          <button
            onClick={resetear}
            className="px-4 py-2.5 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm rounded-xl transition-colors"
          >
            Nuevo
          </button>
        </div>
      </div>
    );
  }

  // ── Formulario ────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Cualificar nuevo lead</h1>
        <p className="text-sm text-gray-500 mt-1">
          El agente de IA analizará el mensaje, puntuará el lead y generará un email de respuesta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Nombre */}
        <div>
          <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            placeholder="María García"
            disabled={procesando}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed transition-shadow"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="maria@empresa.com"
            disabled={procesando}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed transition-shadow"
          />
        </div>

        {/* Teléfono */}
        <div>
          <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Teléfono <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            placeholder="+34 600 000 000"
            disabled={procesando}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed transition-shadow"
          />
        </div>

        {/* Mensaje */}
        <div>
          <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Mensaje del lead <span className="text-red-500">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={5}
            value={form.message}
            onChange={handleChange}
            placeholder="Somos una empresa de 10 personas y buscamos automatizar nuestro proceso de ventas..."
            disabled={procesando}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed resize-none transition-shadow"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Botón de envío */}
        <button
          type="submit"
          disabled={procesando}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {procesando ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              El agente está analizando el lead...
            </>
          ) : (
            <>
              <span>✨</span>
              Cualificar con IA
            </>
          )}
        </button>
      </form>
    </div>
  );
}
