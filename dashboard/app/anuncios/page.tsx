'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useToast } from '@/components/Toast';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const TIPOS    = ['Piso', 'Casa', 'Ático', 'Estudio', 'Chalet', 'Local', 'Oficina', 'Terreno'];
const OPS      = ['Venta', 'Alquiler', 'Alquiler vacacional'];
const EXTRAS   = ['Terraza', 'Parking', 'Piscina', 'Ascensor', 'A/C', 'Reformado', 'Luminoso', 'Exterior', 'Vistas al mar', 'Jardín', 'Trastero', 'Amueblado'];
const CANALES  = [
  { id: 'idealista', label: 'Idealista', desc: 'Profesional · hasta 1700 car.' },
  { id: 'rrss',      label: 'Redes sociales', desc: 'Dinámico · hasta 450 car.' },
  { id: 'email',     label: 'Email al lead', desc: 'Consultivo · hasta 450 car.' },
];

interface Draft { titulo: string; body: string; }
interface Drafts { idealista?: Draft; rrss?: Draft; email?: Draft; }

export default function AnunciosPage() {
  const { getToken } = useAuth();
  const { addToast } = useToast();

  const [form, setForm] = useState({
    tipo: '', op: '', ubi: '', m2: '', hab: '', ban: '', precio: '', notas: '',
  });
  const [extras, setExtras]     = useState<string[]>([]);
  const [canales, setCanales]   = useState<string[]>(['idealista', 'rrss']);
  const [generando, setGenerando] = useState(false);
  const [drafts, setDrafts]     = useState<Drafts | null>(null);
  const [copiado, setCopiado]   = useState<string | null>(null);
  const [editado, setEditado]   = useState<Drafts>({});

  function toggleExtra(e: string) {
    setExtras(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  }
  function toggleCanal(c: string) {
    setCanales(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  async function generar(e: React.FormEvent) {
    e.preventDefault();
    if (!canales.length) { addToast('Selecciona al menos un canal', 'error'); return; }
    setGenerando(true);
    setDrafts(null);
    setEditado({});
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/generate-ad`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

  const input = "w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 transition-all";
  const inputStyle = { borderColor: 'rgba(200,169,110,0.3)', background: 'rgba(249,245,238,0.6)', color: '#1a1814' };
  const focusStyle = { '--tw-ring-color': '#c8a96e' } as React.CSSProperties;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 style={{ color: '#1a1814' }}>Generador de anuncios</h1>
        <p className="text-sm mt-1" style={{ color: '#7a7468' }}>
          Describe el inmueble y la IA redactará anuncios listos para publicar en cada canal.
        </p>
      </div>

      <form onSubmit={generar} className="space-y-6">
        {/* Tipo y operación */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#7a7468' }}>Tipo de inmueble</label>
            <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
              required className={input} style={{ ...inputStyle, ...focusStyle }}>
              <option value="">Seleccionar…</option>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#7a7468' }}>Operación</label>
            <select value={form.op} onChange={e => setForm(p => ({ ...p, op: e.target.value }))}
              required className={input} style={{ ...inputStyle, ...focusStyle }}>
              <option value="">Seleccionar…</option>
              {OPS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* Ubicación */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#7a7468' }}>Ubicación</label>
          <input type="text" value={form.ubi} required
            onChange={e => setForm(p => ({ ...p, ubi: e.target.value }))}
            placeholder="Ej. Calle Mayor 12, Madrid" className={input} style={{ ...inputStyle, ...focusStyle }} />
        </div>

        {/* Detalles */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { key: 'm2', label: 'm²' },
            { key: 'hab', label: 'Habitaciones' },
            { key: 'ban', label: 'Baños' },
            { key: 'precio', label: 'Precio' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#7a7468' }}>{label}</label>
              <input type="text" value={(form as Record<string, string>)[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={key === 'precio' ? '250.000 €' : '—'}
                className={input} style={{ ...inputStyle, ...focusStyle }} />
            </div>
          ))}
        </div>

        {/* Extras */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: '#7a7468' }}>Características</label>
          <div className="flex flex-wrap gap-2">
            {EXTRAS.map(e => (
              <button key={e} type="button" onClick={() => toggleExtra(e)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                style={{
                  background: extras.includes(e) ? '#c8a96e' : 'rgba(200,169,110,0.1)',
                  color: extras.includes(e) ? '#1a1814' : '#7a7468',
                  border: extras.includes(e) ? 'none' : '1px solid rgba(200,169,110,0.25)',
                }}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#7a7468' }}>
            Notas del agente <span style={{ color: '#c8a96e', fontWeight: 400 }}>(opcional)</span>
          </label>
          <textarea value={form.notas} rows={3}
            onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
            placeholder="Detalles extra: recién reformado, gran luminosidad, muy tranquilo…"
            className={`${input} resize-none`} style={{ ...inputStyle, ...focusStyle }} />
        </div>

        {/* Canales */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: '#7a7468' }}>Canales a generar</label>
          <div className="flex gap-3">
            {CANALES.map(c => (
              <button key={c.id} type="button" onClick={() => toggleCanal(c.id)}
                className="flex-1 py-3 px-4 rounded-xl text-left transition-all"
                style={{
                  background: canales.includes(c.id) ? 'rgba(200,169,110,0.15)' : 'rgba(249,245,238,0.5)',
                  border: canales.includes(c.id) ? '1.5px solid #c8a96e' : '1.5px solid rgba(200,169,110,0.2)',
                }}>
                <p className="text-sm font-medium" style={{ color: '#1a1814' }}>{c.label}</p>
                <p className="text-xs mt-0.5" style={{ color: '#7a7468' }}>{c.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={generando}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
          style={{ background: '#c8a96e', color: '#1a1814' }}>
          {generando ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-[#1a1814]/30 border-t-[#1a1814] rounded-full animate-spin" />
              Generando anuncios…
            </span>
          ) : 'Generar anuncios'}
        </button>
      </form>

      {/* Resultados */}
      {drafts && (
        <div className="space-y-4 animate-fade-up">
          <h2 className="text-lg" style={{ color: '#1a1814' }}>Anuncios generados</h2>
          {CANALES.filter(c => (drafts as Record<string, Draft | undefined>)[c.id]).map(c => {
            const draft = (editado as Record<string, Draft>)[c.id];
            if (!draft) return null;
            return (
              <div key={c.id} className="rounded-xl p-5 space-y-3"
                style={{ background: '#fff', border: '1.5px solid rgba(200,169,110,0.2)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: '#1a1814' }}>{c.label}</span>
                  <button onClick={() => copiar(c.id, `${draft.titulo}\n\n${draft.body}`)}
                    className="text-xs px-3 py-1 rounded-lg transition-all"
                    style={{ background: copiado === c.id ? '#c8a96e' : 'rgba(200,169,110,0.1)', color: '#1a1814' }}>
                    {copiado === c.id ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
                <input value={draft.titulo}
                  onChange={e => setEditado(prev => ({ ...prev, [c.id]: { ...prev[c.id as keyof Drafts]!, titulo: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-lg text-sm font-medium focus:outline-none"
                  style={{ background: 'rgba(249,245,238,0.6)', border: '1px solid rgba(200,169,110,0.2)', color: '#1a1814' }} />
                <textarea value={draft.body} rows={5}
                  onChange={e => setEditado(prev => ({ ...prev, [c.id]: { ...prev[c.id as keyof Drafts]!, body: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none"
                  style={{ background: 'rgba(249,245,238,0.6)', border: '1px solid rgba(200,169,110,0.2)', color: '#1a1814' }} />
                <p className="text-xs text-right" style={{ color: '#7a7468' }}>
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
