'use client';

// Editor de la marca del formulario público de la agencia.
// Cada cuenta edita SOLO su propio formulario (endpoint /me/form-branding,
// atado al tenant autenticado). Reutilizable como página propia o sección.

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useToast } from '@/components/Toast';
import { useTheme } from '@/components/ThemeProvider';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function FormBrandingCard() {
  const { addToast } = useToast();
  const { getToken } = useAuth();
  const { c } = useTheme();

  const [brandForm, setBrandForm] = useState({ brand_color: '', logo_url: '', form_title: '', form_subtitle: '' });
  const [apiKey, setApiKey]       = useState('');
  const [guardando, setGuardando] = useState(false);
  const [focused, setFocused]     = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const token = await getToken();
        const res = await fetch(`${apiBase}/me`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) return;
        const data = await res.json();
        setApiKey(data.api_key ?? '');
        setBrandForm({
          brand_color: data.brand_color ?? '',
          logo_url: data.logo_url ?? '',
          form_title: data.form_title ?? '',
          form_subtitle: data.form_subtitle ?? '',
        });
      } catch { /* silencioso: se mostrará la marca por defecto */ }
    }
    cargar();
  }, [getToken]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/me/form-branding`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body:    JSON.stringify(brandForm),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail ?? 'Error al guardar'); }
      const data = await res.json();
      setBrandForm({
        brand_color: data.brand_color ?? '',
        logo_url: data.logo_url ?? '',
        form_title: data.form_title ?? '',
        form_subtitle: data.form_subtitle ?? '',
      });
      addToast('Marca del formulario guardada', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al guardar', 'error');
    } finally {
      setGuardando(false);
    }
  }

  // ── Estilos (dependen del tema) ──
  const card: React.CSSProperties = { background: c.card, border: c.cardBorder, borderRadius: '16px', padding: '24px' };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600, color: c.text2,
    marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em',
  };
  const btnPrimary: React.CSSProperties = {
    background: '#c8a96e', color: '#1a1814', border: 'none', borderRadius: '10px',
    padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s',
  };
  function inputStyleFor(name: string): React.CSSProperties {
    const f = focused === name;
    return {
      width: '100%', padding: '10px 14px', borderRadius: '10px',
      border: f ? '1.5px solid #c8a96e' : `1.5px solid ${c.inputBorder}`,
      background: c.input, color: c.text1, fontSize: '14px', outline: 'none',
      boxShadow: f ? '0 0 0 3px rgba(200,169,110,0.1)' : 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    };
  }

  const opt: React.CSSProperties = { color: c.text3, textTransform: 'none', fontWeight: 400, marginLeft: 6 };

  return (
    <div style={card}>
      <h2 className="text-base font-semibold mb-1" style={{ color: c.text1 }}>
        Personaliza tu formulario
      </h2>
      <p className="text-sm mb-5" style={{ color: c.text2 }}>
        Da al formulario público la imagen de tu agencia: tu logo, tu color y tus textos.
        Así encaja con tu web y tus clientes ven tu marca, no la nuestra.
      </p>

      <form onSubmit={guardar} className="space-y-4">
        {/* Color de marca */}
        <div>
          <label style={labelStyle}>Color de marca</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandForm.brand_color || '#c8a96e'}
              onChange={e => setBrandForm(p => ({ ...p, brand_color: e.target.value }))}
              style={{ width: 46, height: 40, borderRadius: 10, border: `1.5px solid ${c.inputBorder}`, background: 'transparent', cursor: 'pointer', padding: 2 }}
            />
            <input
              type="text"
              value={brandForm.brand_color}
              onChange={e => setBrandForm(p => ({ ...p, brand_color: e.target.value }))}
              onFocus={() => setFocused('brand-color')}
              onBlur={() => setFocused(null)}
              placeholder="#c8a96e"
              style={{ ...inputStyleFor('brand-color'), maxWidth: 160 }}
            />
            {brandForm.brand_color && (
              <button type="button" onClick={() => setBrandForm(p => ({ ...p, brand_color: '' }))}
                className="text-xs" style={{ color: c.text3, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                restablecer
              </button>
            )}
          </div>
        </div>

        {/* Logo */}
        <div>
          <label style={labelStyle}>Logo <span style={opt}>· opcional, URL de la imagen</span></label>
          <input
            type="url"
            value={brandForm.logo_url}
            onChange={e => setBrandForm(p => ({ ...p, logo_url: e.target.value }))}
            onFocus={() => setFocused('logo-url')}
            onBlur={() => setFocused(null)}
            placeholder="https://tuweb.es/logo.png"
            style={inputStyleFor('logo-url')}
          />
          {brandForm.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandForm.logo_url} alt="Vista previa del logo" style={{ maxHeight: 40, marginTop: 10, objectFit: 'contain' }} />
          )}
        </div>

        {/* Título */}
        <div>
          <label style={labelStyle}>Título del formulario <span style={opt}>· opcional</span></label>
          <input
            type="text"
            value={brandForm.form_title}
            onChange={e => setBrandForm(p => ({ ...p, form_title: e.target.value }))}
            onFocus={() => setFocused('form-title')}
            onBlur={() => setFocused(null)}
            maxLength={120}
            placeholder="¿Buscas tu próxima propiedad?"
            style={inputStyleFor('form-title')}
          />
        </div>

        {/* Subtítulo */}
        <div>
          <label style={labelStyle}>Subtítulo <span style={opt}>· opcional</span></label>
          <input
            type="text"
            value={brandForm.form_subtitle}
            onChange={e => setBrandForm(p => ({ ...p, form_subtitle: e.target.value }))}
            onFocus={() => setFocused('form-subtitle')}
            onBlur={() => setFocused(null)}
            maxLength={200}
            placeholder="Cuéntanos qué necesitas y te contactamos en menos de 24 horas."
            style={inputStyleFor('form-subtitle')}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={guardando} style={{ ...btnPrimary, opacity: guardando ? 0.6 : 1 }}>
            {guardando ? 'Guardando…' : 'Guardar marca'}
          </button>
          {apiKey && (
            <a href={`/form/${apiKey}`} target="_blank" rel="noopener noreferrer"
              className="text-sm font-semibold" style={{ color: '#9a7a3a', textDecoration: 'none' }}>
              Ver mi formulario →
            </a>
          )}
        </div>
      </form>
    </div>
  );
}
