'use client';

import Link from 'next/link';
import { startTransition, useEffect, useEffectEvent, useRef, useState, type PointerEvent } from 'react';
import { checkCardPin, renewPass } from '@/app/(app)/me/card/actions';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Glyph } from '@/components/ui/Glyph';
import { Sheet } from '@/components/ui/Sheet';
import { PASS_TTL_SECONDS, type Place, type PublicJwk } from '@/lib/card/crypto';
import { leaseEnded } from '@/lib/card/decide';
import { clearPass, forgetDevice, needsRenewal, openDevice, presentTap, renewalOutcome, savePass, type Device } from '@/lib/card/device';
import type { CardSummary } from '@/lib/card/summary';
import { useT, type MessageKey } from '@/lib/i18n';
import { CardFace } from './CardFace';
import { CardQr } from './CardQr';
import { MoveQuestion } from './MoveQuestion';
import { PinSheet } from './PinSheet';

const IDLE_MS = 60_000; // the open card locks again after this long without a touch
const RECHECK_MS = 300_000; // while the page stays open, how often the pass is looked at again
const WAITING_RETRY_MS = 5_000; // while the card waits to move to this phone, how often it asks again

// Some in-app browsers have no IndexedDB, and some throw when it is touched at all (site data blocked).
function browserIdb(): IDBFactory | undefined {
  try {
    return window.indexedDB;
  } catch {
    return undefined;
  }
}

/**
 * This browser's device (key and pass). Its pass is renewed as soon as the device is ready, so that it carries the card's
 * state as it is now (a reader that is offline trusts the places and the suspension written in it), and again whenever
 * the browser comes back online or a page left open is down to its last hour. `problem` is why a renewal failed, and what
 * each answer means (renewalOutcome):
 * - the key waits for the card to move to it: asks again every few seconds, the only thing in the app that polls;
 * - the card moved away, or the township refused: the pass is dropped, here and in storage, and nothing asks again until the
 *   page loads again (or, once the card moved, until `claimHere`);
 * - the township could not be reached: the pass stays, and the usual schedule asks again.
 * `holdsCard` says this browser's key is the active one, as far as the page can tell: the township has given this page a
 * pass for it, and the page's `moveWaiting` is not about this browser's own wait. The flag is read when the server renders
 * the page and the waiting browser shares the phone, so it sees the flag too; once it has the card the flag is stale (it
 * was about itself) until the server sends the page again, as a new `summary`. It must not be asked to move the card it just got.
 */
