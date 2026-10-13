import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch as runsOn } from 'next/experimental/testing/server';
import { config, proxy } from '@/proxy';

// The Supabase client is the only outside dependency: fake just the one call the proxy makes.
const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getClaims } }) }));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
});
afterEach(() => vi.unstubAllEnvs());

async function visit(path: string, signedIn: boolean) {
  getClaims.mockResolvedValue({ data: signedIn ? { claims: { sub: 'user-1' } } : null, error: null });
  return proxy(new NextRequest(`https://serumpun.test${path}`));
}
const redirectedTo = (res: Response) => (res.headers.get('location') ? new URL(res.headers.get('location')!).pathname : null);

it.each([
  '/home', '/map', '/community', '/community/groups/42', '/reports', '/book', '/rewards', '/me', '/messages', '/notifications',
  '/dashboard', '/dashboard/events',
])('sends a signed-out visitor from %s to the landing page', async (path) => {
  expect(redirectedTo(await visit(path, false))).toBe('/');
});

it('lets a signed-in resident through', async () => {
  expect(redirectedTo(await visit('/home', true))).toBeNull();
});

it('guards whole path segments only, so the landing page and look-alike paths stay public', async () => {
  for (const path of ['/', '/signup', '/media', '/homework', '/reportsfoo']) {
    expect(redirectedTo(await visit(path, false)), path).toBeNull();
  }
});

it('runs on app pages but not on static assets or /data', () => {
  for (const url of ['/', '/home', '/reports/new', '/dashboard']) expect(runsOn({ config, url }), url).toBe(true);
  for (const url of ['/data/elmina-walk.json', '/_next/static/chunks/app.js', '/_next/image', '/icon.svg', '/favicon.ico']) {
    expect(runsOn({ config, url }), url).toBe(false);
  }
});
