'use client';

// Formulario público de captación de leads.
// No requiere login — cualquier visitante de la web de la inmobiliaria puede rellenarlo.
// URL: /form/lq_xxxxxxxxxxxxxxxxxx

import { useEffect, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import PhoneInput from '@/components/PhoneInput';

interface Branding {
  agency_name: string;
  brand_color: string;
  logo_url: string;
  form_title: string;
  form_subtitle: string;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  message: string;
  website: string;   // honeypot anti-bots (oculto)
}

type Paso = 'formulario' | 'enviando' | 'ok' | 'error' | 'token-invalido';

// Validación en cliente (en español) — evita que el usuario vea errores del servidor
function validar(f: FormState): string | null {
  if (f.name.trim().length < 2) return 'Introduce tu nombre (al menos 2 letras).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'Introduce un email válido.';
  if (f.message.trim().length < 5) return 'Cuéntanos un poco más sobre lo que buscas (al menos 5 caracteres).';
  return null;
}

const CAMPOS: Record<string, string> = {
  name: 'El nombre', email: 'El email', message: 'El mensaje', phone: 'El teléfono',
};

// Traduce un error de validación 422 de FastAPI al castellano
function traducirValidacion(e: { type?: string; loc?: unknown[]; msg?: string; ctx?: { min_length?: number; max_length?: number } }): string {
  const campo = (Array.isArray(e.loc) && CAMPOS[String(e.loc[e.loc.length - 1])]) || 'Un campo';
  switch (e.type) {
    case 'string_too_short': return `${campo} debe tener al menos ${e.ctx?.min_length ?? ''} caracteres.`.replace('  ', ' ');
    case 'string_too_long':  return `${campo} es demasiado largo.`;
    case 'missing':          return `${campo} es obligatorio.`;
    case 'value_error':      return campo === 'El email' ? 'El email no es válido.' : `${campo} no es válido.`;
    default:
      if (typeof e.msg === 'string' && /email/i.test(e.msg)) return 'El email no es válido.';
      return e.msg || 'Hay un dato no válido.';
  }
}

// Extrae un mensaje legible (en español) del `detail` del backend
function mensajeError(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const msgs = detail.map(e => traducirValidacion(e)).filter(Boolean);
    return msgs.length ? msgs.join(' ') : fallback;
  }
  if (detail && typeof detail === 'object') {
    const d = detail as { message?: unknown; msg?: unknown };
    if (typeof d.message === 'string') return d.message;
    if (typeof d.msg === 'string') return d.msg;
  }
  return fallback;
}

// Elige texto negro o blanco según la luminancia del color de marca, para que
// el botón sea legible con cualquier color que ponga la agencia.
function contrastText(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#1a1814';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#1a1814' : '#ffffff';
}

