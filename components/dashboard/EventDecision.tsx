'use client';

import { useActionState } from 'react';
import { decideEvent, type DashboardResult } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { DEFAULT_POINTS } from '@/lib/domain/events';
import { useT } from '@/lib/i18n';

/**
 * Approve (with points, 100 by default) or Reject one resident event that asked for points. No confirm step: a turned
 * down organiser can simply ask again.
 */
export function EventDecision({ id, title }: { id: string; title: string }) {
  const t = useT();
  const [result, decide, pending] = useActionState(async (_: DashboardResult, formData: FormData): Promise<DashboardResult> => {
    try {
      return await decideEvent(formData);
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);
  const what = <span className="sr-only"> {title}</span>; // screen readers hear which event each button decides

  return (
    <form action={decide} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="w-32">
        <Field label={t('dashboard.events.points')}>
          {(control) => <input {...control} type="number" name="points" required min={1} max={1000} step={1} defaultValue={DEFAULT_POINTS.resident} />}
        </Field>
      </div>
      <Button name="decision" value="approve" variant="ink" disabled={pending}>
        {t('dashboard.events.approve')}
        {what}
      </Button>
      <Button name="decision" value="reject" variant="outline" disabled={pending}>
        {t('dashboard.events.reject')}
        {what}
      </Button>
      {result && !result.ok && (
        <p role="alert" className="w-full text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
