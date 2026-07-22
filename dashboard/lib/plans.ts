// Fuente ÚNICA de los planes — usada por la landing y por la página de precios,
// para que no vuelvan a desincronizarse.
// Agencia se factura por asiento: 39€/agente con MÍNIMO 2 agentes.
// - 20% más barato por agente que Pro → argumento comercial para juntar al equipo.
// - El mínimo de 2 (78€) garantiza que Agencia nunca cueste menos que Pro (49€),
//   así el agente que va solo no tiene incentivo perverso para colarse en Agencia.
// - Agencia típica de 2-3 agentes: 78-117€/mes, asumible en el mercado español.
// Si cambias el importe aquí, cambia también el precio en Stripe (STRIPE_PRICE_AGENCIA)
// y el mínimo de asientos en el backend (MIN_AGENCY_SEATS en config.py).

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
    precio: 39,
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
    limitacion: 'Mínimo 2 agentes. El importe se ajusta solo al añadir o quitar miembros',
  },
];
