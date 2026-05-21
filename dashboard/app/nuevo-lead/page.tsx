'use client';

// Formulario de cualificación con animación de pasos, contador de score y confeti

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cualificarLead } from '@/lib/api';
import type { LeadQualificado } from '@/types/lead';
import LeadBadge from '@/components/LeadBadge';
import ScoreBar from '@/components/ScoreBar';
import { useToast } from '@/components/Toast';

interface FormData {
  name: string;
  email: string;
  phone: string;
  message: string;
}

const FORM_VACIO: FormData = { name: '', email: '', phone: '', message: '' };

// Pasos visibles durante el procesamiento del agente
const PASOS = [
  {
    label: 'Analizando intención del mensaje...',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
      </svg>
    ),
  },
  {
    label: 'Identificando empresa y sector...',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  {
    label: 'Generando clasificación y email...',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
];

// ── Confeti CSS (score >= 8) ──────────────────────────────────────────────────

const COLORES_CONFETI = ['#f87171','#fb923c','#fbbf24','#4ade80','#60a5fa','#a78bfa','#f472b6'];

function Confetti() {
  // Generamos las piezas una sola vez con useMemo-like ref
  const piezas = useRef(
    Array.from({ length: 36 }, (_, i) => ({
      id: i,
      color: COLORES_CONFETI[i % COLORES_CONFETI.length],
      left: `${(i / 36) * 100 + (Math.sin(i) * 5)}%`,
      delay: `${(i * 0.07).toFixed(2)}s`,
      duration: `${2.2 + (i % 5) * 0.3}s`,
      size: `${6 + (i % 4) * 3}px`,
      borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '0',
    }))
  ).current;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-30">
      {piezas.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: '-16px',
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.borderRadius,
            animation: `confetti-fall ${p.duration} ${p.delay} ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function NuevoLeadPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [form, setForm] = useState<FormData>(FORM_VACIO);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<LeadQualificado | null>(null);

  // Paso activo durante el procesamiento (0, 1, 2)
  const [pasoActivo, setPasoActivo] = useState(0);

  // Score visible animado (cuenta de 0 hasta el valor real)
  const [scoreVisible, setScoreVisible] = useState(0);

  // Muestra el confeti si el score es alto
  const [mostrarConfeti, setMostrarConfeti] = useState(false);

  // Anima el paso activo mientras se procesa
  useEffect(() => {
    if (!procesando) {
      setPasoActivo(0);
      return;
    }
    // Paso 0 → 1 tras 1.5s, luego 1 → 2 tras otros 1.5s
    const t1 = setTimeout(() => setPasoActivo(1), 1500);
    const t2 = setTimeout(() => setPasoActivo(2), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [procesando]);

  // Cuando llega el resultado, anima el score del 0 al valor final
  useEffect(() => {
    if (!resultado) return;
    setScoreVisible(0);
    const target = resultado.score ?? 0;
    let current = 0;
    const intervalo = setInterval(() => {
      current = Math.min(current + 1, target);
      setScoreVisible(current);
      if (current >= target) clearInterval(intervalo);
    }, 60);

    // Confeti si score >= 8
    if (target >= 8) {
      setMostrarConfeti(true);
      setTimeout(() => setMostrarConfeti(false), 4500);
    }

    return () => clearInterval(intervalo);
  }, [resultado]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (procesando) return;

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
      addToast(
        `Lead cualificado — score ${res.score}/10`,
        res.score >= 7 ? 'info' : 'success'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el lead');
      addToast('Error al procesar el lead', 'error');
    } finally {
      setProcesando(false);
    }
  }

  function resetear() {
    setForm(FORM_VACIO);
    setResultado(null);
    setError(null);
    setScoreVisible(0);
  }

  // ── Vista de resultado ────────────────────────────────────────────────────

  if (resultado) {
    return (
      <div className="p-8 max-w-2xl">
        {mostrarConfeti && <Confetti />}

        <div className="animate-reveal-in">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Lead cualificado</h1>
          <p className="text-sm text-gray-500 mb-8">El agente ha procesado el lead correctamente.</p>
        </div>

        {/* Score animado + clasificación */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 animate-reveal-in"
          style={{ animationDelay: '80ms' }}>
          <div className="flex items-center justify-between mb-4">
            <LeadBadge clasificacion={resultado.classification} />
            <span className="animate-score-pop text-4xl font-bold text-gray-900 tabular-nums">
              {scoreVisible}
              <span className="text-lg font-normal text-gray-400">/10</span>
            </span>
          </div>
          <ScoreBar score={resultado.score} />
          <p className="text-sm text-gray-600 mt-4 leading-relaxed">
            <span className="font-semibold">Razonamiento: </span>
            {resultado.reasoning}
          </p>
        </div>

        {/* Email generado */}
        <div className="mb-6 animate-reveal-in" style={{ animationDelay: '160ms' }}>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <span className="text-sm font-semibold text-gray-700">Email generado</span>
              </div>
            </div>
            <div className="p-5 bg-white">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                {resultado.generated_email}
              </pre>
            </div>
          </div>
        </div>

        {/* Próximos pasos */}
        {resultado.recommended_actions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 animate-reveal-in"
            style={{ animationDelay: '240ms' }}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Próximos pasos
            </p>
            <ul className="space-y-2">
              {resultado.recommended_actions.map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full
                    flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Acciones finales */}
        <div className="flex gap-3 animate-reveal-in" style={{ animationDelay: '320ms' }}>
          <Link href="/leads"
            className="flex-1 text-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700
              text-white text-sm font-semibold rounded-xl transition-colors">
            Ver todos los leads
          </Link>
          <Link href={`/leads/${resultado.lead_id}`}
            className="flex-1 text-center px-4 py-2.5 border border-gray-300 text-gray-700
              hover:bg-gray-50 text-sm font-semibold rounded-xl transition-colors">
            Ver detalle del lead
          </Link>
          <button onClick={resetear}
            className="px-4 py-2.5 border border-gray-300 text-gray-600
              hover:bg-gray-50 text-sm rounded-xl transition-colors">
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

      {/* Animación de pasos durante el procesamiento */}
      {procesando && (
        <div className="mb-8 bg-white border border-gray-200 rounded-2xl p-6 animate-fade-up">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            El agente está trabajando
          </p>
          <div className="space-y-4">
            {PASOS.map((paso, i) => {
              const estaActivo = i === pasoActivo;
              const yaHecho   = i < pasoActivo;
              return (
                <div key={i} className={`flex items-center gap-3 transition-opacity duration-500 ${
                  i > pasoActivo ? 'opacity-30' : 'opacity-100'
                }`}>
                  {/* Indicador */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                    transition-colors ${
                      yaHecho   ? 'bg-green-100 text-green-600' :
                      estaActivo ? 'bg-blue-100 text-blue-600' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                    {yaHecho ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      paso.icon
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    yaHecho ? 'text-green-700' : estaActivo ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {paso.label}
                  </span>
                  {/* Dot pulsante en el paso activo */}
                  {estaActivo && (
                    <span className="ml-auto flex gap-1">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-dot-pulse"
                          style={{ animationDelay: `${d * 200}ms` }} />
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Nombre */}
        <div>
          <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input id="name" name="name" type="text" value={form.name} onChange={handleChange}
            placeholder="María García" disabled={procesando}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900
              placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:bg-gray-50 disabled:cursor-not-allowed transition-shadow"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Email <span className="text-red-500">*</span>
          </label>
          <input id="email" name="email" type="email" value={form.email} onChange={handleChange}
            placeholder="maria@empresa.com" disabled={procesando}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900
              placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:bg-gray-50 disabled:cursor-not-allowed transition-shadow"
          />
        </div>

        {/* Teléfono */}
        <div>
          <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Teléfono <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange}
            placeholder="+34 600 000 000" disabled={procesando}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900
              placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:bg-gray-50 disabled:cursor-not-allowed transition-shadow"
          />
        </div>

        {/* Mensaje */}
        <div>
          <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Mensaje del lead <span className="text-red-500">*</span>
          </label>
          <textarea id="message" name="message" rows={5} value={form.message} onChange={handleChange}
            placeholder="Somos una empresa de 10 personas y buscamos automatizar nuestro proceso de ventas..."
            disabled={procesando}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900
              placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:bg-gray-50 disabled:cursor-not-allowed resize-none transition-shadow"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Botón de envío */}
        <button type="submit" disabled={procesando}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white
            font-semibold rounded-xl transition-colors disabled:cursor-not-allowed
            flex items-center justify-center gap-3">
          {procesando ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Cualificar con IA
            </>
          )}
        </button>
      </form>
    </div>
  );
}
