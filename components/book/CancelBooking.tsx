'use client';

import { useActionState } from 'react';
import { cancelBooking, type BookActionResult } from '@/app/(app)/book/actions';
import { buttonClasses } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';

/** "Cancel booking" on the pass, while cancelling is free (the page decides; the database checks again). */
export function CancelBooking({ id }: { id: string }) {
  const t = useT();
  // `action={act}` is fine: the form holds only a hidden field.
  const [result, act, pending] = useActionState(async (_: BookActionResult, formData: FormData): Promise<BookActionResult> => {
    try {
      return await cancelBooking(formData);
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form action={act} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className={`${buttonClasses('outline')} w-full`}>
        <span className="text-red-text">{t('book.cancel')}</span>
      </button>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
