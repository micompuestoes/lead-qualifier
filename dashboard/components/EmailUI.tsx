'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { useTheme } from '@/components/ThemeProvider';

interface Props {
  email:      string;
  leadEmail:  string;
  asunto:     string;
}

export default function EmailUI({ email, leadEmail, asunto }: Props) {
  const { addToast } = useToast();
  const { c } = useTheme();
  const [copiado, setCopiado] = useState(false);

  async function copiarCompleto() {
    await navigator.clipboard.writeText(`Para: ${leadEmail}\nAsunto: ${asunto}\n\n${email}`);
    setCopiado(true);
    addToast('Email copiado al portapapeles', 'success');
    setTimeout(() => setCopiado(false), 2000);
  }

  function abrirGmail() {
    window.open(
      `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(leadEmail)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(email)}`,
      '_blank',
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: c.cardBorder }}>

      {/* Cabecera */}
      <div className="px-5 py-4" style={{ background: c.muted, borderBottom: `1px solid ${c.divider}` }}>
        <div className="flex items-center justify-between mb-3">

          {/* Título */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke={c.text2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: c.text1 }}>
              Email generado por el agente
            </span>
          </div>

          {/* Acciones */}
          <div className="flex gap-2">
            <button
              onClick={copiarCompleto}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: copiado ? 'rgba(110,200,122,0.1)' : c.card,
                color:      copiado ? '#2d7a3a' : c.text2,
                border:     `1px solid ${c.inputBorder}`,
              }}
            >
              {copiado ? '✓ Copiado' : 'Copiar email'}
            </button>
            <button
              onClick={abrirGmail}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: c.card, color: c.text2, border: `1px solid ${c.inputBorder}` }}
            >
              Abrir en Gmail
            </button>
          </div>
        </div>

        {/* Destinatario y asunto */}
        <div className="space-y-1.5 text-sm">
          {[{ label: 'Para', value: leadEmail }, { label: 'Asunto', value: asunto }].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-right text-xs font-semibold uppercase tracking-wide"
                style={{ color: c.text2 }}>
                {label}
              </span>
              <span className="font-medium" style={{ color: c.text1 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cuerpo del email */}
      <div className="p-5" style={{ background: c.card }}>
        <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed" style={{ color: c.text1 }}>
          {email}
        </pre>
      </div>

    </div>
  );
}
