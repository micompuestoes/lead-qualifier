import type { MetadataRoute } from 'next';

// Solo las páginas públicas de verdad — el resto exige sesión (Clerk las
// redirige a /sign-in) y no tiene sentido indexarlas ni ofrecérselas a Google.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.inmuebia.es';
  const hoy = new Date();

  return [
    { url: base, lastModified: hoy, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/terminos`, lastModified: hoy, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacidad`, lastModified: hoy, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
