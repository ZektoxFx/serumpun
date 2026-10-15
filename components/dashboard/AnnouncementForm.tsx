'use client';

import { startTransition, useActionState, useState } from 'react';
import { postAnnouncement, type DashboardResult } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useT } from '@/lib/i18n';

/** "New announcement": a title and a message for every resident. The form empties after each post. */
export function AnnouncementForm() {
  const t = useT();
  const [round, setRound] = useState(0);
  const [posted, setPosted] = useState(false);
  return (
    <div className="grid gap-2">
      <AnnouncementFields
        key={round}
        onPosted={() => {
          setPosted(true);
          setRound((n) => n + 1);
        }}
        onEdit={() => setPosted(false)}
      />
      <div role="status">{posted && <p className="text-sm font-bold text-green-text">{t('dashboard.announcements.posted')}</p>}</div>
    </div>
  );
}

function AnnouncementFields({ onPosted, onEdit }: { onPosted: () => void; onEdit: () => void }) {
  const t = useT();
  const [result, post, pending] = useActionState(async (_: DashboardResult, formData: FormData): Promise<DashboardResult> => {
    try {
      const done = await postAnnouncement(formData);
      if (done?.ok) onPosted();
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);
  return (
    <form
      // Not `action={post}`: React resets a form after every action, which would wipe the text when a post fails.
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => post(new FormData(event.currentTarget)));
      }}
      onChange={onEdit}
      className="grid gap-3"
    >
      <Field label={t('dashboard.announcements.heading')}>
        {(control) => <input {...control} name="title" required maxLength={120} />}
      </Field>
      <Field label={t('dashboard.announcements.body')}>
        {(control) => <textarea {...control} name="body" required rows={4} maxLength={2000} />}
      </Field>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
      <Button type="submit" variant="ink" disabled={pending} className="justify-self-start">
        {t('dashboard.announcements.post')}
      </Button>
    </form>
  );
}
