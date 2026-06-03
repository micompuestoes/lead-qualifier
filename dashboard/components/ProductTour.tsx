'use client';

// Tour guiado de primera visita. Resalta partes del dashboard con un foco + tooltip.
// Se muestra una sola vez (se recuerda en localStorage).

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTheme } from './ThemeProvider';

const KEY = 'inmobia-tour-v1';

interface Step {
  selector?: string;   // si falta, es un paso centrado (sin foco)
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: 'Te damos la bienvenida a Inmobia',
    body: 'En unos segundos te enseñamos lo esencial para empezar a captar clientes. Puedes saltarlo cuando quieras.',
  },
  {
    selector: '[data-tour="nav"]',
    title: 'Tu menú',
    body: 'Desde aquí navegas: Inicio, tus Leads, las herramientas y tu perfil. La guía completa está en "Ayuda".',
  },
  {
    selector: '[data-tour="nuevo-lead"]',
    title: 'Cualifica un lead',
    body: 'Pega el mensaje de un contacto y la IA lo puntúa y le redacta una respuesta al instante.',
  },
  {
    selector: '[data-tour="onboarding"]',
    title: 'Empieza por aquí',
    body: 'Completa estos pasos para configurar tu cuenta y recibir tus primeros leads.',
  },
  {
    selector: '[data-tour="kpis"]',
    title: 'Tus métricas',
    body: 'De un vistazo: leads totales, los de este mes y tu puntuación media.',
  },
  {
    title: '¡Listo para empezar!',
    body: 'Si te pierdes en cualquier momento, tienes toda la guía en la sección "Ayuda". ¡A por tu primer lead!',
  },
];

export default function ProductTour() {
  const { c } = useTheme();
  const [activo, setActivo] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Arranca solo en la primera visita
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) {
        const t = setTimeout(() => setActivo(true), 1000);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, []);

  const cerrar = useCallback(() => {
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    setActivo(false);
  }, []);

  // Mide el elemento objetivo del paso actual (o salta si no existe)
  useEffect(() => {
    if (!activo) return;
    const step = STEPS[i];
    if (!step.selector) { setRect(null); return; }
    const el = document.querySelector(step.selector);
    if (!el) {
      // El elemento no está en esta vista → saltar el paso
      if (i < STEPS.length - 1) setI(p => p + 1); else cerrar();
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const medir = () => setRect(el.getBoundingClientRect());
    medir();
    const t = setTimeout(medir, 350); // tras el scroll
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [activo, i, cerrar]);

  if (!activo) return null;

  const step = STEPS[i];
  const esUltimo = i === STEPS.length - 1;
  const TOOLTIP_W = 320;

  function siguiente() { if (!esUltimo) setI(p => p + 1); else cerrar(); }
  function anterior() { if (i > 0) setI(p => p - 1); }

  // Posición del tooltip
  let tipStyle: React.CSSProperties;
  if (rect) {
    const debajo = rect.bottom < window.innerHeight * 0.62;
    const left = Math.min(Math.max(rect.left, 16), window.innerWidth - TOOLTIP_W - 16);
    tipStyle = debajo
      ? { top: rect.bottom + 14, left }
      : { bottom: window.innerHeight - rect.top + 14, left };
  } else {
    // Centrado
    tipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return (
    <>
      {/* Capa que bloquea la interacción con la app durante el tour */}
      <div
        onClick={cerrar}
        style={{ position: 'fixed', inset: 0, zIndex: 9997, background: rect ? 'transparent' : 'rgba(20,17,13,0.55)' }}
      />

      {/* Foco sobre el elemento */}
      {rect && (
        <div style={{
          position: 'fixed',
          top: rect.top - 6, left: rect.left - 6,
          width: rect.width + 12, height: rect.height + 12,
          borderRadius: 12, zIndex: 9998, pointerEvents: 'none',
          boxShadow: '0 0 0 9999px rgba(20,17,13,0.55)',
          border: '2px solid #c8a96e',
          transition: 'all 0.25s ease',
        }} />
      )}

      {/* Tooltip / tarjeta */}
      <div style={{
        position: 'fixed', zIndex: 9999, width: TOOLTIP_W, maxWidth: 'calc(100vw - 32px)',
        background: c.card, border: `1px solid ${c.inputBorder}`, borderRadius: 14,
        padding: 18, boxShadow: '0 16px 50px rgba(26,24,20,0.28)',
        ...tipStyle,
      }} className="animate-fade-up">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#c8a96e' }}>
            {i + 1} / {STEPS.length}
          </span>
          <button onClick={cerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.text3, fontSize: 12, padding: 0 }}>
            Saltar
          </button>
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: c.text1, marginBottom: 6 }}>{step.title}</p>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: c.text2, marginBottom: 16 }}>{step.body}</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          {esUltimo ? (
            <Link href="/ayuda" onClick={cerrar} style={{ fontSize: 12.5, fontWeight: 600, color: '#9a7a3a', textDecoration: 'none' }}>
              Ver la guía
            </Link>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            {i > 0 && (
              <button onClick={anterior} style={{
                padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                background: 'transparent', color: c.text2, border: `1.5px solid ${c.inputBorder}`, cursor: 'pointer',
              }}>
                Anterior
              </button>
            )}
            <button onClick={siguiente} style={{
              padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: '#c8a96e', color: '#1a1814', border: 'none', cursor: 'pointer',
            }}>
              {esUltimo ? 'Entendido' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
