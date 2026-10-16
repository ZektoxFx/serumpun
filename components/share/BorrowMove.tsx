'use client';

import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { advanceBorrow, closeListing, type ShareActionResult } from '@/app/(app)/community/share/actions';
import { buttonClasses, type ButtonVariant } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';

/**
 * One button that moves a borrow request on (`requestId` and `next`), or takes the owner's listing down (`listingId`,
 * then on to My listings: a removed listing has no page). The page shows only the moves the reader may make; the
 * database checks again.
 */
export function BorrowMove({
  requestId,
  next,
  listingId,
  label,
  variant = 'outline',
}: {
  requestId?: string;
  next?: string;
  listingId?: string;
  label: string;
  variant?: ButtonVariant;
}) {
  const t = useT();
  const router = useRouter();
  // `action={act}` is fine: the form holds only hidden fields.
  const [result, act, pending] = useActionState(async (_: ShareActionResult, formData: FormData): Promise<ShareActionResult> => {
    try {
      if (!listingId) return await advanceBorrow(formData);
      const done = await closeListing(formData);
      if (done?.ok) router.replace('/community?tab=share&view=mine');
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form action={act} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={listingId ?? requestId} />
      {next && <input type="hidden" name="next" value={next} />}
      <button disabled={pending} className={buttonClasses(variant)}>
        {label}
      </button>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
