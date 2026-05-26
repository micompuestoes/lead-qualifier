'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { cualificarLead } from '@/lib/api';
import type { LeadQualificado } from '@/types/lead';
import LeadBadge from '@/components/LeadBadge';
import ScoreBar from '@/components/ScoreBar';
import { useToast } from '@/components/Toast';
import { useTheme } from '@/components/ThemeProvider';

interface FormData { name: string; email: string; phone: string; message: string }
const FORM_VACIO: FormData = { name: '', email: '', phone: '', message: '' };

const PASOS = [
  { label: 'Analizando intención del mensaje…',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" /></svg> },
  { label: 'Identificando empresa y sector…',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg> },
  { label: 'Generando clasificación y email…',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg> },
];

const COLORES_CONFETI = ['#c8a96e','#ede0c8','#b45309','#6ea8c8','#9a7a3a','#f5f0e8','#1a1814'];

function Confetti() {
  const piezas = useRef(Array.from({ length: 36 }, (_, i) => ({
    id: i,
    color: COLORES_CONFETI[i % COLORES_CONFETI.length],
    left:   `${(i / 36) * 100 + Math.sin(i) * 5}%`,
    delay:    `${(i * 0.07).toFixed(2)}s`,
    duration: `${2.2 + (i % 5) * 0.3}s`,
    size:   `${6 + (i % 4) * 3}px`,
    borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '0',
  }))).current;
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-30">
      {piezas.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: '-16px', left: p.left,
          width: p.size, height: p.size, backgroundColor: p.color,
          borderRadius: p.borderRadius,
          animation: `confetti-fall ${p.duration} ${p.delay} ease-in forwards`,
        }} />
      ))}
    </div>
  );
}

// ── Inputs con tema ───────────────────────────────────────────────────────────

