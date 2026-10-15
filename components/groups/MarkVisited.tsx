'use client';

import { useEffect } from 'react';
import { markVisited } from '@/app/(app)/community/groups/actions';

/** Marks the group seen once its page is on screen (a prefetch renders the page without showing it). Renders nothing. */
export function MarkVisited({ groupId }: { groupId: string }) {
  useEffect(() => {
    markVisited(groupId).catch(() => {}); // the "N new" badge is a nicety: a failed mark leaves it as it was
  }, [groupId]);
  return null;
}
