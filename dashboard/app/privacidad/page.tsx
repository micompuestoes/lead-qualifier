'use client';

import LegalDoc, { type LegalSection } from '@/components/LegalDoc';

const SECCIONES: LegalSection[] = [
  {
    heading: 'Responsable del tratamiento',
    body: [
      'Inmobia es responsable del tratamiento de los datos personales que se gestionan a través de la plataforma. Para cualquier consulta sobre privacidad puedes escribir a contacto@inmobia.es.',
    ],
  },
  {
    heading: 'Qué datos tratamos',
    body: [
      'Tratamos dos tipos de datos:',
      [
        'Datos de tu cuenta: nombre de la empresa, email de acceso y de notificaciones, y datos de facturación gestionados por Stripe.',
        'Datos de tus leads: nombre, email, teléfono y mensaje de las personas que contactan con tu agencia, que tú o tus integraciones introducís en la plataforma.',
      ],
    ],
  },
  {
    heading: 'Finalidad y base legal',
    body: [
      'Usamos los datos para prestar el servicio: cualificar leads con IA, generar respuestas, enviar notificaciones y gestionar tu suscripción.',
      'La base legal es la ejecución del contrato (la prestación del servicio que has contratado) y, respecto a los datos de tus leads, actuamos como encargado del tratamiento por cuenta de tu agencia, que es la responsable.',
    ],
  },
  {
    heading: 'Proveedores y subencargados',
    body: [
      'Para prestar el servicio nos apoyamos en proveedores que cumplen con la normativa de protección de datos:',
      [
        'Anthropic (Claude) para el procesamiento de IA de los mensajes.',
        'Stripe para el procesamiento de pagos.',
        'Clerk para la autenticación de cuentas.',
        'Proveedores de infraestructura cloud para el alojamiento.',
      ],
      'Compartimos únicamente los datos necesarios para cada finalidad.',
    ],
  },
  {
    heading: 'Conexión con tu email (IMAP)',
    body: [
      'Si conectas tu bandeja de entrada (disponible en los planes Pro y Agencia), accedemos a los correos no leídos para convertirlos en leads. Las credenciales se almacenan cifradas y solo se usan para esa sincronización.',
      'Puedes desconectar tu bandeja en cualquier momento desde tu perfil; al hacerlo dejamos de acceder a ella.',
    ],
  },
  {
    heading: 'Conservación',
    body: [
      'Conservamos los datos mientras tu cuenta esté activa. Tras la baja, eliminamos o anonimizamos los datos en un plazo razonable, salvo obligación legal de conservarlos (por ejemplo, facturación).',
    ],
  },
  {
    heading: 'Tus derechos',
    body: [
      'Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a contacto@inmobia.es.',
      'También tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD).',
    ],
  },
  {
    heading: 'Seguridad',
    body: [
      'Aplicamos medidas técnicas y organizativas para proteger tus datos, incluido el cifrado de credenciales sensibles y el aislamiento de los datos de cada cuenta.',
    ],
  },
];

export default function PrivacidadPage() {
  return (
    <LegalDoc
      title="Política de Privacidad"
      updated="1 de junio de 2026"
      intro="Tu confianza es lo primero. Aquí explicamos qué datos tratamos, con qué fin y cómo los protegemos."
      sections={SECCIONES}
    />
  );
}
