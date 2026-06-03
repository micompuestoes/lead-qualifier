'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useToast } from '@/components/Toast';
import { useTheme } from '@/components/ThemeProvider';
import PageHeader from '@/components/PageHeader';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const TIPOS  = ['Piso', 'Casa', 'Ático', 'Estudio', 'Chalet', 'Local', 'Oficina', 'Terreno'];
const OPS    = ['Venta', 'Alquiler', 'Alquiler vacacional'];
const EXTRAS = ['Terraza', 'Parking', 'Piscina', 'Ascensor', 'A/C', 'Reformado', 'Luminoso', 'Exterior', 'Vistas al mar', 'Jardín', 'Trastero', 'Amueblado'];

interface Draft  { titulo: string; body: string }
interface Drafts { idealista?: Draft; rrss?: Draft; email?: Draft }

// ── Canal config ──────────────────────────────────────────────────────────────

const CANALES = [
  { id: 'idealista', label: 'Idealista',      meta: 'Hasta 1.700 car.', sub: 'Formato profesional', maxChars: 1700 },
  { id: 'rrss',      label: 'Redes sociales', meta: 'Hasta 450 car.',   sub: 'Tono dinámico',       maxChars: 450  },
  { id: 'email',     label: 'Email al lead',  meta: 'Hasta 450 car.',   sub: 'Consultivo',           maxChars: 450  },
];

// ── SVG icons ─────────────────────────────────────────────────────────────────

