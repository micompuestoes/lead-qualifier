'use client';

import LegalDoc, { type LegalSection } from '@/components/LegalDoc';

const SECCIONES: LegalSection[] = [
  {
    heading: 'Objeto del servicio',
    body: [
      'Inmobia es una plataforma SaaS que utiliza inteligencia artificial para cualificar leads inmobiliarios, generar respuestas y ayudar a las agencias a priorizar sus contactos comerciales.',
      'Al crear una cuenta y utilizar el servicio, aceptas estos Términos de Servicio en su totalidad.',
    ],
  },
  {
    heading: 'Cuentas y acceso',
    body: [
      'Para usar la plataforma debes registrar una cuenta con datos veraces y mantener la confidencialidad de tus credenciales de acceso.',
      'Eres responsable de toda la actividad que ocurra bajo tu cuenta, incluida la de los miembros de equipo que invites en el plan Agencia.',
    ],
  },
  {
    heading: 'Planes, pagos y renovación',
    body: [
      'Ofrecemos un plan gratuito con límites de uso y planes de pago (Pro y Agencia) con facturación mensual recurrente.',
      'Los pagos se procesan de forma segura a través de Stripe. No almacenamos los datos completos de tu tarjeta.',
      'La suscripción se renueva automáticamente cada mes hasta que la canceles. Puedes cancelar en cualquier momento desde tu perfil; conservarás el acceso hasta el final del período ya pagado.',
      'Los precios mostrados no incluyen IVA, que se aplicará según la normativa vigente.',
    ],
  },
  {
    heading: 'Uso aceptable',
    body: [
      'Te comprometes a utilizar el servicio de forma lícita y a no:',
      [
        'Enviar datos de terceros sin la base legal adecuada para su tratamiento.',
        'Intentar acceder a cuentas o datos de otros usuarios.',
        'Usar la plataforma para enviar comunicaciones no solicitadas (spam) que infrinjan la normativa aplicable.',
        'Realizar ingeniería inversa o sobrecargar deliberadamente la infraestructura.',
      ],
    ],
  },
  {
    heading: 'Contenido generado por IA',
    body: [
      'Las puntuaciones, clasificaciones y textos generados por la IA son una ayuda orientativa. La decisión comercial final y la comunicación con tus clientes son siempre tu responsabilidad.',
      'Debes revisar los emails y textos generados antes de enviarlos o publicarlos.',
    ],
  },
  {
    heading: 'Disponibilidad y limitación de responsabilidad',
    body: [
      'Trabajamos para ofrecer un servicio estable, pero no garantizamos disponibilidad ininterrumpida. Podemos realizar tareas de mantenimiento que afecten temporalmente al acceso.',
      'En la medida permitida por la ley, no nos hacemos responsables de pérdidas indirectas derivadas del uso o la imposibilidad de uso del servicio.',
    ],
  },
  {
    heading: 'Cancelación y baja',
    body: [
      'Puedes cancelar tu suscripción o eliminar tu cuenta cuando lo desees. Tras la baja, tus datos se tratarán conforme a nuestra Política de Privacidad.',
    ],
  },
  {
    heading: 'Modificaciones',
    body: [
      'Podemos actualizar estos términos para reflejar cambios en el servicio o en la normativa. Te avisaremos de los cambios relevantes y la fecha de última actualización quedará reflejada en este documento.',
    ],
  },
];

export default function TerminosPage() {
  return (
    <LegalDoc
      title="Términos de Servicio"
      updated="1 de junio de 2026"
      intro="Estos términos regulan el uso de Inmobia. Te recomendamos leerlos con atención antes de utilizar la plataforma."
      sections={SECCIONES}
    />
  );
}
