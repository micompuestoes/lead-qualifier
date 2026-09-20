'use client';

// Demo pública interactiva de la landing: un visitante sin cuenta pega un
// mensaje y ve al instante cómo lo puntuaría Inmuebia — antes de registrarse.
// Llama a /demo/qualify (sin auth, sin persistencia, ver routers/demo.py).

import { useState } from 'react';
import { cualificarDemo, type ResultadoDemo } from '@/lib/api';
import LeadBadge from '@/components/LeadBadge';
import ScoreBar from '@/components/ScoreBar';

const GOLD = '#c8a96e';
const INK = '#1a1814';

const EJEMPLOS = [
  'Busco piso de 3 habitaciones en Chamberí, tenemos unos 480.000€ y la hipoteca preaprobada. Nos gustaría visitar algo esta misma semana.',
  'Hola, quiero vender mi piso en el centro de Valencia. ¿Podéis venir a tasarlo?',
  'Buenas, estoy mirando pisos de alquiler por la zona de Gràcia, aún no tengo claro el presupuesto.',
];

export default function DemoCualificador() {
  const [mensaje, setMensaje] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — invisible para humanos
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoDemo | null>(null);

  function rellenarEjemplo() {
    const ejemplo = EJEMPLOS[Math.floor(Math.random() * EJEMPLOS.length)];
    setMensaje(ejemplo);
    setResultado(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cargando || mensaje.trim().length < 10) return;
    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      const r = await cualificarDemo({ message: mensaje.trim(), website });
      setResultado(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la demo. Inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  const puntos = resultado?.reasoning
    ? resultado.reasoning.split(';').map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <section id="pruebalo" style={{ padding: '8px 24px 56px' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>
            Pruébalo tú mismo
          </p>
          <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontWeight: 400, fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', letterSpacing: '-0.02em', margin: '0 0 10px' }}>
            Pega un mensaje real. Sin registrarte.
          </h2>
          <p style={{ fontSize: 15, color: '#5a544c', maxWidth: 560, margin: '0 auto' }}>
            Copia la consulta de un cliente (o usa un ejemplo) y mira cómo la puntúa y responde Inmuebia en segundos.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: '#fff', border: '1.5px solid rgba(200,169,110,0.18)', borderRadius: 16,
          padding: 24, boxShadow: '0 1px 6px rgba(26,24,20,0.04)',
        }}>
          <textarea
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            placeholder="Ej: Busco piso de 3 habitaciones en el centro, presupuesto 300.000€, hipoteca preaprobada..."
            maxLength={600}
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              border: '1.5px solid rgba(200,169,110,0.3)', borderRadius: 10,
              padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', color: INK,
              background: '#fdfbf7',
            }}
          />

          {/* Campo trampa anti-bots: invisible para una persona, un bot que
              rellena todos los inputs sí lo verá y lo completará. */}
          <input
            type="text" name="website" value={website} onChange={e => setWebsite(e.target.value)}
            tabIndex={-1} autoComplete="off"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            aria-hidden="true"
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" onClick={rellenarEjemplo} style={{
              background: 'none', border: 'none', color: '#8a8278', fontSize: 13,
              cursor: 'pointer', textDecoration: 'underline', padding: 0,
            }}>
              ¿Sin un mensaje a mano? Usar un ejemplo
            </button>
            <button type="submit" disabled={cargando || mensaje.trim().length < 10} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: cargando ? '#d8c7a0' : GOLD, color: INK, fontWeight: 700, fontSize: 14,
              border: 'none', borderRadius: 10, padding: '11px 22px',
              cursor: cargando || mensaje.trim().length < 10 ? 'default' : 'pointer',
              opacity: mensaje.trim().length < 10 ? 0.5 : 1,
            }}>
              {cargando ? 'Cualificando…' : '✦ Cualificar con IA'}
            </button>
          </div>
        </form>

        {error && (
          <div style={{
            marginTop: 18, padding: '14px 18px', borderRadius: 12, textAlign: 'center',
            background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.2)', color: '#b45309', fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {resultado && (
          <div style={{
            marginTop: 18, background: '#fff', border: `2px solid ${GOLD}`, borderRadius: 16, padding: 24,
            boxShadow: '0 12px 40px rgba(200,169,110,0.18)',
          }} className="animate-reveal-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9a7a3a' }}>
                Así lo vería tu panel
              </span>
              <LeadBadge clasificacion={resultado.classification} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <ScoreBar score={resultado.score} />
            </div>
            {puntos.length > 0 && (
              <ul style={{ margin: '0 0 18px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8, color: '#5a544c' }}>
                {puntos.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            )}
            <div style={{ borderTop: '1px solid rgba(200,169,110,0.18)', paddingTop: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a8278', display: 'block', marginBottom: 8 }}>
                Email que enviaría por ti
              </span>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: INK, whiteSpace: 'pre-line', margin: 0 }}>
                {resultado.generated_email}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
