'use client';

import { startTransition, useEffect, useEffectEvent, useRef, useState, type PointerEvent } from 'react';
import { renewPass } from '@/app/(app)/me/card/actions';
import { Button } from '@/components/ui/Button';
import { Glyph } from '@/components/ui/Glyph';
import { Sheet } from '@/components/ui/Sheet';
import { PASS_TTL_SECONDS, type Place, type PublicJwk } from '@/lib/card/crypto';
import { leaseEnded } from '@/lib/card/decide';
import { needsRenewal, openDevice, presentTap, savePass, type Device } from '@/lib/card/device';
import type { CardSummary } from '@/lib/card/summary';
import { useT, type MessageKey } from '@/lib/i18n';
import { CardFace } from './CardFace';
import { CardQr } from './CardQr';
import { PinPad } from './PinPad';

const IDLE_MS = 60_000; // the open card locks again after this long without a touch
const RECHECK_MS = 300_000; // while the page stays open, how often the pass is looked at again

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
 * the browser comes back online or a page left open is down to its last hour. `problem` is why a renewal failed.
 */
function useDevice() {
  const [device, setDevice] = useState<Device | 'unsupported' | null>(null);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const renewing = useRef(false);

  // A new pass for this browser's key, kept with it. Offline there is nobody to ask, and the pass it has stays.
  const renew = useEffectEvent(async (publicKey: PublicJwk) => {
    if (renewing.current || !navigator.onLine) return;
    renewing.current = true;
    try {
      const answer = await renewPass(publicKey);
      if ('error' in answer) return setProblem(answer.error);
      // The township signs a pass for PASS_TTL_SECONDS from now.
      const passExp = Math.floor(Date.now() / 1000) + PASS_TTL_SECONDS;
      await savePass(browserIdb()!, answer.pass, passExp);
      setProblem(null);
      setDevice((current) => (current === null || current === 'unsupported' ? current : { ...current, pass: answer.pass, passExp }));
    } catch {
      setProblem('common.error');
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
  }, []);

  useEffect(() => {
    if (device === null || device === 'unsupported') return;
    const check = () => {
      if (needsRenewal(device.passExp, Date.now())) startTransition(() => renew(device.publicKey));
    };
    window.addEventListener('online', check);
    const timer = setInterval(check, RECHECK_MS);
    return () => {
      window.removeEventListener('online', check);
      clearInterval(timer);
    };
  }, [device]);

  return { device, problem };
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
  const { device, problem } = useDevice();
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

  return (
    <section
      aria-label={t('card.title')}
      className="grid gap-3"
      onPointerDownCapture={() => setTouches((n) => n + 1)}
      onKeyDownCapture={() => setTouches((n) => n + 1)}
    >
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

      {error && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(error)}
        </p>
      )}

      {device !== 'unsupported' && (
        <>
          <Sheet open={pinOpen} onClose={() => setPinOpen(false)} title={t('card.pin.title')}>
            <PinPad
              cardId={summary.id}
              demoPin={demoPin}
              onUnlock={() => {
                setPinOpen(false);
                setOpen(true);
              }}
            />
          </Sheet>
          <Sheet open={wallet} onClose={() => setWallet(false)} title={t('card.wallet')}>
            <p className="pb-2 text-base">{t('card.wallet.body')}</p>
          </Sheet>
        </>
      )}
    </section>
  );
}