function useDevice(summary: CardSummary) {
  const [device, setDevice] = useState<Device | 'unsupported' | null>(null);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const [renewed, setRenewed] = useState(false);
  const [waitedAs, setWaitedAs] = useState<CardSummary | null>(null);
  // `claimHere` bumps it to open the device again, which makes a new key once the old one is forgotten.
  const [attempt, setAttempt] = useState(0);
  const renewing = useRef(false);
  // Set by a refusal that asking again would not change: no renewal starts from the schedule until the page loads again.
  const halted = useRef(false);

  // Handles an error answer. A pass the township refused must not stay to present: it goes from memory at once, and then from storage.
  const refuse = (error: MessageKey) => {
    const { dropPass, retry } = renewalOutcome(error);
    setProblem(error);
    if (retry === 'never') halted.current = true;
    if (!dropPass) return;
    setRenewed(false);
    setDevice((current) => (current === null || current === 'unsupported' ? current : { ...current, pass: null, passExp: null }));
    const idb = browserIdb();
    if (idb) clearPass(idb).catch((cause) => console.warn('the old pass could not be dropped from this browser', cause));
  };

  // A new pass for this browser's key, kept with it. Offline there is nobody to ask, and the pass it has stays.
  const renew = useEffectEvent(async (publicKey: PublicJwk) => {
    if (renewing.current || !navigator.onLine) return;
    renewing.current = true;
    try {
      const answer = await renewPass(publicKey);
      if ('error' in answer) return refuse(answer.error);
      // The township signs a pass for PASS_TTL_SECONDS from now.
      const passExp = Math.floor(Date.now() / 1000) + PASS_TTL_SECONDS;
      await savePass(browserIdb()!, answer.pass, passExp);
      if (problem === 'card.move.waiting') setWaitedAs(summary);
      setProblem(null);
      setRenewed(true);
      setDevice((current) => (current === null || current === 'unsupported' ? current : { ...current, pass: answer.pass, passExp }));
    } catch {
      refuse('common.error');
    } finally {
      renewing.current = false;
    }
  });

  useEffect(() => {
    let live = true;
    void openDevice(browserIdb()).then((found) => {
      if (!live) return;
      setDevice(found);
      if (found !== 'unsupported') startTransition(() => renew(found.publicKey));
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (device === null || device === 'unsupported') return;
    const check = () => {
      if (!halted.current && needsRenewal(device.passExp, Date.now())) startTransition(() => renew(device.publicKey));
    };
    window.addEventListener('online', check);
    const timer = setInterval(check, RECHECK_MS);
    return () => {
      window.removeEventListener('online', check);
      clearInterval(timer);
    };
  }, [device]);

  // While the key waits for the card to move to it, ask again every few seconds: the old phone or a manager may have moved it.
  const waitingKey = problem === 'card.move.waiting' && device !== null && device !== 'unsupported' ? device.publicKey : null;
  useEffect(() => {
    if (waitingKey === null) return;
    const timer = setInterval(() => startTransition(() => renew(waitingKey)), WAITING_RETRY_MS);
    return () => clearInterval(timer);
  }, [waitingKey]);

  /** The old phone moved the card away on purpose: this browser is in the state the township's `moved` answer would leave it in. */
  const onMoved = () => refuse('card.move.moved');

  /** "Use the card on this phone", once the card moved away: forget the retired key, and open the device again, which asks for the card with a new key. */
  const claimHere = async () => {
    const idb = browserIdb();
    if (!idb) return;
    try {
      await forgetDevice(idb);
    } catch {
      return setProblem('common.error');
    }
    halted.current = false;
    setProblem(null);
    setRenewed(false);
    setDevice(null);
    setAttempt((n) => n + 1);
  };

  return { device, problem, holdsCard: renewed && waitedAs !== summary, onMoved, claimHere };
}

/** Whether a point is over the reader (the element marked `data-reader-drop`). The card in the hand is let through first, or it would be what is found. */
function overReader(card: HTMLElement, x: number, y: number): boolean {
  card.style.pointerEvents = 'none';
  const found = document.elementFromPoint(x, y);
  card.style.pointerEvents = '';
  return found?.closest('[data-reader-drop]') != null;
}

/**
 * The household card in Me. Closed, it is the card with "Tap to open"; the PIN opens it, and it locks again when the
 * person leaves or after a minute without a touch. Open, a real phone says "Hold near a reader". With `reader` (the demo
 * phone beside the reader screen) it has a Tap button and can be dragged onto the element marked `data-reader-drop`.
 * Either way `reader.onPresent` gets the signed presentation, and `reader.result` makes the phone buzz and show ✓ or ✕.
 */
export function HouseholdCard({
  summary,
  demoPin,
  reader,
}: {
  summary: CardSummary;
  demoPin: string | null;
  reader?: { place: Place; facility: string | null; onPresent: (presentation: string) => void; result: 'granted' | 'denied' | null };
}) {
  const t = useT();
  const { device, problem, holdsCard, onMoved, claimHere } = useDevice(summary);
  const [today] = useState(() => new Date());
  const [pinOpen, setPinOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState(false);
  const [wallet, setWallet] = useState(false);
  const [touches, setTouches] = useState(0);
  const [held, setHeld] = useState<{ fromX: number; fromY: number; x: number; y: number } | null>(null);
  const [tapProblem, setTapProblem] = useState<MessageKey | null>(null);
  const openCard = useRef<HTMLDivElement>(null);
  const result = reader?.result ?? null;
  const usable = device !== null && device !== 'unsupported' && device.pass !== null ? device : null;
  const error = problem ?? tapProblem;
  const status = summary.suspended
    ? t('card.status.suspended', { reason: summary.reason ?? '' })
    : leaseEnded(summary.leaseEnd, today)
      ? t('card.status.ended')
      : null;

  // The card locks after a minute without a touch; every touch starts the minute again.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setOpen(false);
      setQr(false);
    }, IDLE_MS);
    return () => clearTimeout(timer);
  }, [open, touches]);

  // The closed card had the focus when the PIN sheet opened and is gone when it closes: the open card takes it.
  useEffect(() => {
    if (open) openCard.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (result) navigator.vibrate?.(result === 'granted' ? 60 : [80, 60, 80]);
  }, [result]);

  async function tap() {
    if (!reader || !usable) return;
    try {
      reader.onPresent(await presentTap(usable, { place: reader.place, facility: reader.facility }, Date.now()));
      setTapProblem(null);
    } catch {
      setTapProblem('common.error');
    }
  }

  // Dragging the card onto the reader is a tap; the Tap button is the same thing for the keyboard.
  const drag = reader && {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setHeld({ fromX: event.clientX, fromY: event.clientY, x: 0, y: 0 });
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) =>
      setHeld((hand) => hand && { ...hand, x: event.clientX - hand.fromX, y: event.clientY - hand.fromY }),
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      if (!held) return;
      setHeld(null);
      if (overReader(event.currentTarget, event.clientX, event.clientY)) void tap();
    },
    onPointerCancel: () => setHeld(null),
  };

  // A new browser waits for this phone's card. Only the browser that holds it is asked, and only once this page has had its pass
  // from the township: a pass kept from before could be of a key that has moved.
  const movable = summary.moveWaiting && !reader && holdsCard ? usable : null;
  // Told in place of an error: neither is a mistake, and each says what to do next.
  const moveNote = problem === 'card.move.waiting' || problem === 'card.move.moved' ? problem : null;

  return (
    <section
      aria-label={t('card.title')}
      className="grid gap-3"
      onPointerDownCapture={() => setTouches((n) => n + 1)}
      onKeyDownCapture={() => setTouches((n) => n + 1)}
    >
      {movable && <MoveQuestion cardId={summary.id} device={movable} onMoved={onMoved} />}

      {open ? (
        <>
          <div ref={openCard} tabIndex={-1} className="animate-card-pop outline-none motion-reduce:animate-none">
            <div
              {...drag}
              style={held ? { transform: `translate(${held.x}px, ${held.y}px)` } : undefined}
              className={`${reader ? 'cursor-grab touch-none select-none active:cursor-grabbing' : ''} ${
                held ? 'relative z-20' : 'transition-transform duration-200 motion-reduce:transition-none'
              } ${result === 'denied' ? 'animate-shake motion-reduce:animate-none' : ''}`}
            >
              <CardFace summary={summary} status={status} />
            </div>
          </div>

          <div role="status">
            {result && (
              <p
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-base font-extrabold ${
                  result === 'granted' ? 'bg-tint-green text-green-text' : 'bg-tint-red text-red-text'
                }`}
              >
                <span aria-hidden="true">{result === 'granted' ? '✓' : '✕'}</span>
                {t(result === 'granted' ? 'card.result.granted' : 'card.result.denied')}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            {reader ? (
              <Button type="button" size="lg" disabled={!usable} onClick={() => void tap()}>
                {t('card.tap')}
              </Button>
            ) : (
              <p className="text-center text-base font-bold text-muted-2">{t('card.hold')}</p>
            )}
            <Button type="button" variant="ink" aria-haspopup="dialog" onClick={() => setWallet(true)}>
              {t('card.wallet')}
            </Button>
            <Button type="button" variant="outline" aria-expanded={qr} disabled={!usable} onClick={() => setQr(!qr)}>
              {qr ? t('card.qr.hide') : t('card.qr.show')}
            </Button>
            {qr && usable && <CardQr device={usable} />}
            {/* The demo phone beside the reader screen is a phone, not a person's Me page. */}
            {!reader && (
              <Link href="/me/household" className={buttonClasses('outline')}>
                {t('household.heading')} <span aria-hidden="true">›</span>
              </Link>
            )}
          </div>
        </>
      ) : device === 'unsupported' ? (
        <CardFace summary={summary} status={status} note={t('card.unsupported')} />
      ) : (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setPinOpen(true)}
          // On the gradient the page's red ring vanishes: navy, drawn inside the card.
          className="block w-full rounded-2xl text-left focus-visible:outline-[#001C3C] focus-visible:-outline-offset-4"
        >
          <CardFace
            summary={summary}
            status={status}
            note={
              <>
                <Glyph emoji="🔒" /> {t('card.open')}
              </>
            }
          />
        </button>
      )}

      {moveNote ? (
        <div className="grid gap-2 rounded-xl bg-soft px-4 py-3">
          <p role="status" className="text-sm text-muted-2">
            {t(moveNote)}
          </p>
          {moveNote === 'card.move.moved' && (
            <Button type="button" onClick={() => void claimHere()}>
              {t('card.move.useHere')}
            </Button>
          )}
        </div>
      ) : (
        error && (
          <p role="alert" className="text-sm font-bold text-red-text">
            {t(error)}
          </p>
        )
      )}

      {device !== 'unsupported' && (
        <>
          <PinSheet
            open={pinOpen}
            onClose={() => setPinOpen(false)}
            title={t('card.pin.title')}
            cardId={summary.id}
            demoPin={demoPin}
            check={checkCardPin}
            onDone={() => {
              setPinOpen(false);
              setOpen(true);
            }}
          />
          <Sheet open={wallet} onClose={() => setWallet(false)} title={t('card.wallet')}>
            <p className="pb-2 text-base">{t('card.wallet.body')}</p>
          </Sheet>
        </>
      )}
    </section>
  );
}
