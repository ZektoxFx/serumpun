'use client';

import { useActionState, useState } from 'react';
import { decideResident, type DashboardResult } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';

/**
 * Approve or Reject for one pending resident. Rejecting asks once more: a rejected applicant is locked out, and the
 * dashboard has no way to undo it.
 */
export function ResidentDecision({ id, name }: { id: string; name: string }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  // `action={decide}` is fine: nothing in this form (one hidden id, two named buttons) is lost when React resets it.
  const [result, decide, pending] = useActionState(async (_: DashboardResult, formData: FormData): Promise<DashboardResult> => {
    try {
      return await decideResident(formData);
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);
  const who = <span className="sr-only"> {name}</span>; // the visible column says who; screen readers hear it here

  // The keys matter: without them React reuses the clicked Reject <button> as "Yes, reject" while the click is still
  // being handled, and the browser then submits it as a rejection (seen in testing). preventDefault guards the same.
  return (
    <form action={decide} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {confirming ? (
        <>
          {/* A line of its own, so "Yes, reject" never lands where Approve was a click ago. */}
          <p key="question" className="w-full text-sm font-bold">
            {t('dashboard.residents.confirmQuestion', { name })}
          </p>
          <Button key="confirm" name="status" value="rejected" variant="primary" disabled={pending}>
            {t('dashboard.residents.confirmReject')}
            {who}
          </Button>
          <Button key="cancel" type="button" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </Button>
        </>
      ) : (
        <>
          <Button key="approve" name="status" value="verified" variant="ink" disabled={pending}>
            {t('dashboard.residents.approve')}
            {who}
          </Button>
          <Button
            key="reject"
            type="button"
            variant="outline"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              setConfirming(true);
            }}
          >
            {t('dashboard.residents.reject')}
            {who}
          </Button>
        </>
      )}
      {result && !result.ok && (
        <p role="alert" className="w-full text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
