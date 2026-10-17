'use client';

import { useActionState } from 'react';
import { noteNotice, type DashboardResult } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useT } from '@/lib/i18n';

/** "Mark as noted" for one resident notice, with an optional reply the resident reads in My notices. */
export function NoticeNote({ id, name }: { id: string; name: string }) {
  const t = useT();
  // `action={note}` is fine: once noted, the page moves the notice out of this form.
  const [result, note, pending] = useActionState(async (_: DashboardResult, formData: FormData): Promise<DashboardResult> => {
    try {
      return await noteNotice(formData);
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form action={note} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <Field label={t('dashboard.notices.reply')}>{(control) => <textarea {...control} name="reply" rows={2} maxLength={500} />}</Field>
      <Button variant="ink" disabled={pending} className="self-start">
        {t('dashboard.notices.note')}
        <span className="sr-only"> {name}</span>
      </Button>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
