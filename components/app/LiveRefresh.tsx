'use client';

import { useRouter } from 'next/navigation';
import { useTownshipEvents } from '@/lib/supabase/useRealtime';

/**
 * Renders the page's server parts again when the township announces a change to one of `tables` (ruling R4). The
 * announcement only says that something changed; the page reads the privacy views again. Mount it once per page.
 */
export function LiveRefresh({ townshipId, tables }: { townshipId: string; tables: string[] }) {
  const router = useRouter();
  useTownshipEvents(townshipId, tables, () => router.refresh());
  return null;
}
