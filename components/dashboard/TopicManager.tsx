'use client';

import Link from 'next/link';
import { startTransition, useActionState, useId, useState } from 'react';
import { createTopic, removeTopic, updateTopic, type DashboardResult } from '@/app/dashboard/actions';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { Tag } from '@/components/ui/Tag';
import type { PublicTopic } from '@/lib/domain/topics';
import { useT } from '@/lib/i18n';

type Topic = Pick<PublicTopic, 'id' | 'emoji' | 'title' | 'office_only' | 'system_key'>;

/** A dashboard action for useActionState: a thrown error becomes common.error, and `onDone` runs once it worked. */
function run(action: (formData: FormData) => Promise<DashboardResult>, onDone?: () => void) {
  return async (_: DashboardResult, formData: FormData): Promise<DashboardResult> => {
    try {
      const done = await action(formData);
      if (done?.ok) onDone?.();
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    }
  };
}

function Failed({ result }: { result: DashboardResult }) {
  const t = useT();
  return result && !result.ok ? (
    <p role="alert" className="text-sm font-bold text-red-text">
      {t(result.error)}
    </p>
  ) : null;
}

/** Emoji, name and office-only, for a new topic or one being edited. Announcements stays office-only. */
function TopicFields({ topic }: { topic?: Topic }) {
  const t = useT();
  const labelId = useId();
  const system = topic?.system_key === 'announcements';
  const [officeOnly, setOfficeOnly] = useState(topic?.office_only ?? false);
  return (
    <>
      <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
        <Field label={t('dashboard.general.emoji')}>
          {(control) => <input {...control} name="emoji" defaultValue={topic?.emoji ?? '💬'} required maxLength={8} />}
        </Field>
        <Field label={t('dashboard.general.name')}>
          {(control) => <input {...control} name="title" defaultValue={topic?.title} required maxLength={40} />}
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span id={labelId} className="text-sm font-bold">
          {t('dashboard.general.officeOnly')}
        </span>
        <Switch checked={system || officeOnly} onChange={setOfficeOnly} disabled={system} aria-labelledby={labelId} />
        <input type="hidden" name="office_only" value={system || officeOnly ? 'on' : ''} />
      </div>
    </>
  );
}

/** "New topic": it goes last in General chat. The form empties after each topic. */
export function NewTopicForm() {
  const t = useT();
  const [round, setRound] = useState(0);
  const [added, setAdded] = useState(false);
  const [result, add, pending] = useActionState(
    run(createTopic, () => {
      setAdded(true);
      setRound((n) => n + 1);
    }),
    null,
  );
  return (
    <form
      key={round}
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => add(new FormData(event.currentTarget)));
      }}
      onChange={() => setAdded(false)}
      className="grid gap-3"
    >
      <TopicFields />
      <Failed result={result} />
      <Button type="submit" variant="ink" disabled={pending} className="justify-self-start">
        {t('dashboard.general.add')}
      </Button>
      <div role="status">{added && <p className="text-sm font-bold text-green-text">{t('dashboard.general.added')}</p>}</div>
    </form>
  );
}

/** "Remove", then a confirm step in place: residents stop seeing the topic (its messages are kept). */
function RemoveTopic({ topic }: { topic: Topic }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [result, remove, pending] = useActionState(run(removeTopic), null);
  if (!confirming) {
    return (
      <Button variant="outline" onClick={() => setConfirming(true)} aria-label={t('dashboard.general.removeLabel', { topic: topic.title })}>
        {t('dashboard.general.remove')}
      </Button>
    );
  }
  return (
    <form action={remove} className="grid w-full gap-2">
      <input type="hidden" name="id" value={topic.id} />
      <p className="text-sm font-bold">{t('dashboard.general.removeConfirm', { topic: topic.title })}</p>
      <div className="flex gap-2">
        <Button variant="ink" disabled={pending}>
          {t('dashboard.general.remove')}
        </Button>
        <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
          {t('common.cancel')}
        </Button>
      </div>
      <Failed result={result} />
    </form>
  );
}

/** One topic on the list: open it in the app, edit it in place, or remove it (never Announcements). */
function TopicRow({ topic }: { topic: Topic }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [result, save, pending] = useActionState(
    run(updateTopic, () => setEditing(false)),
    null,
  );
  const system = topic.system_key === 'announcements';

  if (editing) {
    return (
      <li className="rounded-2xl border border-line bg-surface p-4 shadow-card">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(() => save(new FormData(event.currentTarget)));
          }}
          className="grid gap-3"
        >
          <input type="hidden" name="id" value={topic.id} />
          <TopicFields topic={topic} />
          <Failed result={result} />
          <div className="flex gap-2">
            <Button type="submit" variant="ink" disabled={pending}>
              {t('common.save')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-tint-amber text-xl">
        {topic.emoji}
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="flex flex-wrap items-center gap-2 break-words font-extrabold">
          {topic.title}
          {topic.office_only && <Tag variant="amber">🔒 {t('general.officeOnly')}</Tag>}
        </p>
        {system && <p className="text-sm text-muted-2">{t('dashboard.general.mirrors')}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/community/general/${topic.id}`}
          aria-label={t('dashboard.general.openLabel', { topic: topic.title })}
          className={buttonClasses('outline')}
        >
          {t('dashboard.general.open')}
        </Link>
        <Button variant="outline" onClick={() => setEditing(true)} aria-label={t('dashboard.general.editLabel', { topic: topic.title })}>
          {t('dashboard.general.edit')}
        </Button>
        {!system && <RemoveTopic topic={topic} />}
      </div>
    </li>
  );
}

/** Dashboard › General chat's list of topics. */
export function TopicManager({ topics }: { topics: Topic[] }) {
  return (
    <ul className="grid gap-2">
      {topics.map((topic) => (
        <TopicRow key={topic.id} topic={topic} />
      ))}
    </ul>
  );
}
