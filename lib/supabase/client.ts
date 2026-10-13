import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';

/** Supabase client for Client Components (realtime, uploads). In the browser the library hands back one shared instance. */
export function createBrowserClient() {
  return createSupabaseBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
