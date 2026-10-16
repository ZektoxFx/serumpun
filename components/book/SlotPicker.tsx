'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useId, useState } from 'react';
import { bookSlot, type BookActionResult } from '@/app/(app)/book/actions';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Switch } from '@/components/ui/Switch';
import { MAX_PLAYERS, type SlotState } from '@/lib/domain/booking';
import { useT } from '@/lib/i18n';

/** A slot as the page shows it: its state, "8 pm", "8:00 – 9:00 pm", and the reader's own booking there, if any. */
export type Slot = { hour: number; state: SlotState; label: string; range: string; mine: string | null };

/** The court and the day, for the confirm sheet (worked out on the server, in the reader's language). */
export type BookingSummary = { icon: string; court: string; place: string; day: string; township: string; games: boolean };

const slotClass = 'flex min-h-11 w-full items-center justify-center rounded-[10px] border-[1.5px] px-1 text-[0.8125rem]';
const stepper =
  'grid size-11 place-items-center rounded-xl border-[1.5px] border-line-strong bg-surface text-lg text-text hover:bg-soft disabled:opacity-50';

/**
 * The day's slots of Book a Court (canvas "1 · Pick a slot"), four to a row with their legend, and a bar at the bottom of
 * the screen: the household's hours left and "Book h:mm – h:mm", which opens "Confirm booking" (artboard 2). The page
 * remounts it (its `key`) for another court or day, so a pick never carries over.
 */
