'use client';

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
 * supabase-js keeps one channel per topic, so call this once per page with every table the page needs: a second
 * subscriber for the same township would share the first one's channel, get no catch-up, and remove the channel for
 * both when it unmounts.
 */
export function useTownshipEvents(townshipId: string, tables: string[], onEvent: () => void) {
  const changed = useEffectEvent(onEvent);
  const events = tables.join(',');

  useEffect(() => {
    const supabase = createBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      if (timer === undefined) {
        timer = setTimeout(() => {
          timer = undefined;
          changed();
        }, DEBOUNCE_MS);
      }
    };
    const channel = supabase.channel(`township:${townshipId}`);
    for (const event of events.split(',')) channel.on('broadcast', { event }, soon);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') soon();
    });
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [townshipId, events]);
}
