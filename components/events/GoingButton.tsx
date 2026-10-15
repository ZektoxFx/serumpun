'use client';

import { useActionState } from 'react';
import { setGoing, type EventActionResult } from '@/app/(app)/community/events/actions';
import { buttonClasses } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';

/**
 * Join / Going for one event, a toggle (aria-pressed). The card has the small one; the event page has the big one
 * ("Join this event" / "✓ You're going"). Pending residents see it switched off (the layout's banner says why).
 */
export function GoingButton({
  eventId,
  title,
  going,
  official = false,
  canAct,
  big = false,
}: {
  eventId: string;
  /** Said to screen readers after the label: "Join, Toddler playdate". */
  title: string;
  going: boolean;
  /** An official event's Join is the red one (canvas). */
  official?: boolean;
  canAct: boolean;
  big?: boolean;
}) {
  const t = useT();
  // `action={toggle}` is fine: the form holds only hidden fields.
  const [result, toggle, pending] = useActionState(async (_: EventActionResult, formData: FormData): Promise<EventActionResult> => {
    try {
      return await setGoing(formData);
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  const label = big ? t(going ? 'event.youreGoing' : 'event.joinBig') : going ? `✓ ${t('event.going')}` : t('event.join');
  const look = going ? buttonClasses('ink', big ? 'lg' : 'md') : buttonClasses(official || big ? 'primary' : 'outline', big ? 'lg' : 'md');
  return (
    <form action={toggle} className={`grid gap-1 ${big ? '' : 'justify-items-start'}`}>
      <input type="hidden" name="id" value={eventId} />
      <input type="hidden" name="going" value={going ? 'no' : 'yes'} />
      <button aria-pressed={going} disabled={!canAct || pending} className={`${look} ${big ? 'w-full' : ''}`}>
        {label}
        {!big && <span className="sr-only">, {title}</span>}
      </button>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
