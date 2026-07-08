// Fuente ÚNICA de los planes — usada por la landing y por la página de precios,
// para que no vuelvan a desincronizarse.
// Nota: Agencia se factura por asiento en Stripe; el importe mostrado es la base
// por agente (ajústalo cuando definas el precio por asiento definitivo).

export interface Plan {
  id: 'free' | 'pro' | 'agencia';
  nombre: string;
  precio: number;        // €/mes (si porAsiento, €/agente/mes)
  descripcion: string;
  destacado?: boolean;
  porAsiento?: boolean;  // Agencia se factura por agente (Stripe cobra quantity = nº de agentes)
  features: string[];
  limitacion?: string;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    nombre: 'Free',
    precio: 0,
    descripcion: 'Para probar la plataforma',
    features: [
      '10 leads / mes',
      'Cualificación con IA',
      'Formulario público',
      'Dashboard básico',
    ],
    limitacion: 'Límite de 10 leads al mes',
  },
  {
    id: 'pro',
    nombre: 'Pro',
    precio: 49,
    descripcion: 'Para el agente que va por libre',
    destacado: true,
    features: [
      'Leads ilimitados',
      'Cualificación con IA',
      'Conecta tu correo (bandeja → leads)',
      'Avisos por email',
      'Exportar a CSV',
      'Soporte por email',
    ],
  },
  {
    id: 'agencia',
    nombre: 'Agencia',
    precio: 99,
    descripcion: 'Para dirigir un equipo',
    porAsiento: true,
    features: [
      'Todo lo de Pro',
      'Reparto de leads entre agentes',
      'Rendimiento por agente',
      'Generador de anuncios con IA',
      'Estadísticas avanzadas',
      'Soporte prioritario',
    ],
  },
];
