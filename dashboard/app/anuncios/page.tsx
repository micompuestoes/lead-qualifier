'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useToast } from '@/components/Toast';
import { useTheme } from '@/components/ThemeProvider';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const TIPOS   = ['Piso', 'Casa', 'Ático', 'Estudio', 'Chalet', 'Local', 'Oficina', 'Terreno'];
const OPS     = ['Venta', 'Alquiler', 'Alquiler vacacional'];
const EXTRAS  = ['Terraza', 'Parking', 'Piscina', 'Ascensor', 'A/C', 'Reformado', 'Luminoso', 'Exterior', 'Vistas al mar', 'Jardín', 'Trastero', 'Amueblado'];
const CANALES = [
  { id: 'idealista', label: 'Idealista',      desc: 'Profesional · hasta 1700 car.' },
  { id: 'rrss',      label: 'Redes sociales', desc: 'Dinámico · hasta 450 car.'    },
  { id: 'email',     label: 'Email al lead',  desc: 'Consultivo · hasta 450 car.'  },
];

interface Draft  { titulo: string; body: string }
interface Drafts { idealista?: Draft; rrss?: Draft; email?: Draft }

export default function AnunciosPage() {
  const { getToken } = useAuth();
  const { addToast } = useToast();
  const { c } = useTheme();

  const [form, setForm] = useState({ tipo: '', op: '', ubi: '', m2: '', hab: '', ban: '', precio: '', notas: '' });
  const [extras, setExtras]     = useState<string[]>([]);
  const [canales, setCanales]   = useState<string[]>(['idealista', 'rrss']);
  const [generando, setGenerando] = useState(false);
  const [drafts, setDrafts]     = useState<Drafts | null>(null);
  const [copiado, setCopiado]   = useState<string | null>(null);
  const [editado, setEditado]   = useState<Drafts>({});
  const [focused, setFocused]   = useState<string | null>(null);

  function toggleExtra(e: string) {
    setExtras(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  }
  function toggleCanal(id: string) {
    setCanales(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function generar(e: React.FormEvent) {
    e.preventDefault();
    if (!canales.length) { addToast('Selecciona al menos un canal', 'error'); return; }
    setGenerando(true); setDrafts(null); setEditado({});
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/generate-ad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...form, extras, canales }),
      });
      if (res.status === 403) {
        const err = await res.json();
        if (err.detail?.code === 'PLAN_REQUIRED') {
          addToast('El generador de anuncios es exclusivo del plan Agencia', 'error');
          return;
        }
      }
      if (!res.ok) throw new Error('Error al generar');
      const data = await res.json();
      setDrafts(data.drafts);
      setEditado(data.drafts);
    } catch {
      addToast('Error al generar los anuncios', 'error');
    } finally {
      setGenerando(false);
    }
  }

  function copiar(canal: string, texto: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(canal);
    setTimeout(() => setCopiado(null), 2000);
  }

  // Estilos de inputs respetuosos del tema
  function getInputStyle(name: string): React.CSSProperties {
    const isFocused = focused === name;
    return {
      width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 14,
      outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
      background: c.input,
      color: c.text1,
      border: isFocused
        ? `1.5px solid ${c.inputFocus}`
        : `1.5px solid ${c.inputBorder}`,
      boxShadow: isFocused ? '0 0 0 3px rgba(200,169,110,0.1)' : 'none',
    };
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: c.text2, marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 style={{ color: c.text1 }}>Generador de anuncios</h1>
        <p className="text-sm mt-1" style={{ color: c.text2 }}>
          Describe el inmueble y la IA redactará anuncios listos para publicar en cada canal.
        </p>
      </div>

      <form onSubmit={generar} className="space-y-6">

        {/* Tipo y operación */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'tipo', label: 'Tipo de inmueble', opts: TIPOS },
            { key: 'op',   label: 'Operación',        opts: OPS  },
          ].map(({ key, label, opts }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <select
                value={(form as Record<string, string>)[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                required
                onFocus={() => setFocused(key)} onBlur={() => setFocused(null)}
                style={{ ...getInputStyle(key), appearance: 'auto' as 'auto' }}
              >
                <option value="">Seleccionar…</option>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Ubicación */}
        <div>
          <label style={labelStyle}>Ubicación</label>
          <input type="text" value={form.ubi} required
            onChange={e => setForm(p => ({ ...p, ubi: e.target.value }))}
            onFocus={() => setFocused('ubi')} onBlur={() => setFocused(null)}
            placeholder="Ej. Calle Mayor 12, Madrid"
            style={getInputStyle('ubi')} />
        </div>

        {/* Detalles numéricos */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { key: 'm2',     label: 'm²',           ph: '80' },
            { key: 'hab',    label: 'Habitaciones',  ph: '3'  },
            { key: 'ban',    label: 'Baños',         ph: '2'  },
            { key: 'precio', label: 'Precio',        ph: '250.000 €' },
          ].map(({ key, label, ph }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input type="text" value={(form as Record<string, string>)[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                onFocus={() => setFocused(key)} onBlur={() => setFocused(null)}
                placeholder={ph} style={getInputStyle(key)} />
            </div>
          ))}
        </div>

        {/* Extras */}
        <div>
          <label style={labelStyle}>Características</label>
          <div className="flex flex-wrap gap-2">
            {EXTRAS.map(e => {
              const sel = extras.includes(e);
              return (
                <button key={e} type="button" onClick={() => toggleExtra(e)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: sel ? '#c8a96e' : 'rgba(200,169,110,0.1)',
                    color:      sel ? '#1a1814' : c.text2,
                    border:     sel ? 'none'    : `1px solid ${c.inputBorder}`,
                  }}>
                  {e}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notas */}
        <div>
          <label style={labelStyle}>
            Notas del agente{' '}
            <span style={{ color: '#c8a96e', textTransform: 'none', fontWeight: 400 }}>(opcional)</span>
          </label>
          <textarea value={form.notas} rows={3}
            onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
            onFocus={() => setFocused('notas')} onBlur={() => setFocused(null)}
            placeholder="Detalles extra: recién reformado, gran luminosidad, muy tranquilo…"
            style={{ ...getInputStyle('notas'), resize: 'none' }} />
        </div>

        {/* Canales */}
        <div>
          <label style={labelStyle}>Canales a generar</label>
          <div className="flex gap-3">
            {CANALES.map(canal => {
              const sel = canales.includes(canal.id);
              return (
                <button key={canal.id} type="button" onClick={() => toggleCanal(canal.id)}
                  className="flex-1 py-3 px-4 rounded-xl text-left transition-all duration-150"
                  style={{
                    background: sel ? 'rgba(200,169,110,0.13)' : c.muted,
                    border:     sel ? `1.5px solid #c8a96e`     : `1.5px solid ${c.inputBorder}`,
                  }}>
                  <p className="text-sm font-semibold" style={{ color: sel ? '#9a7a3a' : c.text1 }}>
                    {canal.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: c.text2 }}>{canal.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <button type="submit" disabled={generando}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
          style={{ background: '#c8a96e', color: '#1a1814', border: 'none', cursor: 'pointer' }}>
          {generando ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'rgba(26,24,20,0.25)', borderTopColor: '#1a1814' }} />
              Generando anuncios…
            </span>
          ) : 'Generar anuncios'}
        </button>
      </form>

      {/* Resultados */}
      {drafts && (
        <div className="space-y-4 animate-fade-up">
          <h2 className="text-lg" style={{ color: c.text1 }}>Anuncios generados</h2>
          {CANALES.filter(canal => (drafts as Record<string, Draft | undefined>)[canal.id]).map(canal => {
            const draft = (editado as Record<string, Draft>)[canal.id];
            if (!draft) return null;
            return (
              <div key={canal.id} className="rounded-xl p-5 space-y-3 transition-all duration-200"
                style={{ background: c.card, border: c.cardBorder }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: c.text1 }}>{canal.label}</span>
                  <button onClick={() => copiar(canal.id, `${draft.titulo}\n\n${draft.body}`)}
                    className="text-xs px-3 py-1 rounded-lg transition-all"
                    style={{
                      background: copiado === canal.id ? '#c8a96e' : 'rgba(200,169,110,0.1)',
                      color:      copiado === canal.id ? '#1a1814' : c.text1,
                      border: 'none', cursor: 'pointer',
                    }}>
                    {copiado === canal.id ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
                <input value={draft.titulo}
                  onChange={e => setEditado(prev => ({ ...prev, [canal.id]: { ...prev[canal.id as keyof Drafts]!, titulo: e.target.value } }))}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
                    fontWeight: 500, outline: 'none', background: c.input,
                    border: `1px solid ${c.inputBorder}`, color: c.text1,
                  }} />
                <textarea value={draft.body} rows={5}
                  onChange={e => setEditado(prev => ({ ...prev, [canal.id]: { ...prev[canal.id as keyof Drafts]!, body: e.target.value } }))}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
                    resize: 'none', outline: 'none', background: c.input,
                    border: `1px solid ${c.inputBorder}`, color: c.text1,
                  }} />
                <p className="text-xs text-right" style={{ color: c.text2 }}>
                  {draft.body.length} caracteres
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
