/** First of `keys` that is set to a non-empty value. Throws `Missing env: A or B` so a bad deploy fails loudly. */
export function readEnv(source: Record<string, string | undefined>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (value) return value;
  }
  throw new Error(`Missing env: ${keys.join(' or ')}`);
}

/**
 * Secrets: only ever read on the server (or by tsx scripts). Not marked `import 'server-only'` because
 * scripts/*.ts, Vitest and proxy.ts import this file too, and that package throws outside Next's RSC layer.
 * A non-NEXT_PUBLIC_ variable is never inlined into a browser bundle, so this guard is belt and braces.
 */
function readServerEnv(keys: string[]): string {
  if (typeof window !== 'undefined') throw new Error(`${keys[0]} is server-only`);
  return readEnv(process.env, keys);
}

/**
 * Lazy getters: `next build` imports modules before the environment exists, so nothing throws until a value is read.
 * NEXT_PUBLIC_ values are read as literal `process.env.NEXT_PUBLIC_…` member expressions on purpose: that is the only
 * form Next inlines into the browser bundle, and it is why they are not read from `process.env` as a whole.
 */
export const env = {
  get supabaseUrl() {
    return readEnv({ NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL }, ['NEXT_PUBLIC_SUPABASE_URL']);
  },
  get supabaseAnonKey() {
    return readEnv(
      {
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      },
      ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
    );
  },
  get serviceRoleKey() {
    return readServerEnv(['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY']);
  },
  get databaseUrl() {
    return readServerEnv(['POSTGRES_URL_NON_POOLING']);
  },
  get demoPassword() {
    return readServerEnv(['DEMO_PASSWORD']);
  },
};