function IconHome() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function IconBolt() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function canalIcon(id: string) {
  if (id === 'idealista') return <IconHome />;
  if (id === 'rrss')      return <IconShare />;
  return <IconMail />;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function charColor(len: number, max: number): string {
  const ratio = len / max;
  if (ratio > 1)   return '#ef4444';
  if (ratio > 0.9) return '#f59e0b';
  return '#6ec87a';
}

// ── Section divider ───────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.13em',
        textTransform: 'uppercase', color: '#c8a96e', flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(200,169,110,0.3) 0%, transparent 100%)' }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnunciosPage() {
  const { getToken } = useAuth();
  const { addToast } = useToast();
  const { c } = useTheme();

  const [form, setForm] = useState({
    tipo: '', op: '', ubi: '', m2: '', hab: '', ban: '', precio: '', notas: '',
  });
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
      if (!res.ok) throw new Error();
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
    setTimeout(() => setCopiado(null), 2200);
  }

  function inputStyle(name: string): React.CSSProperties {
    const isFoc = focused === name;
    return {
      width: '100%', padding: '10px 13px', borderRadius: 10, fontSize: 14,
      outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
      background: c.input, color: c.text1,
      border: isFoc ? `1.5px solid ${c.inputFocus}` : `1.5px solid ${c.inputBorder}`,
      boxShadow: isFoc ? '0 0 0 3px rgba(200,169,110,0.1)' : 'none',
    };
  }

  const labelSt: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.07em', textTransform: 'uppercase',
    color: c.text2, marginBottom: 7,
  };

  return (
    <div className="r-pad" style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>

      <PageHeader
        eyebrow="Herramientas IA"
        title="Generador de anuncios"
        description="Describe el inmueble y la IA redactará textos listos para publicar en cada canal."
      />

      <form onSubmit={generar} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── Inmueble ── */}
        <div>
          <SectionLabel label="Inmueble" />
          <div className="r-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {[
              { key: 'tipo', label: 'Tipo de inmueble', opts: TIPOS },
              { key: 'op',   label: 'Operación',        opts: OPS  },
            ].map(({ key, label, opts }) => (
              <div key={key}>
                <label style={labelSt}>{label}</label>
                <select
                  value={(form as Record<string, string>)[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  required
                  onFocus={() => setFocused(key)} onBlur={() => setFocused(null)}
                  style={{ ...inputStyle(key), appearance: 'auto' as 'auto' }}>
                  <option value="">Seleccionar…</option>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div>
            <label style={labelSt}>Ubicación</label>
            <input type="text" value={form.ubi} required
              onChange={e => setForm(p => ({ ...p, ubi: e.target.value }))}
              onFocus={() => setFocused('ubi')} onBlur={() => setFocused(null)}
              placeholder="Ej. Calle Mayor 12, Madrid"
              style={inputStyle('ubi')} />
          </div>
        </div>

        {/* ── Detalles ── */}
        <div>
          <SectionLabel label="Detalles" />
          <div className="r-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {[
              { key: 'm2',     label: 'm²',          ph: '80'        },
              { key: 'hab',    label: 'Habitaciones', ph: '3'         },
              { key: 'ban',    label: 'Baños',        ph: '2'         },
              { key: 'precio', label: 'Precio',       ph: '250.000 €' },
            ].map(({ key, label, ph }) => (
              <div key={key}>
                <label style={labelSt}>{label}</label>
                <input type="text"
                  value={(form as Record<string, string>)[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  onFocus={() => setFocused(key)} onBlur={() => setFocused(null)}
                  placeholder={ph} style={inputStyle(key)} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Características ── */}
        <div>
          <SectionLabel label="Características" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EXTRAS.map(e => {
              const sel = extras.includes(e);
              return (
                <button key={e} type="button" onClick={() => toggleExtra(e)}
                  style={{
                    padding: '7px 14px', borderRadius: 20, fontSize: 13,
                    fontWeight: sel ? 600 : 400,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: sel ? '#c8a96e' : 'rgba(200,169,110,0.07)',
                    color:      sel ? '#1a1814' : c.text2,
                    border:     sel ? '1.5px solid #c8a96e' : `1.5px solid ${c.inputBorder}`,
                  }}>
                  {e}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Publicación ── */}
        <div>
          <SectionLabel label="Publicación" />

          {/* Notas */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelSt}>
              Notas del agente{' '}
              <span style={{ color: '#c8a96e', textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>
                — opcional
              </span>
            </label>
            <textarea value={form.notas} rows={3}
              onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
              onFocus={() => setFocused('notas')} onBlur={() => setFocused(null)}
              placeholder="Detalles extra: recién reformado, gran luminosidad, muy tranquilo…"
              style={{ ...inputStyle('notas'), resize: 'none', lineHeight: 1.6 }} />
          </div>

          {/* Canales */}
          <div>
            <label style={labelSt}>Canales a generar</label>
            <div className="r-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {CANALES.map(canal => {
                const sel = canales.includes(canal.id);
                return (
                  <button key={canal.id} type="button" onClick={() => toggleCanal(canal.id)}
                    style={{
                      padding: '16px', borderRadius: 13, textAlign: 'left',
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: sel ? 'rgba(200,169,110,0.07)' : c.muted,
                      border: sel ? '1.5px solid rgba(200,169,110,0.45)' : `1.5px solid ${c.inputBorder}`,
                      display: 'flex', flexDirection: 'column', gap: 12,
                    }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: sel ? 'rgba(200,169,110,0.15)' : 'rgba(200,169,110,0.07)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: sel ? '#c8a96e' : c.text2,
                      transition: 'all 0.15s',
                    }}>
                      {canalIcon(canal.id)}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: sel ? '#9a7a3a' : c.text1, marginBottom: 3 }}>
                        {canal.label}
                      </p>
                      <p style={{ fontSize: 11, color: c.text2, marginBottom: 1 }}>{canal.meta}</p>
                      <p style={{ fontSize: 11, color: c.text3 }}>{canal.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Botón generar ── */}
        <button type="submit" disabled={generando}
          style={{
            width: '100%', padding: '14px', borderRadius: 13,
            fontSize: 14, fontWeight: 600, border: 'none',
            cursor: generando ? 'not-allowed' : 'pointer',
            background: generando ? 'rgba(200,169,110,0.45)' : '#c8a96e',
            color: '#1a1814',
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: generando ? 'none' : '0 2px 18px rgba(200,169,110,0.38)',
          }}>
          {generando ? (
            <>
              <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'rgba(26,24,20,0.2)', borderTopColor: '#1a1814' }} />
              Generando anuncios…
            </>
          ) : (
            <>
              <IconBolt />
              Generar anuncios con IA
            </>
          )}
        </button>
      </form>

      {/* ── Resultados ── */}
      {drafts && (
        <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 16 }}
          className="animate-fade-up">

          {/* Header de resultados */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#6ec87a' }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: c.text1 }}>
              {CANALES.filter(cn => (drafts as Record<string, Draft | undefined>)[cn.id]).length} anuncios generados
            </p>
          </div>

          {CANALES.filter(canal => (drafts as Record<string, Draft | undefined>)[canal.id]).map(canal => {
            const draft = (editado as Record<string, Draft>)[canal.id];
            if (!draft) return null;
            const ccLen   = draft.body.length;
            const ccColor = charColor(ccLen, canal.maxChars);

            return (
              <div key={canal.id}
                style={{ background: c.card, border: c.cardBorder, borderRadius: 16, overflow: 'hidden' }}>

                {/* Card header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderBottom: `1px solid ${c.inputBorder}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 9,
                      background: 'rgba(200,169,110,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#c8a96e',
                    }}>
                      {canalIcon(canal.id)}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: c.text1, lineHeight: 1.2 }}>
                        {canal.label}
                      </p>
                      <p style={{ fontSize: 11, color: c.text2 }}>{canal.meta}</p>
                    </div>
                  </div>

                  <button onClick={() => copiar(canal.id, `${draft.titulo}\n\n${draft.body}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 500,
                      padding: '7px 13px', borderRadius: 9,
                      border: 'none', cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: copiado === canal.id ? '#6ec87a18' : 'rgba(200,169,110,0.09)',
                      color: copiado === canal.id ? '#6ec87a' : c.text1,
                    }}>
                    {copiado === canal.id ? <><IconCheck /> Copiado</> : <><IconCopy /> Copiar</>}
                  </button>
                </div>

                {/* Editor */}
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input value={draft.titulo}
                    onChange={e => setEditado(prev => ({
                      ...prev, [canal.id]: { ...prev[canal.id as keyof Drafts]!, titulo: e.target.value },
                    }))}
                    placeholder="Título"
                    style={{
                      width: '100%', padding: '9px 13px', borderRadius: 9, fontSize: 14,
                      fontWeight: 600, outline: 'none', background: c.input, color: c.text1,
                      border: `1.5px solid ${c.inputBorder}`,
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = c.inputFocus; }}
                    onBlur={e => { e.currentTarget.style.borderColor = c.inputBorder; }}
                  />
                  <textarea value={draft.body} rows={6}
                    onChange={e => setEditado(prev => ({
                      ...prev, [canal.id]: { ...prev[canal.id as keyof Drafts]!, body: e.target.value },
                    }))}
                    style={{
                      width: '100%', padding: '9px 13px', borderRadius: 9, fontSize: 14,
                      resize: 'vertical', outline: 'none', lineHeight: 1.65,
                      background: c.input, color: c.text1,
                      border: `1.5px solid ${c.inputBorder}`,
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = c.inputFocus; }}
                    onBlur={e => { e.currentTarget.style.borderColor = c.inputBorder; }}
                  />

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: c.text3 }}>Editable antes de publicar</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: ccColor, fontVariantNumeric: 'tabular-nums' }}>
                      {ccLen} / {canal.maxChars} car.
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
