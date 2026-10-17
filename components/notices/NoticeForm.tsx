'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useState } from 'react';
import { submitNotice, type NoticeActionResult } from '@/app/(app)/notices/actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { NOTICE_ICON, NOTICE_KINDS, type NoticeKind } from '@/lib/domain/notices';
import { mytDate } from '@/lib/domain/time';
import { useT } from '@/lib/i18n';

/** Notify the office: what it is about, from and until when, and the details. Sent notices open My notices. */
export function NoticeForm({ canPost }: { canPost: boolean }) {
  const t = useT();
  const router = useRouter();
  const today = mytDate(new Date());
  const [kind, setKind] = useState<NoticeKind>('renovation');
  const [from, setFrom] = useState(today);
  const [result, send, pending] = useActionState(async (_: NoticeActionResult, formData: FormData): Promise<NoticeActionResult> => {
    try {
      const done = await submitNotice(formData);
      if (done?.ok) router.push('/notices');
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form
      // Not `action={send}`: React resets a form after every action, which would wipe it when sending fails.
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => send(new FormData(event.currentTarget)));
      }}
      className="flex flex-col gap-4"
    >
      {!canPost && <p className="rounded-xl bg-tint-amber px-3 py-2.5 text-sm font-bold text-amber-text">{t('common.pendingCantAct')}</p>}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-bold">{t('notice.kind')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {NOTICE_KINDS.map((k) => (
            <label
              key={k}
              className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 border-line bg-surface px-3 py-2 text-sm font-bold has-checked:border-red has-checked:bg-tint-red has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-red-text"
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} disabled={!canPost} className="sr-only" />
              <span aria-hidden="true" className="text-lg">
                {NOTICE_ICON[k]}
              </span>
              {t(`notice.kind.${k}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('notice.from')}>
          {(control) => (
            <input {...control} type="date" name="from" required min={today} value={from} onChange={(e) => setFrom(e.target.value)} disabled={!canPost} />
          )}
        </Field>
        <Field label={t('notice.to')}>
          {(control) => <input {...control} type="date" name="to" required min={from} defaultValue={today} disabled={!canPost} />}
        </Field>
      </div>
      <Field label={t('notice.details')} hint={t('notice.detailsHint')}>
        {(control) => <textarea {...control} name="details" required rows={4} maxLength={1000} disabled={!canPost} />}
      </Field>
      <p className="text-sm text-muted-2">
        <span aria-hidden="true">🔒 </span>
        {t('notice.private')}
      </p>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        // Stays off after success too, while the page moves to My notices: a second tap would send it twice.
        disabled={!canPost || pending || result?.ok === true}
        className="w-full"
      >
        {t('notice.submit')}
      </Button>
    </form>
  );
}
