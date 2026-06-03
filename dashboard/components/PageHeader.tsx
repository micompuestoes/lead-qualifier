'use client';

// Cabecera premium reutilizable para todas las páginas del dashboard.
// Incluye eyebrow opcional, h1, descripción, acción derecha y separador dorado.

import { useTheme } from './ThemeProvider';

interface Props {
  eyebrow?:     string;           // texto pequeño encima del título (opcional)
  title:        string;
  description?: React.ReactNode;  // string o JSX
  action?:      React.ReactNode;  // botón / link en el lado derecho
}

export default function PageHeader({ eyebrow, title, description, action }: Props) {
  const { c } = useTheme();

  return (
    <header style={{ marginBottom: 40 }}>

      {/* Título + acción */}
      <div className="page-header-row" style={{
        display:        'flex',
        alignItems:     description ? 'flex-end' : 'center',
        justifyContent: 'space-between',
        gap:            16,
        marginBottom:   18,
      }}>
        <div>
          {/* Eyebrow */}
          {eyebrow && (
            <p style={{
              fontFamily:    "'DM Sans', system-ui, sans-serif",
              fontSize:      11,
              fontWeight:    700,
              letterSpacing: '0.13em',
              textTransform: 'uppercase',
              color:         '#c8a96e',
              marginBottom:  8,
            }}>
              {eyebrow}
            </p>
          )}

          {/* H1 */}
          <h1 style={{ color: c.text1, margin: 0 }}>{title}</h1>

          {/* Descripción */}
          {description && (
            <div style={{ marginTop: 6 }}>
              {typeof description === 'string'
                ? <p style={{ fontSize: 14, color: c.text2, lineHeight: 1.55 }}>{description}</p>
                : description}
            </div>
          )}
        </div>

        {/* Acción derecha */}
        {action && (
          <div style={{ flexShrink: 0, paddingBottom: description ? 2 : 0 }}>
            {action}
          </div>
        )}
      </div>

      {/* Separador dorado degradado */}
      <div style={{
        height:     1,
        background: 'linear-gradient(90deg, rgba(200,169,110,0.65) 0%, rgba(200,169,110,0.13) 38%, transparent 66%)',
      }} />
    </header>
  );
}
