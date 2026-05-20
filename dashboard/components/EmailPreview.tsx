'use client';

// Bloque de previsualización del email generado por el agente,
// con botón para copiar el texto al portapapeles

import { useState } from 'react';

interface Props {
  email: string | null;
}

export default function EmailPreview({ email }: Props) {
  const [copiado, setCopiado] = useState(false);

  if (!email) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-400 italic">
        Email no disponible
      </div>
    );
  }

  async function copiarEmail() {
    await navigator.clipboard.writeText(email!);
    setCopiado(true);
    // Restablecer el estado del botón tras 2 segundos
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-base">✉️</span>
          <span className="text-sm font-semibold text-gray-700">Email generado por el agente</span>
        </div>
        <button
          onClick={copiarEmail}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            copiado
              ? 'bg-green-100 text-green-700'
              : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
          }`}
        >
          {copiado ? (
            <>
              <span>✓</span> Copiado
            </>
          ) : (
            <>
              <span>📋</span> Copiar
            </>
          )}
        </button>
      </div>

      {/* Cuerpo del email */}
      <div className="p-5 bg-white">
        <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
          {email}
        </pre>
      </div>
    </div>
  );
}
