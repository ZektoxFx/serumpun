import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/** Service-role client: it bypasses RLS. Server only. Never pass it, or rows it read unfiltered, to a Client Component. */
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
