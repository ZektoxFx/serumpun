'use client';

import { useActionState } from 'react';
import { meToo, type ReportActionResult } from '@/app/(app)/reports/actions';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';

/**
 * "👍 Me too" on a neighbour's open report. Once said, it becomes a filled label: there is no taking it back, and the RPC
 * ignores a second tap anyway. With `count` the label carries the number ("Me too (13)").
 */
export function MeTooButton({
  reportId,
  done,
  count,
  onDone,
  className = '',
}: {
  reportId: string;
  /** The resident has already said Me too. */
  done: boolean;
  count?: number;
  /** After a successful Me too, before the button wakes up (e.g. to read the new count). */
  onDone?: () => Promise<void>;
  className?: string;
}) {
  const t = useT();
  // `action={act}` is fine: nothing in this form (one hidden id) is lost when React resets it.
  const [result, act, pending] = useActionState(async (_: ReportActionResult, formData: FormData): Promise<ReportActionResult> => {
    try {
      const done = await meToo(formData);
      if (done?.ok) await onDone?.();
      return done;
    } catch {
      return { ok: false, error: 'common.error' }; // the request itself failed (offline)
    }
  }, null);

  if (done) {
    return (
      <p className={`flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-3 text-sm font-extrabold text-on-ink ${className}`}>
        {count === undefined ? (
          `✓ ${t('report.metoo')}` // the short form fits the narrow "Already reported nearby?" card
        ) : (
          <>
            <span aria-hidden="true">👍</span> {t('report.metooDone', { n: count })}
          </>
        )}
      </p>
    );
  }
  return (
    <form action={act} className={`grid gap-1 ${className}`}>
      <input type="hidden" name="id" value={reportId} />
      <Button variant="outline" disabled={pending} className="w-full">
        <span aria-hidden="true">👍</span> {count === undefined ? t('report.metoo') : t('report.metooCount', { n: count })}
      </Button>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
