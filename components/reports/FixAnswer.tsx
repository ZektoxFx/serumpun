'use client';

import { useActionState } from 'react';
import { answerFix, type ReportActionResult } from '@/app/(app)/reports/actions';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';

/** "Is it fixed?" on a resolved report, for its reporter and the Me-too neighbours. They can change their answer. */
export function FixAnswer({ reportId }: { reportId: string }) {
  const t = useT();
  const [result, act, pending] = useActionState(async (_: ReportActionResult, formData: FormData): Promise<ReportActionResult> => {
    try {
      return await answerFix(formData);
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form action={act} className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <p className="text-base font-extrabold">{t('report.fixedAsk')}</p>
      <input type="hidden" name="id" value={reportId} />
      <div className="grid grid-cols-2 gap-2">
        <Button name="fixed" value="yes" variant="ink" disabled={pending}>
          <span aria-hidden="true">✓</span> {t('report.fixedYes')}
        </Button>
        <Button name="fixed" value="no" variant="outline" disabled={pending}>
          <span aria-hidden="true">✗</span> {t('report.fixedNo')}
        </Button>
      </div>
      <div role="status">{result?.ok && <p className="text-sm text-muted-2">{t('report.fixedSaved')}</p>}</div>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
