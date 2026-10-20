'use client';

import { useEffect, useEffectEvent, useId, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { DemoButtons } from '@/app/(auth)/forms';
import { ContactlessMark } from '@/components/card/CardFace';
import { HouseholdCard } from '@/components/card/HouseholdCard';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Glyph';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import { PLACES, readPresentation, type Place, type PublicJwk } from '@/lib/card/crypto';
import { reasonKey, type DenyReason, type OfflineVisit, type ReaderCache, type TapRequest } from '@/lib/card/decide';
import { afterFlush, decideOffline, enqueue, loadCache, loadQueue, saveCache, saveQueue } from '@/lib/card/queue';
import { BAD_PASS, JSON_BODY, askTownship, within, type Answer } from '@/lib/card/reader-client';
import type { CardSummary } from '@/lib/card/summary';
import { SPORT_ICON, type Sport } from '@/lib/domain/booking';
import { clockTime } from '@/lib/domain/time';
import { useLang, useT } from '@/lib/i18n';

const SYNC_MS = 30_000; // how often an online reader syncs
const RESULT_MS = 3_000; // how long a result stays up before the reader waits for the next card

// What this page keeps for the reader. lib/card/queue.ts saves it in localStorage too, but storage can be blocked, so
// these copies are what the reader decides on and sends from: the queue of taps decided offline, the last sync, and the
// notes it has seen. They last as long as the page.
let queued: OfflineVisit[] | undefined;
let synced: ReaderCache | null | undefined;
const seen = new Set<string>();
const syncListeners = new Set<() => void>();

const queue = () => (queued ??= loadQueue());
function keepQueue(next: OfflineVisit[]) {
  queued = next;
  saveQueue(next);
}
const lastSync = () => (synced === undefined ? (synced = loadCache()) : synced);
function keepSync(cache: ReaderCache) {
  synced = cache;
  saveCache(cache);
  syncListeners.forEach((listener) => listener());
}
function subscribeSync(listener: () => void) {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}
function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** A note the township decided is seen too, so the same note shown again offline (within its minute) is refused. */
async function remember(presentation: string, publicKey: PublicJwk) {
  const found = await readPresentation(presentation, lastSync()?.publicKey ?? publicKey);
  if (found) seen.add(found.note.nonce);
}

/** Offline: the reader decides on its last sync (before any, on the pass alone with the page's key) and queues the visit. */
async function decideHere(tap: TapRequest, publicKey: PublicJwk): Promise<Answer> {
  const known = lastSync() ?? { publicKey, offsetMs: 0, syncedAt: 0, stop: { cards: [], phones: [] }, bookings: [] };
  const decided = await decideOffline(tap, known, seen, Date.now());
  if (!decided) return BAD_PASS;
  keepQueue(enqueue(queue(), decided.visit));
  return decided.decision.granted ? { granted: true, unit: decided.unit } : decided.decision;
}

/** The reader waiting: the contactless mark in a ring that glows (and holds still under reduced motion). */
function Ring() {
  return (
    <span className="relative grid size-32 place-items-center">
      <span aria-hidden="true" className="absolute inset-0 animate-pulse rounded-full bg-brand-gradient blur-md motion-reduce:animate-none" />
      <span className="relative grid size-28 place-items-center rounded-full bg-sidebar ring-4 ring-white/80">
        <ContactlessMark className="h-14 w-12" />
      </span>
    </span>
  );
}

/** ✓ or ✕ in a ring, in the result's colour. The tick draws itself, the team's check icon as a path (at once under reduced motion). */
function Mark({ granted }: { granted: boolean }) {
  return (
    <span className={`grid size-32 place-items-center rounded-full border-4 border-current ${granted ? 'text-green-text' : 'text-red-text'}`}>
      {granted ? (
        <svg viewBox="0 0 24 24" className="size-16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12.5l5.5 5.5L21 5.5" pathLength={1} strokeDasharray={1} className="animate-draw motion-reduce:animate-none" />
        </svg>
      ) : (
        <Icon name="close" className="size-14 animate-card-pop motion-reduce:animate-none" />
      )}
    </span>
  );
}

/**
 * The township's card reader (spec sections 6 and 9), with a phone beside it holding this browser's card. Online, the
 * township decides each tap. With the Wi-Fi switch off or the network gone, the reader decides by itself from its last
 * sync, queues the visit, and sends the queue once it is back online. A result says ✓ or ✕ in words too, never a name.
 */
export function ReaderScreen({
  townshipId,
  facilities,
  publicKey,
  card,
  demoPin,
}: {
  townshipId: string;
  facilities: { id: string; sport: Sport; court_label: string }[];
  publicKey: PublicJwk;
  card: CardSummary | null;
  demoPin: string | null;
}) {
  const t = useT();
  const lang = useLang();
  const titleId = useId();
  const wifiId = useId();
  const [place, setPlace] = useState<Place>('pool');
  const choices = facilities.filter((f) => f.sport !== 'gym'); // the courts, the hall, the BBQ pit and the room
  const [chosen, setChosen] = useState(choices[0]?.id ?? null);
  const [wifi, setWifi] = useState(true);
  const [shown, setShown] = useState<(Answer & { place: Place; label: string }) | null>(null);
  const [opened] = useState(() => new Date());
  const taps = useRef(0);
  const refreshing = useRef(false);
  // Both exist only in this browser, so the server and hydration render them as not known yet.
  const cache = useSyncExternalStore(subscribeSync, lastSync, () => undefined);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true) && wifi;

  const court = choices.find((f) => f.id === chosen) ?? null;
  const gym = facilities.find((f) => f.sport === 'gym') ?? null;
  const facility = place === 'facilities' ? (court?.id ?? null) : place === 'gym' ? (gym?.id ?? null) : null;
  const label = place === 'facilities' && court ? court.court_label : t(`reader.place.${place}`);

  // Online: first the visits decided offline go to the township, then a sync (Review Focus 1: `offsetMs` is the
  // township's clock minus this one). Every request has a time limit and also ends with `signal`, which the effect below
  // aborts when the reader goes offline or the page closes. The queue shrinks only on an answer that was read in full, so
  // a flush that is aborted leaves it as it was.
  const refresh = useEffectEvent(async (signal: AbortSignal) => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      if (queue().length) {
        const response = await fetch('/api/reader/visits', {
          method: 'POST',
          headers: JSON_BODY,
          body: JSON.stringify({ visits: queue() }),
          signal: within(signal),
        });
        if (response.ok) {
          const { saved, skipped } = (await response.json()) as { saved: number; skipped: number };
          keepQueue(afterFlush(queue(), saved + skipped));
        }
      }
      const response = await fetch(`/api/reader/sync?${new URLSearchParams({ township: townshipId })}`, { signal: within(signal) });
      if (!response.ok) return;
      const sync = (await response.json()) as Pick<ReaderCache, 'publicKey' | 'stop' | 'bookings'> & { serverTime: number };
      const now = Date.now();
      const offsetMs = sync.serverTime - now;
      if (Number.isFinite(offsetMs)) keepSync({ publicKey: sync.publicKey, offsetMs, syncedAt: now, stop: sync.stop, bookings: sync.bookings });
    } catch {
      // The network went, a request hung or the reader was switched off while this ran: the queue and the last sync stay as they were until the next try.
    } finally {
      refreshing.current = false;
    }
  });

  // On load and on coming back online, then every 30 s while online. Going offline, or leaving, aborts what is in flight.
  // The first run waits a tick: React may set this effect up, tear it down and set it up again (Strict Mode, Fast
  // Refresh), and a run started by the first setup would still be unwinding, so the guard would skip the second.
  useEffect(() => {
    if (!online) return;
    const controller = new AbortController();
    const first = setTimeout(() => void refresh(controller.signal), 0);
    const timer = setInterval(() => void refresh(controller.signal), SYNC_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      controller.abort();
    };
  }, [online]);

  // A result stays up for 3 seconds, then the reader waits for the next card.
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), RESULT_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  /** One tap from the phone. Only the latest tap's result is shown. */
  async function present(presentation: string) {
    const tap: TapRequest = { presentation, place, facility };
    const where = { place, label };
    const id = ++taps.current;
    // Back to nothing first, so the phone shows and buzzes the next result even when it is the same as the last.
    flushSync(() => setShown(null));
    let answer: Answer;
    try {
      const township = online ? await askTownship(tap) : null;
      if (township) void remember(presentation, publicKey);
      answer = township ?? (await decideHere(tap, publicKey));
    } catch (error) {
      // The phone doesn't wait for this, so a throw would leave the reader blank and unhandled: say it can't read the card.
      console.error(`reader tap failed: ${error}`);
      answer = BAD_PASS;
    }
    if (id === taps.current) setShown({ ...answer, ...where });
  }

  const reason = (refused: { reason: DenyReason | 'bad_pass'; place: Place }) =>
    refused.reason === 'bad_pass'
      ? t('reader.badPass')
      : t(reasonKey(refused.reason), { place: t(`reader.place.${refused.place}`) });

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid gap-4">
        <Segmented
          label={t('reader.where')}
          value={place}
          onChange={setPlace}
          options={PLACES.map((p) => ({ value: p, label: t(`reader.place.${p}`) }))}
        />
        {place === 'facilities' && court && (
          <Field label={t('reader.facility')}>
            {(control) => (
              <select {...control} value={court.id} onChange={(event) => setChosen(event.target.value)}>
                {choices.map((f) => (
                  <option key={f.id} value={f.id}>
                    {SPORT_ICON[f.sport]} {f.court_label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        {/* Dark in either theme: the reader is its own scope of the dark tokens. The ring keeps its edge on a dark page. */}
        <section data-theme="dark" aria-labelledby={titleId} className="grid gap-4 rounded-3xl bg-sidebar p-5 text-text shadow-lg ring-1 ring-line">
          <div data-reader-drop className="grid min-h-80 content-center justify-items-center gap-4 text-center">
            <h2 id={titleId} className="text-sm font-extrabold uppercase tracking-widest text-muted-2">
              {t('reader.device', { place: label })}
            </h2>
            {shown ? <Mark granted={shown.granted} /> : <Ring />}
            {!shown && <p className="text-lg font-bold">{t('reader.hold')}</p>}
            <div role="status" className="grid gap-1">
              {shown?.granted === true && (
                <>
                  <p className="text-2xl font-extrabold text-green-text">{t('reader.granted', { place: shown.label })}</p>
                  <p className="text-base text-muted-2">{t('reader.logged', { unit: shown.unit })}</p>
                </>
              )}
              {shown?.granted === false && (
                <>
                  <p className="text-2xl font-extrabold text-red-text">{t('card.result.denied')}</p>
                  <p className="text-base font-bold">{reason(shown)}</p>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-1 border-t border-line pt-3">
            <div className="flex items-center gap-3">
              <label htmlFor={wifiId} className="flex-1 text-base font-bold">
                {t('reader.wifi')}
              </label>
              <Switch id={wifiId} checked={wifi} onChange={setWifi} />
            </div>
            {/* Offline by the switch, or with the switch on, by the browser: either way the reader checks cards itself. */}
            {!online && <p className="text-sm font-bold text-amber-text">{t(wifi ? 'reader.noConnection' : 'reader.wifi.off')}</p>}
            {cache !== undefined && (
              <p className="text-sm text-muted-2">
                {cache ? t('reader.sync', { time: clockTime(new Date(cache.syncedAt), opened, lang) }) : t('reader.sync.never')}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* The phone. Nothing on the way to the reader may clip the card while it is dragged: no overflow-hidden here. */}
      <section
        aria-label={t('reader.phone')}
        className="mx-auto w-full max-w-80 rounded-[2.5rem] border-[10px] border-sidebar bg-bg p-3 shadow-lg ring-1 ring-line-strong"
      >
        <div aria-hidden="true" className="mx-auto mb-3 h-6 w-24 rounded-full bg-sidebar" />
        {card ? (
          <HouseholdCard
            summary={card}
            demoPin={demoPin}
            reader={{ place, facility, onPresent: present, result: shown && (shown.granted ? 'granted' : 'denied') }}
          />
        ) : (
          <div className="grid gap-3 py-2">
            <p className="text-base font-bold">{t('reader.phone.signIn')}</p>
            <DemoButtons next="/reader" />
          </div>
        )}
      </section>
    </div>
  );
}
