'use client';

import { useRouter } from 'next/navigation';
import { useRealtimeTable } from '@/lib/supabase/useRealtime';

/** Keeps the bell's unread badge live: when this user's notifications change, the page's server parts render again. */
export function LiveBell({ userId }: { userId: string }) {
  const router = useRouter();
  useRealtimeTable('notifications', `user_id=eq.${userId}`, () => router.refresh());
  return null;
}
