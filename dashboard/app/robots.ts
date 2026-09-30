import type { MetadataRoute } from 'next';

// El resto de rutas (dashboard, /form/*, /pricing...) exigen sesión — Clerk
// las redirige a /sign-in para cualquier visitante sin cuenta, Googlebot
// incluido, así que no hace falta bloquearlas aparte: no hay nada que indexar ahí.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/sign-in', '/sign-up'],
    },
    sitemap: 'https://www.inmuebia.es/sitemap.xml',
  };
}
