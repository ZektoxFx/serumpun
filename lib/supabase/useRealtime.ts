'use client';

import { useEffect, useEffectEvent } from 'react';
import { createBrowserClient } from './client';

// One vote announces two changes (the vote row, then the alert's recount): one refetch covers the burst.
const DEBOUNCE_MS = 500;

/** Runs `fn` once per burst: the first call starts a 500 ms timer and later calls join it, so a steady stream of calls
 *  cannot postpone it for ever. */
function debounced(fn: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    soon() {
      if (timer === undefined) {
        timer = setTimeout(() => {
          timer = undefined;
          fn();
        }, DEBOUNCE_MS);
      }
    },
    cancel: () => clearTimeout(timer),
  };
}

/**
 * Calls `onEvent` when the database announces a change to one of `tables` in this township (ruling R4: id-only
 * broadcasts on the channel `township:<id>`), and each time the channel (re)subscribes, so whatever changed while the
 * phone slept or the network dropped is caught up. Calls are debounced (see `debounced`).
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
    const refetch = debounced(() => changed());
    const channel = supabase.channel(`township:${townshipId}`);
    for (const event of events.split(',')) channel.on('broadcast', { event }, refetch.soon);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') refetch.soon();
    });
    return () => {
      refetch.cancel();
      void supabase.removeChannel(channel);
    };
  }, [townshipId, events]);
}

/**
 * Calls `onChange` when a row of `table` changes (postgres_changes, for per-user data such as notifications), and each
 * time the channel (re)subscribes; debounced like useTownshipEvents. Row-level security decides which rows reach this
 * user; `filter` (e.g. `user_id=eq.<id>`) only narrows that. The payload is never read: `onChange` refetches.
 *
 * supabase-js keeps one channel per topic (here the table plus the filter), so mount this once per page for each table
 * and filter: a second mount with the same pair usually throws (realtime-js refuses `.on()` on a joined channel), or
 * shares the first one's channel without catch-up and removes it for both when it unmounts.
 */
export function useRealtimeTable(table: string, filter: string | null, onChange: () => void) {
  const changed = useEffectEvent(onChange);

  useEffect(() => {
    const supabase = createBrowserClient();
    const refetch = debounced(() => changed());
    const channel = supabase
      .channel(`db:${table}:${filter ?? '*'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: filter ?? undefined }, refetch.soon);
    let mounted = true;
    // Row-level security judges each change by the token sent with the join. On a fresh page the session is still
    // loading from its cookie, and a join sent without it never gets it later (tested): wait for the token first.
    const join = () => {
      if (mounted) {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') refetch.soon();
        });
      }
    };
    supabase.realtime.setAuth().then(join, join);
    return () => {
      mounted = false;
      refetch.cancel();
      void supabase.removeChannel(channel);
    };
  }, [table, filter]);
}
