'use client';

import { unstable_rethrow } from 'next/navigation';
import { useEffect, useEffectEvent, useState } from 'react';
import { checkCardPin } from '@/app/(app)/me/card/actions';
import { Button } from '@/components/ui/Button';
import { afterDemoTry, demoLocked, PIN_TRIES, type DemoLock, type PinAnswer } from '@/lib/card/pin';
import { clockTime } from '@/lib/domain/time';
import { useLang, useT } from '@/lib/i18n';

const PIN_LENGTH = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'delete'] as const;

// A demo account is shared by every visitor, so the database cannot count one browser's wrong tries (lib/card/pin.ts).
// They are kept in this tab: a reload keeps them, a new tab starts again.
const lockKey = (cardId: string) => `serumpun.card.pin.${cardId}`;

function readLock(cardId: string): DemoLock {
  try {
    const saved = JSON.parse(sessionStorage.getItem(lockKey(cardId)) ?? 'null') as Partial<DemoLock> | null;
    if (typeof saved?.fails === 'number' && (saved.until === null || typeof saved.until === 'number')) {
      return { fails: saved.fails, until: saved.until };
    }
  } catch {
    // storage blocked, or something that is not ours: no tries counted yet
  }
  return { fails: 0, until: null };
}

function writeLock(cardId: string, lock: DemoLock) {
  try {
    sessionStorage.setItem(lockKey(cardId), JSON.stringify(lock));
  } catch {
    // storage blocked: the tries are then forgotten when this pad closes
  }
}

// `cardId` and `demoPin` go together: the demo lock is kept under the card's id, so a demo PIN without one is refused.
type PinPadProps = {
  check?: (pin: string) => Promise<PinAnswer>;
  onUnlock?: () => void;
} & ({ cardId: string; demoPin: string | null } | { cardId?: never; demoPin?: never });

/**
 * The 6-digit PIN pad. The sixth digit sends the PIN to `check` (the card's own PIN by default), and the right one
 * calls `onUnlock`; Register and Sign in pass their own check, which signs someone in by redirecting. The keyboard
 * types too, for a laptop. A locked PIN greys the keys until it opens again. With `demoPin` (the card `cardId` of a demo
 * account) the pad shows that PIN and counts the wrong tries and the lock here instead of in the database.
 */
export function PinPad({ cardId, demoPin, check = checkCardPin, onUnlock }: PinPadProps) {
  const t = useT();
  const lang = useLang();
  const [digits, setDigits] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // The keys come back when the lock ends.
  useEffect(() => {
    if (lockedUntil === null) return;
    const timer = setTimeout(() => {
      setLockedUntil(null);
      setMessage(null);
    }, Math.max(0, lockedUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [lockedUntil]);

  /** `time` is the server's wording of when it opens (the resident's language, Malaysia time); a demo lock words its own. */
  function showLock(until: number, time?: string) {
    setLockedUntil(until);
    setMessage(t('card.pin.error.locked', { time: time ?? clockTime(new Date(until), new Date(), lang) }));
  }

  async function submit(pin: string) {
    setBusy(true);
    try {
      // The lock is looked at before the database is asked, because the database never locks a demo account.
      const demo = demoPin ? { cardId, lock: readLock(cardId) } : null;
      if (demo && demoLocked(demo.lock, Date.now())) return showLock(demo.lock.until!);
      const answer = await check(pin);
      if (answer.ok) {
        if (demo) writeLock(demo.cardId, afterDemoTry(demo.lock, true, Date.now())); // a right PIN starts the count again
        return onUnlock?.();
      }
      // Only a wrong PIN is a try. A failed lookup is not, and the server always says 5 left for a demo account.
      if (demo && answer.error === 'card.pin.error.wrong') {
        const next = afterDemoTry(demo.lock, false, Date.now());
        writeLock(demo.cardId, next);
        return next.until === null ? setMessage(t(answer.error, { n: PIN_TRIES - next.fails })) : showLock(next.until);
      }
      if (answer.lockedUntil) return showLock(Date.parse(answer.lockedUntil), answer.time);
      setMessage(t(answer.error, { n: answer.triesLeft ?? 0 }));
    } catch (error) {
      // A check that signed someone in ends in a redirect, which reaches here as a throw: the router finishes it.
      unstable_rethrow(error);
      setMessage(t('common.error'));
    } finally {
      setBusy(false);
      setDigits('');
    }
  }

  function press(digit: string) {
    if (busy || lockedUntil !== null) return;
    setMessage(null);
    const next = digits + digit;
    setDigits(next);
    if (next.length === PIN_LENGTH) void submit(next);
  }

  function erase() {
    if (busy || lockedUntil !== null) return;
    setMessage(null);
    setDigits(digits.slice(0, -1));
  }

  // The listener lives on the document, so typing works wherever the focus sits in the sheet (it starts on the close button).
  const typed = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    // A key typed into a field is the field's: on /sign-in the staff email form sits beside the pad.
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select')) return;
    if (/^[0-9]$/.test(event.key)) press(event.key);
    else if (event.key === 'Backspace') erase();
  });
  useEffect(() => {
    const listen = (event: KeyboardEvent) => typed(event);
    document.addEventListener('keydown', listen);
    return () => document.removeEventListener('keydown', listen);
  }, []);

  return (
    <div className="grid gap-4 pb-2">
      {demoPin && <p className="text-center text-sm font-bold text-muted-2">{t('card.pin.demo', { pin: demoPin })}</p>}
      <div aria-hidden="true" className="flex justify-center gap-3">
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={`size-4 rounded-full border-2 border-text ${i < digits.length ? 'bg-text' : ''}`} />
        ))}
      </div>
      <p role="status" className="sr-only">
        {t('card.pin.entered', { n: digits.length })}
      </p>
      <p role="alert" className="min-h-5 text-center text-sm font-bold text-red-text">
        {message}
      </p>
      <div className="mx-auto grid w-full max-w-72 grid-cols-3 gap-2">
        {KEYS.map((key) =>
          key === null ? (
            <span key="gap" aria-hidden="true" />
          ) : (
            <Button
              key={key}
              type="button"
              variant="outline"
              size="xl"
              disabled={lockedUntil !== null}
              aria-label={key === 'delete' ? t('card.pin.delete') : undefined}
              onClick={() => (key === 'delete' ? erase() : press(key))}
            >
              {key === 'delete' ? <span aria-hidden="true">⌫</span> : key}
            </Button>
          ),
        )}
      </div>
    </div>
  );
}
