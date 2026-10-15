'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import {
  DEFAULT_FILTERS,
  PIN_TYPES,
  PUBLIC_ALERT_COLUMNS,
  SEVERITIES,
  filterAlerts,
  isAlertActive,
  searchAlerts,
  type AlertType,
  type PublicAlert,
} from '@/lib/domain/alerts';
import { formatDistance, resolveStartLocation, type LatLng } from '@/lib/domain/geo';
import { timeAgo } from '@/lib/domain/time';
import { useLang, useT } from '@/lib/i18n';
import { createBrowserClient } from '@/lib/supabase/client';
import { useTownshipEvents } from '@/lib/supabase/useRealtime';
import { AlertSheet } from './AlertSheet';
import { DropAlertSheet } from './DropAlertSheet';
import { FilterSheet, useMapFilters } from './FilterSheet';
import type { MapPin } from './LiveMap';

// Leaflet needs `window`, so the map itself only ever renders in the browser.
const LiveMap = dynamic(() => import('./LiveMap').then((m) => m.LiveMap), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-chip motion-reduce:animate-none" />,
});

const chip = (on: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-bold shadow-md ${
    on ? 'bg-ink text-on-ink' : 'bg-surface text-text'
  }`;

/**
 * The Live Map (canvas "Live Map v2"): the township's live alerts on a street map, a search and filters on top, and
 * sheets to read, vote on and drop alerts. Pins arrive with the page, then refresh whenever the township's channel
 * announces a change. The screen fills the space above the bottom bar.
 */
export function MapScreen({
  townshipId,
  township,
  centre,
  canPost,
  initialAlerts,
}: {
  townshipId: string;
  township: string;
  centre: LatLng;
  /** Verified residents post and vote; pending ones browse. */
  canPost: boolean;
  initialAlerts: PublicAlert[];
}) {
  const t = useT();
  const lang = useLang();
  const [alerts, setAlerts] = useState(initialAlerts);
  const [now, setNow] = useState(() => new Date());
  const [fix, setFix] = useState<LatLng | null>(null);
  const [view, setView] = useState(centre);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<LatLng | null>(null);
  const [toast, setToast] = useState<{ text: string; focusMap?: boolean } | null>(null);
  const [filters, setFilters] = useMapFilters();
  const mapRegion = useRef<HTMLDivElement>(null);

  // The + menu's "Drop a map alert" lands on /map?drop=1. The parameter is consumed at once, so a reload does not reopen
  // the sheet and the next tap on that menu item (from this page too) opens it again.
  const wantsDrop = useSearchParams().get('drop') === '1';
  const [dropOpen, setDropOpen] = useState(wantsDrop);
  const [seenDrop, setSeenDrop] = useState(wantsDrop);
  if (wantsDrop !== seenDrop) {
    setSeenDrop(wantsDrop);
    if (wantsDrop) setDropOpen(true);
  }
  const router = useRouter();
  useEffect(() => {
    if (!wantsDrop) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('drop'); // only this one: other parameters (Safe Walk's later) stay
    // Through the router, not history.replaceState: during the first render the router would keep its old drop=1.
    router.replace(url.pathname + url.search, { scroll: false });
  }, [wantsDrop, router]);

  // Pins fade out when they expire, and their "confirmed 5 min ago" names stay true.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      ({ coords }) => setFix({ lat: coords.latitude, lng: coords.longitude }),
      (error) => {
        // Denied: the map stays on the township and the drop sheet asks for the pin. A timeout keeps the last fix.
        if (error.code === error.PERMISSION_DENIED) setFix(null);
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4_000);
    return () => clearTimeout(id);
  }, [toast]);

  // When an alert's sheet closes because the alert is gone, the pin that opened it is gone too and focus would fall to
  // <body>. This runs after the sheet has closed (effects run child first), so the page is no longer inert.
  useEffect(() => {
    if (toast?.focusMap) mapRegion.current?.focus();
  }, [toast]);

  const latest = useRef(0);
  async function load() {
    const ticket = ++latest.current;
    const { data, error } = await createBrowserClient()
      .from('public_alerts')
      .select(PUBLIC_ALERT_COLUMNS)
      .overrideTypes<PublicAlert[], { merge: false }>();
    if (error) {
      console.error(`alerts were not refreshed: ${error.message}`);
      return; // the pins already shown stay
    }
    if (ticket === latest.current) setAlerts(data); // an older, slower answer never replaces a newer one
  }
  useTownshipEvents(townshipId, ['alerts', 'alert_votes'], load);

  // A fix far from the township (a visitor in KL) is not "near you": no blue dot, no distances.
  const me = fix && resolveStartLocation(fix, centre) === fix ? fix : null;
  const typeLabel = (type: AlertType) => t(`alert.type.${type}`);
  const active = alerts.filter((a) => isAlertActive(a, now));
  const shown = searchAlerts(filterAlerts(active, filters, me), query, typeLabel);
  // A pin that fades or is cleared while its sheet is open closes the sheet: say why, as a toast, and drop the stale id.
  const selected = active.find((a) => a.id === selectedId) ?? null;
  if (selectedId !== null && selected === null) {
    setSelectedId(null);
    setToast({ text: t('map.error.notActive'), focusMap: true });
  }

  const pinLabel = (a: PublicAlert) => {
    const what = { type: typeLabel(a.type), severity: t(`severity.${a.severity}`) };
    if (a.is_official) return t('map.pin.official', what);
    const confirmed = a.confirm_count > 0;
    const time = timeAgo(new Date(confirmed ? a.last_confirmed_at : a.created_at), now, lang);
    return t(confirmed ? 'map.pin.confirmed' : 'map.pin.reported', { ...what, time });
  };
  const pins: MapPin[] = shown.map((a) => ({
    id: a.id,
    lat: a.lat,
    lng: a.lng,
    type: a.type,
    severity: a.severity,
    official: a.is_official,
    label: pinLabel(a),
  }));

  const narrowed = shown.length < active.length;
  const closeDrop = () => setDropOpen(false);

  return (
    <main className="fixed inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] overflow-hidden">
      <h1 className="sr-only">{t('home.tile.map')}</h1>

      {/* Before the map in the page, as on screen: keyboard users reach the search and filters first. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto grid max-w-md gap-2 p-3">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault(); // results are live; Enter only puts the phone keyboard away
            (document.activeElement as HTMLElement | null)?.blur();
          }}
          className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-2xl bg-surface pl-4 shadow-md focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-red-text"
        >
          <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t('map.search')}
            placeholder={t('map.search.placeholder', { township })}
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent py-3 text-base text-text outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query && (
            <IconButton label={t('map.search.clear')} onClick={() => setQuery('')} className="border-transparent bg-transparent">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </IconButton>
          )}
        </form>

        {/* Safe Walk's chip joins these in Task 20. */}
        <div className="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
          <button type="button" aria-haspopup="dialog" onClick={() => setFiltersOpen(true)} className={chip(filters.maxDistanceM !== null)}>
            {filters.maxDistanceM === null
              ? t('map.filter.chip.distance')
              : t('map.filter.within', { distance: formatDistance(filters.maxDistanceM) })}
            <span aria-hidden="true">▾</span>
          </button>
          <button type="button" aria-haspopup="dialog" onClick={() => setFiltersOpen(true)} className={chip(filters.severities.length < SEVERITIES.length)}>
            {t('map.filter.severity')}
            {filters.severities.length < SEVERITIES.length && ` · ${filters.severities.length}`}
            <span aria-hidden="true">▾</span>
          </button>
          <button type="button" aria-haspopup="dialog" onClick={() => setFiltersOpen(true)} className={chip(filters.types.length < PIN_TYPES.length)}>
            {t('map.filter.type')}
            {filters.types.length < PIN_TYPES.length && ` · ${filters.types.length}`}
            <span aria-hidden="true">▾</span>
          </button>
        </div>

        {/* Always in the page, so screen readers hear the count change as the search or filters narrow the map. */}
        <div role="status" className="grid">
          {(narrowed || active.length === 0) && (
            <p className="pointer-events-auto flex min-h-11 items-center gap-1 justify-self-start rounded-full bg-surface pl-4 pr-1 text-sm font-bold shadow-md">
              {active.length === 0 ? t('map.quiet') : t('map.shown', { shown: shown.length, total: active.length })}
              {narrowed && (
                <button
                  type="button"
                  onClick={() => {
                    setFilters(DEFAULT_FILTERS);
                    setQuery('');
                  }}
                  className="min-h-11 rounded-full px-3 text-red-text underline-offset-2 hover:underline"
                >
                  {t('map.clear')}
                </button>
              )}
            </p>
          )}
        </div>
        {!canPost && (
          <p className="pointer-events-auto rounded-xl bg-tint-amber px-3 py-2 text-sm font-bold text-amber-text shadow-md">{t('map.readOnly')}</p>
        )}
      </div>

      <LiveMap
        pins={pins}
        selectedId={selected?.id ?? null}
        onSelect={setSelectedId}
        centre={centre}
        me={me}
        focus={focus}
        onViewChange={setView}
        township={township}
        regionRef={mapRegion}
      />

      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setDropOpen(true)}
        className="absolute bottom-7 left-3 inline-flex min-h-12 items-center gap-2 rounded-full bg-red px-5 text-base font-extrabold text-white shadow-lg transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <span aria-hidden="true">⚠️</span>
        {t('map.drop.open')}
      </button>

      {/* Clear of the zoom buttons on the right. */}
      <div role="status" className="pointer-events-none absolute bottom-24 left-3 right-16 flex justify-center">
        {toast && <p className="rounded-2xl bg-ink px-4 py-2 text-center text-sm font-bold text-on-ink shadow-lg">{toast.text}</p>}
      </div>

      <AlertSheet
        alert={selected}
        onClose={() => setSelectedId(null)}
        me={me}
        now={now}
        canVote={canPost}
        onVoted={load}
      />
      <DropAlertSheet
        open={dropOpen}
        onClose={closeDrop}
        start={me ?? view}
        gps={me !== null}
        centre={centre}
        canPost={canPost}
        onPosted={async (at) => {
          closeDrop();
          await load();
          setFocus(at);
          setToast({ text: t('map.posted') }); // after the sheet has closed, so the live region is not inert
        }}
      />
      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
        count={shown.length}
        hasLocation={me !== null}
      />
    </main>
  );
}
