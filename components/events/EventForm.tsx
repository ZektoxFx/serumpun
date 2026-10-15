'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useState } from 'react';
import { createEvent, type EventActionResult } from '@/app/(app)/community/events/actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { EVENT_ICON, RESIDENT_CATEGORIES } from '@/lib/domain/events';
import { mytDate } from '@/lib/domain/time';
import { useT } from '@/lib/i18n';

/**
 * A new event. A resident's goes to its page once created; `official` is the dashboard's form for the Management
 * Office's own events (no category to pick, no points to ask: they are worth 150), which empties for the next one.
 */
export function EventForm({ official = false, canPost }: { official?: boolean; canPost: boolean }) {
  const t = useT();
  const [round, setRound] = useState(0);
  const [created, setCreated] = useState(false);
  return (
    <div className="grid gap-2">
      <EventFields
        key={round}
        official={official}
        canPost={canPost}
        onCreated={() => {
          setCreated(true);
          setRound((n) => n + 1);
        }}
        onEdit={() => setCreated(false)}
      />
      <div role="status">{created && <p className="text-sm font-bold text-green-text">{t('dashboard.events.created')}</p>}</div>
    </div>
  );
}

function EventFields({
  official,
  canPost,
  onCreated,
  onEdit,
}: {
  official: boolean;
  canPost: boolean;
  onCreated: () => void;
  onEdit: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [result, create, pending] = useActionState(async (_: EventActionResult, formData: FormData): Promise<EventActionResult> => {
    try {
      const done = await createEvent(formData);
      if (done?.ok) {
        if (official) onCreated();
        else router.push(`/community/events/${done.id}`);
      }
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form
      // Not `action={create}`: React resets a form after every action, which would wipe it when the create fails.
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => create(new FormData(event.currentTarget)));
      }}
      onChange={onEdit}
      className="grid gap-4"
    >
      {!canPost && (
        <p className="rounded-xl bg-tint-amber px-3 py-2.5 text-sm font-bold text-amber-text">{t('common.pendingCantAct')}</p>
      )}
      <Field label={t('event.new.name')}>{(control) => <input {...control} name="title" required maxLength={120} disabled={!canPost} />}</Field>
      {official ? (
        <input type="hidden" name="category" value="official" />
      ) : (
        <Field label={t('event.new.category')}>
          {(control) => (
            <select {...control} name="category" defaultValue="sports" disabled={!canPost}>
              {RESIDENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {EVENT_ICON[category]} {t(`event.category.${category}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      <Field label={t('event.new.date')}>
        {(control) => <input {...control} type="date" name="date" required min={mytDate(new Date())} disabled={!canPost} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('event.new.start')}>
          {(control) => <input {...control} type="time" name="start" required defaultValue="09:00" disabled={!canPost} />}
        </Field>
        <Field label={t('event.new.end')}>
          {(control) => <input {...control} type="time" name="end" required defaultValue="11:00" disabled={!canPost} />}
        </Field>
      </div>
      <Field label={t('event.new.place')} hint={t('event.new.placeHint')}>
        {(control) => <input {...control} name="place" required maxLength={120} disabled={!canPost} />}
      </Field>
      <Field label={t('event.new.description')}>
        {(control) => <textarea {...control} name="description" rows={3} maxLength={2000} disabled={!canPost} />}
      </Field>
      {!official && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-red-text">
          <input type="checkbox" name="askPoints" disabled={!canPost} className="mt-0.5 size-5 shrink-0 accent-red" />
          <span className="min-w-0">
            <span className="block text-sm font-bold">
              <span aria-hidden="true">★</span> {t('event.new.askPoints')}
            </span>
            <span className="block text-xs text-muted-2">{t('event.new.askPointsHint')}</span>
          </span>
        </label>
      )}
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        variant={official ? 'ink' : 'primary'}
        // A resident's stays off after success too, while the page moves to the new event: a second tap would make two.
        disabled={!canPost || pending || (!official && result?.ok === true)}
        className="w-full"
      >
        {t(official ? 'dashboard.events.create' : 'event.new.submit')}
      </Button>
    </form>
  );
}