export default function FormularioPublico({ params }: { params: { token: string } }) {
  const { c } = useTheme();
  const [form, setForm] = useState<FormState>({ name: '', email: '', phone: '', message: '', website: '' });
  const [paso, setPaso] = useState<Paso>('formulario');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [operacion, setOperacion]     = useState('');
  const [presupuesto, setPresupuesto] = useState('');
  const [acepto, setAcepto]           = useState(false);   // consentimiento RGPD
  const [brand, setBrand]             = useState<Branding | null>(null);

  // Color de marca de la agencia (con dorado Inmuebia como respaldo).
  const accent = (brand?.brand_color && brand.brand_color.trim()) || '#c8a96e';
  const titulo = (brand?.form_title && brand.form_title.trim()) || '¿Buscas tu próxima propiedad?';
  const subtitulo = (brand?.form_subtitle && brand.form_subtitle.trim())
    || 'Cuéntanos qué necesitas y te contactamos en menos de 24 horas.';
  const onAccent = contrastText(accent);   // color de texto legible sobre el color de marca

  const RANGOS_COMPRA = ['Hasta 100.000 €', '100.000 – 200.000 €', '200.000 – 300.000 €', '300.000 – 500.000 €', 'Más de 500.000 €'];
  const RANGOS_ALQUILER = ['Hasta 600 €/mes', '600 – 900 €/mes', '900 – 1.200 €/mes', 'Más de 1.200 €/mes'];
  const rangos = operacion === 'Alquilar' ? RANGOS_ALQUILER : RANGOS_COMPRA;

  function componerMensaje(): string {
    const extra: string[] = [];
    if (operacion)   extra.push(`Quiero ${operacion.toLowerCase()}.`);
    if (presupuesto) extra.push(`Presupuesto aproximado: ${presupuesto}.`);
    const cab = extra.join(' ');
    return cab ? `${cab}\n\n${form.message.trim()}` : form.message.trim();
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  // Carga la personalización de la agencia (logo, color, textos) al abrir el
  // formulario. De paso, si el token no existe (found: false), lo avisamos
  // ANTES de que el visitante rellene todo el formulario — antes solo se
  // enteraba al enviar, tras escribir su consulta entera.
  useEffect(() => {
    let vivo = true;
    fetch(`${apiBase}/form-config/${params.token}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!vivo || !data) return;
        if (data.found) setBrand(data as Branding);
        else setPaso('token-invalido');
      })
      .catch(() => { /* fallo de red: no bloqueamos el formulario por esto */ });
    return () => { vivo = false; };
  }, [apiBase, params.token]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Validación en cliente (en español) antes de enviar
    const av = validar(form);
    if (av) { setAviso(av); return; }
    if (!acepto) { setAviso('Debes aceptar la política de privacidad para enviar tu consulta.'); return; }
    setAviso('');
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
          message: componerMensaje(),
          website: form.website || null,   // honeypot
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(mensajeError(data.detail, `Error ${res.status} al enviar el formulario`));
      }
      setPaso('ok');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setPaso('error');
    }
  }

  // ── Estilos compartidos ──
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20, background: c.bgGradient,
  };
  const cardStyle: React.CSSProperties = {
    background: c.card, border: c.cardBorder, borderRadius: 20,
    padding: 36, width: '100%', maxWidth: 480,
    boxShadow: '0 20px 60px rgba(26,24,20,0.10)',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: c.text2, marginBottom: 7,
  };
  function inputStyle(name: string): React.CSSProperties {
    const f = focused === name;
    return {
      width: '100%', padding: '11px 13px', borderRadius: 11, fontSize: 14,
      outline: 'none', background: c.input, color: c.text1,
      border: f ? `1.5px solid ${c.inputFocus}` : `1.5px solid ${c.inputBorder}`,
      boxShadow: f ? '0 0 0 3px rgba(200,169,110,0.1)' : 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    };
  }

  // ── Enviando ──
  if (paso === 'enviando') {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin" style={{
            width: 44, height: 44, margin: '0 auto 16px', borderRadius: '50%',
            border: '3px solid rgba(200,169,110,0.25)', borderTopColor: '#c8a96e',
          }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: c.text2 }}>Enviando tu consulta…</p>
        </div>
      </div>
    );
  }

  // ── Éxito ──
  if (paso === 'ok') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }} className="animate-fade-up">
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
            background: 'rgba(110,200,122,0.12)', border: '1.5px solid rgba(110,200,122,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3a8a4a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{
            fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.6rem',
            color: c.text1, marginBottom: 10, letterSpacing: '-0.02em',
          }}>
            ¡Consulta recibida!
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: c.text2, marginBottom: 8 }}>
            Hemos recibido tu mensaje. En breve un agente se pondrá en contacto contigo.
          </p>
          <p style={{ fontSize: 12.5, color: c.text3 }}>
            Te responderemos a <strong style={{ color: c.text2 }}>{form.email}</strong>
          </p>
        </div>
      </div>
    );
  }

  // ── Token inválido: se detecta al cargar, antes de que el visitante escriba nada ──
  if (paso === 'token-invalido') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
            background: 'rgba(180,83,9,0.1)', border: '1.5px solid rgba(180,83,9,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </div>
          <h2 style={{
            fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.5rem',
            color: c.text1, marginBottom: 10,
          }}>
            Este formulario no está disponible
          </h2>
          <p style={{ fontSize: 13.5, color: c.text2, lineHeight: 1.6 }}>
            El enlace no es correcto o ya no está activo. Contacta directamente
            con la inmobiliaria para que te faciliten la forma de escribirles.
          </p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (paso === 'error') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
            background: 'rgba(180,83,9,0.1)', border: '1.5px solid rgba(180,83,9,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </div>
          <h2 style={{
            fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.5rem',
            color: c.text1, marginBottom: 10,
          }}>
            Algo fue mal
          </h2>
          <p style={{ fontSize: 13.5, color: '#b45309', marginBottom: 20 }}>{error}</p>
          <button onClick={() => setPaso('formulario')}
            style={{
              padding: '10px 22px', borderRadius: 11, fontSize: 13, fontWeight: 600,
              background: accent, color: onAccent, border: 'none', cursor: 'pointer',
            }}>
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  // ── Formulario ──
  const completo = Boolean(form.name && form.email && form.message && acepto);
  return (
    <div style={pageStyle}>
      <div style={cardStyle} className="animate-fade-up">

        {/* Cabecera — marca de la agencia */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            {brand?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_url} alt={brand.agency_name || 'Logo'}
                style={{ maxHeight: 54, maxWidth: 220, objectFit: 'contain' }} />
            ) : (
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: accent, boxShadow: `0 6px 20px ${accent}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {/* Icono neutro de inmueble (sin la marca Inmuebia) */}
                <svg width="25" height="25" viewBox="0 0 24 24" fill="none"
                  stroke={onAccent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11.25L12 3.75l9 7.5" />
                  <path d="M5.25 9.75v9.75c0 .414.336.75.75.75h12c.414 0 .75-.336.75-.75V9.75" />
                </svg>
              </div>
            )}
          </div>
          {brand?.agency_name && !brand?.logo_url && (
            <p style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: accent, marginBottom: 8,
            }}>
              {brand.agency_name}
            </p>
          )}
          <h1 style={{
            fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.75rem',
            color: c.text1, marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>
            {titulo}
          </h1>
          <p style={{ fontSize: 14, color: c.text2, lineHeight: 1.55 }}>
            {subtitulo}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Honeypot — oculto para humanos, los bots lo rellenan */}
          <input
            type="text" name="website" tabIndex={-1} autoComplete="off"
            value={form.website} onChange={handleChange}
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
          />

          <div>
            <label style={labelStyle}>Nombre completo *</label>
            <input type="text" name="name" required value={form.name} onChange={handleChange}
              onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
              placeholder="María García" style={inputStyle('name')} />
          </div>

          <div>
            <label style={labelStyle}>Email *</label>
            <input type="email" name="email" required value={form.email} onChange={handleChange}
              onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
              placeholder="maria@ejemplo.com" style={inputStyle('email')} />
          </div>

          <div>
            <label style={labelStyle}>
              Teléfono <span style={{ color: c.text3, textTransform: 'none', fontWeight: 400 }}>· opcional</span>
            </label>
            <PhoneInput onChange={val => setForm(p => ({ ...p, phone: val }))} />
          </div>

          {/* Operación */}
          <div>
            <label style={labelStyle}>
              ¿Qué quieres hacer? <span style={{ color: c.text3, textTransform: 'none', fontWeight: 400 }}>· opcional</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Comprar', 'Alquilar', 'Vender'].map(op => {
                const sel = operacion === op;
                return (
                  <button key={op} type="button"
                    onClick={() => { setOperacion(sel ? '' : op); setPresupuesto(''); }}
                    style={{
                      flex: 1, padding: '9px 8px', borderRadius: 10, fontSize: 13.5,
                      fontWeight: sel ? 600 : 500, cursor: 'pointer', transition: 'all 0.15s',
                      background: sel ? accent : 'transparent',
                      color: sel ? onAccent : c.text2,
                      border: sel ? `1.5px solid ${accent}` : `1.5px solid ${c.inputBorder}`,
                    }}>
                    {op}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Presupuesto (al comprar o alquilar). Con animación de entrada
              para que no sea un salto brusco justo antes de que el
              visitante baje el ratón hacia el mensaje. */}
          {(operacion === 'Comprar' || operacion === 'Alquilar') && (
            <div className="animate-fade-up">
              <label style={labelStyle}>
                Presupuesto aproximado <span style={{ color: c.text3, textTransform: 'none', fontWeight: 400 }}>· opcional</span>
              </label>
              <select value={presupuesto} onChange={e => setPresupuesto(e.target.value)}
                onFocus={() => setFocused('presupuesto')} onBlur={() => setFocused(null)}
                style={{ ...inputStyle('presupuesto'), appearance: 'auto' as 'auto', cursor: 'pointer' }}>
                <option value="">Seleccionar… (te ayuda a encontrar lo que encaja)</option>
                {rangos.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>
              {operacion === 'Vender' ? '¿Qué inmueble quieres vender? *' : '¿Qué estás buscando? *'}
            </label>
            <textarea name="message" required rows={4} value={form.message} onChange={handleChange}
              onFocus={() => setFocused('message')} onBlur={() => setFocused(null)}
              placeholder={operacion === 'Vender'
                ? 'Cuéntanos del inmueble: zona, tipo (piso, casa…), m², nº de habitaciones, estado…'
                : 'Cuéntanos los detalles: zona, nº de habitaciones, tipo de inmueble, plazo…'}
              style={{ ...inputStyle('message'), resize: 'none', lineHeight: 1.55 }} />
            <p style={{ fontSize: 12, color: c.text3, marginTop: 6 }}>
              Cuanto más detallado, mejor podremos ayudarte (zona, habitaciones, plazo…).
            </p>
          </div>

          {aviso && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10,
              background: 'rgba(180,83,9,0.07)', border: '1px solid rgba(180,83,9,0.2)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span style={{ fontSize: 13, color: '#b45309', lineHeight: 1.45 }}>{aviso}</span>
            </div>
          )}

          {/* Consentimiento RGPD */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={acepto}
              onChange={e => setAcepto(e.target.checked)}
              required
              style={{ marginTop: 2, width: 15, height: 15, accentColor: accent, cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: c.text2 }}>
              He leído y acepto la{' '}
              <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: '#9a7a3a', fontWeight: 600 }}>
                política de privacidad
              </a>
              . Mis datos se usarán únicamente para responder a mi consulta. *
            </span>
          </label>

          <button type="submit" disabled={!completo}
            style={{
              width: '100%', padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 600,
              border: 'none', marginTop: 4,
              background: completo ? accent : `${accent}66`,
              color: completo ? onAccent : `${onAccent}99`,
              cursor: completo ? 'pointer' : 'not-allowed',
              boxShadow: completo ? `0 2px 16px ${accent}66` : 'none',
              transition: 'all 0.15s',
            }}>
            Enviar consulta
          </button>

          <p style={{ fontSize: 11.5, color: c.text3, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Tus datos están protegidos y nunca se comparten con terceros.
          </p>
        </form>
      </div>
    </div>
  );
}