export function SlotPicker({
  facilityId,
  date,
  slots,
  hoursLeft,
  canAct,
  summary,
}: {
  facilityId: string;
  date: string;
  slots: Slot[];
  hoursLeft: number;
  canAct: boolean;
  summary: BookingSummary;
}) {
  const t = useT();
  const [pick, setPick] = useState<number | null>(null);
  // The slot being confirmed, kept as it was when the sheet opened: the sheet still explains a failure after the refresh.
  const [confirming, setConfirming] = useState<Slot | null>(null);
  // A pick someone else has just taken (the page refreshes after a failed booking) is no pick.
  const picked = slots.find((s) => s.hour === pick && s.state === 'available') ?? null;
  const household =
    hoursLeft === 0
      ? t('book.household.none', { day: summary.day })
      : hoursLeft === 1
        ? t('book.household.one', { day: summary.day })
        : t('book.household', { n: hoursLeft, day: summary.day });

  return (
    <>
      <h2 className="mt-0.5 text-sm font-extrabold">{t('book.pick', { day: summary.day })}</h2>
      <ul className="grid grid-cols-4 gap-2">
        {slots.map((s) => (
          <li key={s.hour}>
            {s.mine ? (
              <Link href={`/book/${s.mine}`} className={`${slotClass} border-green-text bg-tint-green font-extrabold text-green-text`}>
                ✓ {s.label}
                <span className="sr-only">, {t('book.slot.mine')}</span>
              </Link>
            ) : s.state === 'available' ? (
              <button
                type="button"
                aria-pressed={picked?.hour === s.hour}
                onClick={() => setPick(s.hour)}
                className={`${slotClass} ${
                  picked?.hour === s.hour ? 'border-red bg-red font-extrabold text-white' : 'border-line-strong bg-surface font-bold hover:bg-soft'
                }`}
              >
                {s.label}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className={`${slotClass} border-chip bg-chip font-semibold text-muted ${s.state === 'booked' ? 'line-through' : ''}`}
              >
                {s.label}
                <span className="sr-only">, {t(s.state === 'booked' ? 'book.slot.booked' : 'book.slot.past')}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {/* Each slot tells screen readers its own state. */}
      <div aria-hidden="true" className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs font-semibold text-muted-2">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] border-[1.5px] border-line-strong bg-surface" />
          {t('book.legend.available')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-chip" />
          {t('book.legend.booked')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-red" />
          {t('book.legend.pick')}
        </span>
        {slots.some((s) => s.mine) && (
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] border-[1.5px] border-green-text bg-tint-green" />
            {t('book.legend.mine')}
          </span>
        )}
      </div>

      {/* Where the bottom navigation would be: it hides on this page (canvas). */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md flex-col gap-2 px-4 pt-3">
          <p className="text-center text-xs text-muted-2">{canAct ? household : t('common.pendingCantAct')}</p>
          <Button
            type="button"
            variant="gradient"
            size="xl"
            disabled={!canAct || !picked || hoursLeft === 0}
            onClick={() => setConfirming(picked)}
            className="w-full focus-visible:outline-[#001C3C]"
          >
            {picked ? t('book.cta', { range: picked.range }) : t('book.pickFirst')}
          </Button>
        </div>
      </div>

      <Sheet open={confirming !== null} onClose={() => setConfirming(null)} title={t('book.confirm.title')}>
        {confirming && (
          <ConfirmBooking facilityId={facilityId} date={date} slot={confirming} summary={summary} onBack={() => setConfirming(null)} />
        )}
      </Sheet>
    </>
  );
}

/**
 * Artboard 2: the court, the day and hour, Free, Find players (off, or 1 to 10 players), the rules, and Confirm. Mounted
 * on every opening, so no old error or player count stays.
 */
function ConfirmBooking({
  facilityId,
  date,
  slot,
  summary,
  onBack,
}: {
  facilityId: string;
  date: string;
  slot: Slot;
  summary: BookingSummary;
  onBack: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const id = useId();
  const [find, setFind] = useState(false);
  const [players, setPlayers] = useState(1);
  // `action={book}` is fine: the form holds only hidden fields (the toggle and stepper are buttons).
  const [result, book, pending] = useActionState(async (_: BookActionResult, formData: FormData): Promise<BookActionResult> => {
    try {
      const done = await bookSlot(formData);
      if (done?.ok) router.push(`/book/${done.id}`);
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);
  const rows = [
    { icon: summary.icon, tint: 'bg-tint-orange', title: summary.court, sub: summary.place },
    { icon: '📅', tint: 'bg-tint-blue', title: summary.day, sub: t('book.confirm.hour', { range: slot.range }) },
    { icon: '✓', tint: 'bg-tint-green text-green-text', title: t('book.free'), sub: t('book.confirm.freeFor', { township: summary.township }) },
  ];

  return (
    <form action={book} className="flex flex-col gap-3 pt-1">
      <input type="hidden" name="facility" value={facilityId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="hour" value={slot.hour} />
      <input type="hidden" name="players" value={find ? players : 0} />
      <ul className="flex flex-col gap-2.5">
        {rows.map((r, i) => (
          <li key={r.icon} className="flex items-center gap-3">
            <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl text-xl ${r.tint}`}>
              {r.icon}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className={`break-words text-[0.9375rem] font-bold ${i === 2 ? 'text-green-text' : ''}`}>{r.title}</span>
              <span className="break-words text-sm text-muted-2">{r.sub}</span>
            </span>
          </li>
        ))}
      </ul>
      {/* Find players is for the courts' games, not the hall, gym, BBQ pit or room. */}
      {summary.games && (
        <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-line px-3.5 py-3">
          <div className="flex min-h-11 items-center justify-between gap-2.5">
            <span className="flex min-w-0 flex-col">
              <span id={`${id}-find`} className="text-[0.9375rem] font-bold">
                <span aria-hidden="true">🙋 </span>
                {t('book.players.find')}
              </span>
              <span id={`${id}-hint`} className="text-xs text-muted-2">
                {t('book.players.findHint')}
              </span>
            </span>
            <Switch checked={find} onChange={setFind} aria-labelledby={`${id}-find`} aria-describedby={`${id}-hint`} />
          </div>
          {find && (
            <div className="flex items-center justify-between gap-2.5">
              <span id={`${id}-needed`} className="text-sm font-semibold text-muted-2">
                {t('book.players.needed')}
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label={t('book.players.fewer')}
                  disabled={players <= 1}
                  onClick={() => setPlayers(players - 1)}
                  className={stepper}
                >
                  −
                </button>
                <output aria-labelledby={`${id}-needed`} className="min-w-5 text-center text-lg font-extrabold">
                  {players}
                </output>
                <button
                  type="button"
                  aria-label={t('book.players.more')}
                  disabled={players >= MAX_PLAYERS}
                  onClick={() => setPlayers(players + 1)}
                  className={stepper}
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <ul className="flex list-disc flex-col gap-1 rounded-[14px] bg-soft py-3 pl-8 pr-3.5 text-sm text-muted-2">
        <li>{t('book.rule.hours')}</li>
        <li>{t('book.rule.cancel')}</li>
        <li>{t('book.rule.noShows')}</li>
      </ul>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
      <Button
        type="submit"
        variant="gradient"
        size="xl"
        disabled={pending || result?.ok === true}
        className="w-full focus-visible:outline-[#001C3C]"
      >
        {t('book.confirm.title')}
      </Button>
      <button type="button" onClick={onBack} className="min-h-11 rounded-xl text-sm font-bold text-muted-2">
        {t('common.back')}
      </button>
    </form>
  );
}
