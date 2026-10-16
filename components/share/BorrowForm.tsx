'use client';

import { startTransition, useActionState } from 'react';
import { requestBorrow, type ShareActionResult } from '@/app/(app)/community/share/actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useT } from '@/lib/i18n';

/**
 * "Borrow from / Return by" and "Request to borrow". The page passes today and a return date (Malaysian dates, worked
 * out on the server so the two never disagree), and shows the steps once the request is in.
 */
export function BorrowForm({
  listingId,
  today,
  returnBy,
  until,
  canAct,
}: {
  listingId: string;
  today: string;
  returnBy: string;
  until: string | null;
  canAct: boolean;
}) {
  const t = useT();
  const [result, request, pending] = useActionState(async (_: ShareActionResult, formData: FormData): Promise<ShareActionResult> => {
    try {
      return await requestBorrow(formData);
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form
      // Not `action={request}`: React resets a form after every action, which would wipe the dates when it fails.
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => request(new FormData(event.currentTarget)));
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="listing" value={listingId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('share.from')}>
          {(control) => <input {...control} type="date" name="from" required min={today} max={until ?? undefined} defaultValue={today} disabled={!canAct} />}
        </Field>
        <Field label={t('share.to')}>
          {(control) => (
            <input
              {...control}
              type="date"
              name="to"
              required
              min={today}
              max={until ?? undefined}
              defaultValue={returnBy}
              disabled={!canAct}
            />
          )}
        </Field>
      </div>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
      <Button type="submit" variant="gradient" size="xl" disabled={!canAct || pending || result?.ok === true} className="w-full focus-visible:outline-[#001C3C]">
        {t('share.request')}
      </Button>
      <p className="text-sm text-muted-2">{t('share.stepsHint')}</p>
    </form>
  );
}