function Input({ id, name, type = 'text', value, onChange, placeholder, disabled, required, inputStyle, focusStyle }: {
  id: string; name: string; type?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; disabled?: boolean; required?: boolean;
  inputStyle: React.CSSProperties; focusStyle: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input id={id} name={name} type={type} value={value} onChange={onChange}
      placeholder={placeholder} disabled={disabled} required={required}
      className="w-full px-4 py-2.5 rounded-xl text-sm transition-all outline-none disabled:cursor-not-allowed"
      style={{ ...inputStyle, ...(focused ? focusStyle : {}), opacity: disabled ? 0.6 : 1 }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    />
  );
}

function Textarea({ id, name, value, onChange, placeholder, disabled, inputStyle, focusStyle }: {
  id: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string; disabled?: boolean;
  inputStyle: React.CSSProperties; focusStyle: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea id={id} name={name} rows={5} value={value} onChange={onChange}
      placeholder={placeholder} disabled={disabled}
      className="w-full px-4 py-2.5 rounded-xl text-sm transition-all outline-none resize-none disabled:cursor-not-allowed"
      style={{ ...inputStyle, ...(focused ? focusStyle : {}), opacity: disabled ? 0.6 : 1 }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NuevoLeadPage() {
  const { addToast }  = useToast();
  const { getToken }  = useAuth();
  const { c }         = useTheme();

  const [form, setForm]               = useState<FormData>(FORM_VACIO);
  const [procesando, setProcesando]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [resultado, setResultado]     = useState<LeadQualificado | null>(null);
  const [pasoActivo, setPasoActivo]   = useState(0);
  const [scoreVisible, setScoreVisible] = useState(0);
  const [mostrarConfeti, setMostrarConfeti] = useState(false);

  useEffect(() => {
    if (!procesando) { setPasoActivo(0); return; }
    const t1 = setTimeout(() => setPasoActivo(1), 1500);
    const t2 = setTimeout(() => setPasoActivo(2), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [procesando]);

  useEffect(() => {
    if (!resultado) return;
    setScoreVisible(0);
    const target = resultado.score ?? 0;
    let current = 0;
    const iv = setInterval(() => {
      current = Math.min(current + 1, target);
      setScoreVisible(current);
      if (current >= target) clearInterval(iv);
    }, 60);
    if (target >= 8) { setMostrarConfeti(true); setTimeout(() => setMostrarConfeti(false), 4500); }
    return () => clearInterval(iv);
  }, [resultado]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
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
      setProcesando(true); setError(null);
      const res = await cualificarLead({
        name: form.name.trim(), email: form.email.trim(),
        phone: form.phone.trim() || undefined, message: form.message.trim(),
      }, getToken);
      setResultado(res);
      addToast(`Lead cualificado — score ${res.score}/10`, res.score >= 7 ? 'info' : 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el lead');
      addToast('Error al procesar el lead', 'error');
    } finally { setProcesando(false); }
  }

  function resetear() { setForm(FORM_VACIO); setResultado(null); setError(null); setScoreVisible(0); }

  // Estilos derivados del tema
  const inputStyle: React.CSSProperties = {
    border: `1.5px solid ${c.inputBorder}`,
    background: c.input,
    color: c.text1,
  };
  const focusStyle: React.CSSProperties = {
    border: `1.5px solid ${c.inputFocus}`,
    boxShadow: '0 0 0 3px rgba(200,169,110,0.1)',
  };

  // ── Resultado ──────────────────────────────────────────────────────────────

  if (resultado) {
    return (
      <div className="p-8 max-w-2xl">
        {mostrarConfeti && <Confetti />}

        <div className="animate-reveal-in mb-8">
          <h1 style={{ color: c.text1 }}>Lead cualificado</h1>
          <p className="text-sm mt-1" style={{ color: c.text2 }}>El agente ha procesado el lead correctamente.</p>
        </div>

        {/* Score + clasificación */}
        <div className="rounded-2xl p-6 mb-6 animate-reveal-in"
          style={{ background: c.card, border: c.cardBorder, animationDelay: '80ms' }}>
          <div className="flex items-center justify-between mb-4">
            <LeadBadge clasificacion={resultado.classification} />
            <span className="animate-score-pop text-4xl font-bold tabular-nums" style={{ color: c.text1 }}>
              {scoreVisible}
              <span className="text-lg font-normal" style={{ color: c.text2 }}>/10</span>
            </span>
          </div>
          <ScoreBar score={resultado.score} />
          <p className="text-sm mt-4 leading-relaxed" style={{ color: c.text4 }}>
            <span className="font-semibold" style={{ color: c.text1 }}>Razonamiento: </span>
            {resultado.reasoning}
          </p>
        </div>

        {/* Email generado */}
        <div className="mb-6 animate-reveal-in" style={{ animationDelay: '160ms' }}>
          <div className="rounded-xl overflow-hidden" style={{ border: c.cardBorder }}>
            <div className="px-4 py-3 flex items-center gap-2"
              style={{ background: c.muted, borderBottom: `1px solid ${c.divider}` }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="#c8a96e">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <span className="text-sm font-semibold" style={{ color: c.text1 }}>Email generado</span>
            </div>
            <div style={{ padding: '20px', background: c.card }}>
              <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed" style={{ color: c.text4 }}>
                {resultado.generated_email}
              </pre>
            </div>
          </div>
        </div>

        {/* Próximos pasos */}
        {resultado.recommended_actions.length > 0 && (
          <div className="rounded-2xl p-6 mb-8 animate-reveal-in"
            style={{ background: c.card, border: c.cardBorder, animationDelay: '240ms' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: c.text2 }}>
              Próximos pasos
            </p>
            <ul className="space-y-2">
              {resultado.recommended_actions.map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-sm" style={{ color: c.text4 }}>
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(200,169,110,0.15)', color: '#9a7a3a' }}>
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
            className="flex-1 text-center px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#c8a96e', color: '#1a1814', textDecoration: 'none' }}>
            Ver todos los leads
          </Link>
          <Link href={`/leads/${resultado.lead_id}`}
            className="flex-1 text-center px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ border: c.cardBorder, color: c.text1, background: 'transparent', textDecoration: 'none' }}>
            Ver detalle
          </Link>
          <button onClick={resetear}
            className="px-4 py-2.5 rounded-xl text-sm"
            style={{ border: `1.5px solid ${c.inputBorder}`, color: c.text2, background: 'transparent', cursor: 'pointer' }}>
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
        <h1 style={{ color: c.text1 }}>Cualificar nuevo lead</h1>
        <p className="text-sm mt-1" style={{ color: c.text2 }}>
          El agente de IA analizará el mensaje, puntuará el lead y generará un email de respuesta.
        </p>
      </div>

      {/* Pasos de procesamiento */}
      {procesando && (
        <div className="mb-8 rounded-2xl p-6 animate-fade-up"
          style={{ background: c.card, border: c.cardBorder }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: c.text2 }}>
            El agente está trabajando
          </p>
          <div className="space-y-4">
            {PASOS.map((paso, i) => {
              const activo = i === pasoActivo;
              const hecho  = i < pasoActivo;
              return (
                <div key={i} className="flex items-center gap-3 transition-opacity duration-500"
                  style={{ opacity: i > pasoActivo ? 0.3 : 1 }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all"
                    style={{
                      background: hecho  ? 'rgba(110,200,122,0.12)' :
                                  activo ? 'rgba(200,169,110,0.15)'  : 'rgba(200,169,110,0.06)',
                      color:      hecho  ? '#2d7a3a' :
                                  activo ? '#9a7a3a' : c.text2,
                    }}>
                    {hecho ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : paso.icon}
                  </div>
                  <span className="text-sm font-medium" style={{
                    color: hecho ? '#2d7a3a' : activo ? c.text1 : c.text2,
                  }}>
                    {paso.label}
                  </span>
                  {activo && (
                    <span className="ml-auto flex gap-1">
                      {[0, 1, 2].map(d => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full animate-dot-pulse"
                          style={{ background: '#c8a96e', animationDelay: `${d * 200}ms` }} />
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
        <div>
          <label htmlFor="name" className="block text-sm font-semibold mb-1.5" style={{ color: c.text1 }}>
            Nombre completo <span style={{ color: '#c8a96e' }}>*</span>
          </label>
          <Input id="name" name="name" value={form.name} onChange={handleChange}
            placeholder="María García" disabled={procesando} required
            inputStyle={inputStyle} focusStyle={focusStyle} />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-semibold mb-1.5" style={{ color: c.text1 }}>
            Email <span style={{ color: '#c8a96e' }}>*</span>
          </label>
          <Input id="email" name="email" type="email" value={form.email} onChange={handleChange}
            placeholder="maria@empresa.com" disabled={procesando} required
            inputStyle={inputStyle} focusStyle={focusStyle} />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-semibold mb-1.5" style={{ color: c.text1 }}>
            Teléfono <span className="font-normal" style={{ color: c.text2 }}>(opcional)</span>
          </label>
          <Input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange}
            placeholder="+34 600 000 000" disabled={procesando}
            inputStyle={inputStyle} focusStyle={focusStyle} />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-semibold mb-1.5" style={{ color: c.text1 }}>
            Mensaje del lead <span style={{ color: '#c8a96e' }}>*</span>
          </label>
          <Textarea id="message" name="message" value={form.message} onChange={handleChange}
            placeholder="Somos una empresa de 10 personas y buscamos automatizar nuestro proceso de ventas…"
            disabled={procesando} inputStyle={inputStyle} focusStyle={focusStyle} />
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3"
            style={{ background: 'rgba(180,83,9,0.08)', border: '1px solid rgba(180,83,9,0.2)' }}>
            <p className="text-sm" style={{ color: '#b45309' }}>{error}</p>
          </div>
        )}

        <button type="submit" disabled={procesando}
          className="w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: '#c8a96e', color: '#1a1814', border: 'none', cursor: 'pointer' }}>
          {procesando ? (
            <>
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'rgba(26,24,20,0.25)', borderTopColor: '#1a1814' }} />
              Procesando…
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
