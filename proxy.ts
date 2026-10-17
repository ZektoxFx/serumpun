import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

// Signed-in only. Matched on whole path segments, so '/me' never swallows '/media'.
const SIGNED_IN_ONLY = [
  '/home', '/map', '/community', '/reports', '/book', '/rewards', '/me', '/messages', '/notifications', '/dashboard',
  '/checkin', '/notices',
];

export async function proxy(request: NextRequest) {
  // Everything the Supabase client asked us to write. A later write rebuilds `response`, so it is replayed each time
  // (the no-store headers only arrive with the first write), and the redirect below needs it too.
  const writes: { name: string; value: string; options: CookieOptions }[] = [];
  const cacheHeaders: Record<string, string> = {};
  const withAuthWrites = (res: NextResponse) => {
    writes.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    Object.entries(cacheHeaders).forEach(([key, value]) => res.headers.set(key, value));
    return res;
  };

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        writes.push(...cookiesToSet);
        Object.assign(cacheHeaders, headers);
        // On the request too, so the page rendered for this very request already sees the refreshed session.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = withAuthWrites(NextResponse.next({ request }));
      },
    },
  });

  // Verifies the JWT and refreshes the session cookie shortly before it expires. Keep code out from between
  // creating the client and this call. Pages still check the user themselves: this is a redirect, not the only gate.
  const { data } = await supabase.auth.getClaims();

  // Next decodes the path before routing, so '/%68ome' renders /home: compare the decoded form.
  let pathname = request.nextUrl.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // A malformed escape matches no route, so the raw path is fine.
  }
  const needsSignIn = SIGNED_IN_ONLY.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (data?.claims || !needsSignIn) return response;
  // Back here after signing in (a scanned check-in QR, a shared link): the landing page reads `next` (returnPath).
  const landing = new URL('/', request.url);
  landing.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return withAuthWrites(NextResponse.redirect(landing));
}

export const config = {
  // Skip static assets and /data (public JSON such as the walking graph): nothing there needs a session.
  matcher: ['/((?!_next/static|_next/image|data(?:/|$)|.*\\.(?:svg|png|jpe?g|gif|webp|ico|webmanifest)$).*)'],
};
