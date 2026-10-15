'use client';

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react';
import { markVoucherUsed, type RewardResult } from '@/app/(app)/rewards/actions';
import { intlLocale } from '@/lib/domain/events';
import { TZ } from '@/lib/domain/time';
import { useLang, useT } from '@/lib/i18n';

/** The knob's width plus the track's padding on both sides, in px (size-12 knob, p-1.5 track). */
const KNOB_AND_PADDING = 48 + 12;

/**
 * "Slide to use, in front of the cashier": drag the knob over 80% of the track, or press Enter or Space on it. A tap
 * alone never uses the voucher (a pointer click is ignored; only the keyboard's click counts).
 */
export function SlideToUse({ voucherId }: { voucherId: string }) {
  const t = useT();
  const hint = useId();
  const track = useRef<HTMLDivElement>(null);
  const grab = useRef(0); // where on the knob the finger is, so the knob does not jump under it
  const [dragging, setDragging] = useState(false);
  const [x, setX] = useState(0);
  const [result, use, pending] = useActionState(async (): Promise<RewardResult> => {
    const formData = new FormData();
    formData.set('id', voucherId);
    let done: RewardResult;
    try {
      done = await markVoucherUsed(formData);
    } catch {
      done = { ok: false, error: 'common.error' };
    }
    if (!done?.ok) setX(0); // a refused slide (expired meanwhile, no connection) puts the knob back
    return done;
  }, null);
  const end = () => (track.current?.clientWidth ?? KNOB_AND_PADDING) - KNOB_AND_PADDING;
  const confirm = () => {
    setX(end());
    startTransition(() => use());
  };

  return (
    <div className="grid gap-1">
      <div ref={track} className="relative flex h-15 touch-none select-none items-center rounded-full bg-tint-blue p-1.5">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-16 right-4 flex items-center text-sm font-extrabold">
          {t('reward.slide')}
        </span>
        <button
          type="button"
          aria-label={t('reward.slide')}
          aria-describedby={hint}
          disabled={pending}
          style={{ transform: `translateX(${x}px)` }}
          className={`relative grid size-12 shrink-0 cursor-grab place-items-center rounded-full bg-ink text-xl text-on-ink active:cursor-grabbing ${
            dragging ? '' : 'transition-transform duration-200 motion-reduce:transition-none'
          }`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            grab.current = event.clientX - x;
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (dragging) setX(Math.min(end(), Math.max(0, event.clientX - grab.current)));
          }}
          onPointerUp={() => {
            setDragging(false);
            if (x >= end() * 0.8) confirm();
            else setX(0);
          }}
          onPointerCancel={() => {
            setDragging(false);
            setX(0);
          }}
          onClick={(event) => {
            if (event.detail === 0) confirm(); // Enter or Space; a mouse or finger click reports 1 or more
          }}
        >
          →
        </button>
      </div>
      <p id={hint} className="text-center text-xs text-muted-2">
        {t('reward.slideHint')}
      </p>
      {result && !result.ok && (
        <p role="alert" className="text-center text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </div>
  );
}

/** "Now 3:45:07 pm", ticking every second, so a screenshot of a used voucher cannot pass for a fresh one. */
export function LiveClock() {
  const lang = useLang();
  const t = useT();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = new Intl.DateTimeFormat(intlLocale(lang), {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);
  return (
    // The server rendered with its own clock a moment earlier; let the phone's time win without a warning.
    <p className="text-xl font-extrabold tabular-nums" suppressHydrationWarning>
      {`${t('reward.now')} ${time}`}
    </p>
  );
}
