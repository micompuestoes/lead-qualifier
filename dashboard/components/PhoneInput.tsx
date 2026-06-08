'use client';

// Campo de teléfono con selector de país (bandera + prefijo). Por defecto España (+34).
// El número solo admite dígitos. Emite el valor completo "+34 612345678".

import { useState } from 'react';
import { useTheme } from './ThemeProvider';

interface Pais { code: string; flag: string; name: string; dial: string }

const PAISES: Pais[] = [
  { code: 'ES', flag: '🇪🇸', name: 'España',          dial: '+34'  },
  { code: 'PT', flag: '🇵🇹', name: 'Portugal',        dial: '+351' },
  { code: 'FR', flag: '🇫🇷', name: 'Francia',         dial: '+33'  },
  { code: 'IT', flag: '🇮🇹', name: 'Italia',          dial: '+39'  },
  { code: 'DE', flag: '🇩🇪', name: 'Alemania',        dial: '+49'  },
  { code: 'GB', flag: '🇬🇧', name: 'Reino Unido',     dial: '+44'  },
  { code: 'IE', flag: '🇮🇪', name: 'Irlanda',         dial: '+353' },
  { code: 'NL', flag: '🇳🇱', name: 'Países Bajos',    dial: '+31'  },
  { code: 'BE', flag: '🇧🇪', name: 'Bélgica',         dial: '+32'  },
  { code: 'CH', flag: '🇨🇭', name: 'Suiza',           dial: '+41'  },
  { code: 'MA', flag: '🇲🇦', name: 'Marruecos',       dial: '+212' },
  { code: 'RO', flag: '🇷🇴', name: 'Rumanía',         dial: '+40'  },
  { code: 'US', flag: '🇺🇸', name: 'EE. UU.',         dial: '+1'   },
  { code: 'AR', flag: '🇦🇷', name: 'Argentina',       dial: '+54'  },
  { code: 'CO', flag: '🇨🇴', name: 'Colombia',        dial: '+57'  },
  { code: 'MX', flag: '🇲🇽', name: 'México',          dial: '+52'  },
  { code: 'VE', flag: '🇻🇪', name: 'Venezuela',       dial: '+58'  },
  { code: 'EC', flag: '🇪🇨', name: 'Ecuador',         dial: '+593' },
];

export default function PhoneInput({ onChange, placeholder = '612 345 678' }: {
  onChange: (valor: string) => void;
  placeholder?: string;
}) {
  const { c } = useTheme();
  const [pais, setPais]     = useState<Pais>(PAISES[0]);
  const [numero, setNumero] = useState('');
  const [open, setOpen]     = useState(false);
  const [focused, setFocused] = useState(false);

  function emitir(p: Pais, n: string) {
    onChange(n ? `${p.dial} ${n}` : '');
  }

  function cambiarNumero(e: React.ChangeEvent<HTMLInputElement>) {
    const soloDigitos = e.target.value.replace(/[^\d]/g, '').slice(0, 15);
    setNumero(soloDigitos);
    emitir(pais, soloDigitos);
  }

  function elegirPais(p: Pais) {
    setPais(p);
    setOpen(false);
    emitir(p, numero);
  }

  const borde = focused ? `1.5px solid ${c.inputFocus}` : `1.5px solid ${c.inputBorder}`;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'stretch', borderRadius: 11,
        background: c.input, border: borde,
        boxShadow: focused ? '0 0 0 3px rgba(200,169,110,0.1)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s', overflow: 'hidden',
      }}>
        {/* Selector de país */}
        <button type="button" onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 11px', background: 'transparent', border: 'none',
            borderRight: `1px solid ${c.inputBorder}`, cursor: 'pointer',
            color: c.text1, fontSize: 14, flexShrink: 0,
          }}>
          <span style={{ fontSize: 17, lineHeight: 1 }}>{pais.flag}</span>
          <span style={{ fontWeight: 500 }}>{pais.dial}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={c.text2} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Número (solo dígitos) */}
        <input
          type="tel" inputMode="numeric" autoComplete="tel"
          value={numero} onChange={cambiarNumero}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{
            flex: 1, minWidth: 0, padding: '11px 13px', fontSize: 14,
            background: 'transparent', border: 'none', outline: 'none', color: c.text1,
          }}
        />
      </div>

      {/* Desplegable de países */}
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div className="animate-fade-up" style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 41,
            width: 250, maxHeight: 260, overflowY: 'auto',
            background: c.card, border: c.cardBorder, borderRadius: 12,
            boxShadow: '0 16px 50px rgba(26,24,20,0.22)',
          }}>
            {PAISES.map(p => {
              const sel = p.code === pais.code;
              return (
                <button key={p.code} type="button" onClick={() => elegirPais(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '9px 13px', background: sel ? 'rgba(200,169,110,0.1)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,110,0.06)'; }}
                  onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 17 }}>{p.flag}</span>
                  <span style={{ flex: 1, fontSize: 13.5, color: c.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: 13, color: c.text2 }}>{p.dial}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
