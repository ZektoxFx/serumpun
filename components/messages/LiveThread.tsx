'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { markRead } from '@/app/(app)/messages/actions';
import { useRealtimeTable } from '@/lib/supabase/useRealtime';

/**
 * The live side of a conversation: a new message renders the page again, each new last message scrolls into view, and
 * anything unread is marked read once the page shows. Renders nothing.
 */
export function LiveThread({ conversationId, last, unread }: { conversationId: string; last: string | null; unread: number }) {
  const router = useRouter();
  useRealtimeTable('messages', `conversation_id=eq.${conversationId}`, () => router.refresh());
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [last]);
  useEffect(() => {
    if (unread > 0) markRead(conversationId).catch(() => {}); // a missed mark leaves the unread dot, nothing worse
  }, [conversationId, unread]);
  return null;
}
