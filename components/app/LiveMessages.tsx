'use client';

import { useRouter } from 'next/navigation';
import { useRealtimeTable } from '@/lib/supabase/useRealtime';

/** Keeps the inbox and its badge live: a new message in any of the user's conversations renders the page again. */
export function LiveMessages() {
  const router = useRouter();
  // Row-level security sends this user the messages of their own conversations only.
  useRealtimeTable('messages', null, () => router.refresh());
  return null;
}
