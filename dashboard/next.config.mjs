/** @type {import('next').NextConfig} */
const nextConfig = {
  // Habilita instrumentation.ts (monitorización Sentry en servidor) en Next 14
  experimental: {
    instrumentationHook: true,
  },
  // "Inicio" en el menú enlaza a "/" (la home real) — /inicio no es una ruta
  // propia, pero por si alguien la escribe o la guarda como marcador.
  async redirects() {
    return [
      { source: '/inicio', destination: '/', permanent: true },
    ];
  },
  /**
   * Proxy de desarrollo: redirige /api/* a FastAPI en localhost:8000.
   * En producción (NEXT_PUBLIC_API_URL definida) no se usa este proxy —
   * lib/api.ts llama directamente a la URL del backend de Railway.
   */
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_URL) {
      // Producción: sin proxy, las llamadas van directo al backend
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/:path*',
      },
    ];
  },
};

export default nextConfig;
