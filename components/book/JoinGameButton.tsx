'use client';

import { useActionState } from 'react';
import { setJoined, type BookActionResult } from '@/app/(app)/book/actions';
import { buttonClasses } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';

/**
 * "Join" an open game, or "✓ You're in", which leaves it: a toggle (aria-pressed), like an event's Going. Pending
 * residents see it switched off (the layout's banner says why).
 */
export function JoinGameButton({
  bookingId,
  title,
  joined,
  canAct,
}: {
  bookingId: string;
  /** Said to screen readers after the label: "Join, Badminton Court 1, Sat 17 Oct · 8:00 – 9:00 pm". */
  title: string;
  joined: boolean;
  canAct: boolean;
}) {
  const t = useT();
  // `action={toggle}` is fine: the form holds only hidden fields.
  const [result, toggle, pending] = useActionState(async (_: BookActionResult, formData: FormData): Promise<BookActionResult> => {
    try {
      return await setJoined(formData);
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form action={toggle} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={bookingId} />
      <input type="hidden" name="join" value={joined ? 'no' : 'yes'} />
      <button aria-pressed={joined} disabled={!canAct || pending} className={buttonClasses(joined ? 'ink' : 'primary')}>
        {joined ? `✓ ${t('book.games.joined')}` : t('book.games.join')}
        <span className="sr-only">, {title}</span>
      </button>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
