'use client';

import { useEffect, useEffectEvent } from 'react';
import { createBrowserClient } from './client';

// One vote announces two changes (the vote row, then the alert's recount): wait for the burst to end.
const DEBOUNCE_MS = 500;

/**
 * Calls `onEvent` when the database announces a change to one of `tables` in this township (ruling R4: id-only
 * broadcasts on the channel `township:<id>`), and each time the channel (re)subscribes, so whatever changed while the
 * phone slept or the network dropped is caught up. Calls are debounced.
 *
 * The channel is public and anyone with the anon key can send to it, so an event only ever means "something changed":
 * its payload is never read. `onEvent` refetches through the privacy views, which decide what the user may see.
 */
export function useTownshipEvents(townshipId: string, tables: string[], onEvent: () => void) {
  const changed = useEffectEvent(onEvent);
  const events = tables.join(',');

  useEffect(() => {
    const supabase = createBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => changed(), DEBOUNCE_MS);
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
