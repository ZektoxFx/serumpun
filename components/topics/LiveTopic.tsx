'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { markTopicRead } from '@/app/(app)/community/general/actions';
import { useRealtimeTable } from '@/lib/supabase/useRealtime';

/**
 * The live side of a topic, as LiveThread is for a conversation: a new message renders the page again, each new last
 * message scrolls into view, and anything unread is marked read once the page shows. Renders nothing.
 */
export function LiveTopic({ topicId, last, unread }: { topicId: string; last: string | null; unread: number }) {
  const router = useRouter();
  useRealtimeTable('topic_messages', `topic_id=eq.${topicId}`, () => router.refresh());
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [last]);
  useEffect(() => {
    if (unread > 0) markTopicRead(topicId).catch(() => {}); // a missed mark leaves the count, nothing worse
  }, [topicId, unread]);
  return null;
}

/** The topic list's live side: any new message the reader may see (row-level security picks them) renders it again. */
export function LiveTopics() {
  const router = useRouter();
  useRealtimeTable('topic_messages', null, () => router.refresh());
  return null;
}
