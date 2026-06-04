// Middleware de Clerk — protege todo salvo las rutas públicas.
// A los visitantes sin sesión que entran en una ruta protegida los llevamos a
// NUESTRA página /sign-in (no a la página alojada de Clerk), conservando el destino.

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',            // landing pública de marketing
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/form/(.*)',   // formularios públicos de captación de leads
  '/terminos(.*)',
  '/privacidad(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;

  const { userId } = await auth();
  if (!userId) {
    const signIn = new URL('/sign-in', request.url);
    signIn.searchParams.set('redirect_url', request.url);
    return NextResponse.redirect(signIn);
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
