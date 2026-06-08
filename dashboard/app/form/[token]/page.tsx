'use client';

// Formulario público de captación de leads.
// No requiere login — cualquier visitante de la web de la inmobiliaria puede rellenarlo.
// URL: /form/lq_xxxxxxxxxxxxxxxxxx

import { useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';

interface FormState {
  name: string;
  email: string;
  phone: string;
  message: string;
  website: string;   // honeypot anti-bots (oculto)
}

type Paso = 'formulario' | 'enviando' | 'ok' | 'error';

// Extrae un mensaje legible del `detail` del backend (string, objeto o lista de validación 422)
function mensajeError(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map(e => (e && typeof e === 'object' && 'msg' in e ? String((e as { msg: unknown }).msg) : ''))
      .filter(Boolean);
    return msgs.length ? msgs.join('. ') : fallback;
  }
  if (detail && typeof detail === 'object') {
    const d = detail as { message?: unknown; msg?: unknown };
    if (typeof d.message === 'string') return d.message;
    if (typeof d.msg === 'string') return d.msg;
  }
  return fallback;
}

function Logo({ size = 44 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
      background: 'linear-gradient(135deg, #d4b87a 0%, #c8a96e 45%, #a8895a 100%)',
      boxShadow: '0 6px 20px rgba(200,169,110,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 24 24" fill="none"
        strokeWidth={2.2} stroke="#1a1814" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
      </svg>
    </div>
  );
}

export default function FormularioPublico({ params }: { params: { token: string } }) {
  const { c } = useTheme();
  const [form, setForm] = useState<FormState>({ name: '', email: '', phone: '', message: '', website: '' });
  const [paso, setPaso] = useState<Paso>('formulario');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

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
            Te hemos enviado una confirmación a <strong style={{ color: c.text2 }}>{form.email}</strong>
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
              background: '#c8a96e', color: '#1a1814', border: 'none', cursor: 'pointer',
            }}>
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  // ── Formulario ──
  const completo = form.name && form.email && form.message;
  return (
    <div style={pageStyle}>
      <div style={cardStyle} className="animate-fade-up">

        {/* Cabecera */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', marginBottom: 16 }}>
            <Logo />
          </div>
          <h1 style={{
            fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.75rem',
            color: c.text1, marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>
            ¿Buscas tu próxima propiedad?
          </h1>
          <p style={{ fontSize: 14, color: c.text2, lineHeight: 1.55 }}>
            Cuéntanos qué necesitas y te contactamos en menos de 24 horas.
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
            <input type="tel" name="phone" value={form.phone} onChange={handleChange}
              onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)}
              placeholder="+34 600 000 000" style={inputStyle('phone')} />
          </div>

          <div>
            <label style={labelStyle}>¿Qué estás buscando? *</label>
            <textarea name="message" required rows={4} value={form.message} onChange={handleChange}
              onFocus={() => setFocused('message')} onBlur={() => setFocused(null)}
              placeholder="Busco un piso de 3 habitaciones en el centro, con presupuesto de 250.000 €. Quiero comprar, no alquilar."
              style={{ ...inputStyle('message'), resize: 'none', lineHeight: 1.55 }} />
            <p style={{ fontSize: 12, color: c.text3, marginTop: 6 }}>
              Cuanto más detallado, mejor podremos ayudarte (zona, presupuesto, plazo…).
            </p>
          </div>

          <button type="submit" disabled={!completo}
            style={{
              width: '100%', padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 600,
              border: 'none', marginTop: 4,
              background: completo ? '#c8a96e' : 'rgba(200,169,110,0.4)',
              color: '#1a1814',
              cursor: completo ? 'pointer' : 'not-allowed',
              boxShadow: completo ? '0 2px 16px rgba(200,169,110,0.4)' : 'none',
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
