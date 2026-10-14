'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useEffectEvent } from 'react';
import { createBrowserClient } from './client';

// One vote announces two changes (the vote row, then the alert's recount): one refetch covers the burst.
const DEBOUNCE_MS = 500;

/**
 * Calls `onEvent` when the database announces a change to one of `tables` in this township (ruling R4: id-only
 * broadcasts on the channel `township:<id>`), and each time the channel (re)subscribes, so whatever changed while the
 * phone slept or the network dropped is caught up. Calls are debounced: the first event of a burst starts a 500 ms timer
 * and later events join it, so a steady stream of events cannot postpone the refetch for ever.
 *
 * The channel is public and anyone with the anon key can send to it, so an event only ever means "something changed":
 * its payload is never read. `onEvent` refetches through the privacy views, which decide what the user may see.
 *
 * supabase-js keeps one channel per topic, and `channel(topic)` hands back the existing one even while it is still
 * leaving, which then never subscribes. So a screen that mounts straight after leaving (back to /map within the leave
 * round trip) first removes the stale channel, then subscribes a fresh one. For the same reason call this once per page
 * with every table the page needs: a second subscriber for the same township would share the first one's channel, get
 * no catch-up, and remove the channel for both when it unmounts.
 */
export function useTownshipEvents(townshipId: string, tables: string[], onEvent: () => void) {
  const changed = useEffectEvent(onEvent);
  const events = tables.join(',');

  useEffect(() => {
    const supabase = createBrowserClient();
    const topic = `township:${townshipId}`;
    let channel: RealtimeChannel | undefined;
    let cancelled = false; // unmounted while a stale channel was still being removed: subscribe nothing
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      if (timer === undefined) {
        timer = setTimeout(() => {
          timer = undefined;
          changed();
        }, DEBOUNCE_MS);
      }
    };
    const join = () => {
      if (cancelled) return;
      const fresh = supabase.channel(topic);
      for (const event of events.split(',')) fresh.on('broadcast', { event }, soon);
      fresh.subscribe((status) => {
        if (status === 'SUBSCRIBED') soon();
      });
      channel = fresh;
    };
    // With nothing stale (the usual case, and React StrictMode's remount) nothing is awaited.
    const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
    if (stale) void supabase.removeChannel(stale).then(join);
    else join();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [townshipId, events]);
}
