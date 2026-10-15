'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useActionState } from 'react';
import { createGroup, type GroupActionResult } from '@/app/(app)/community/groups/actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { GROUP_CATEGORIES, GROUP_ICON } from '@/lib/domain/community';
import { useT } from '@/lib/i18n';

/** "New group": name, category, what it is about and its rules. The new group opens once created, with its maker as admin. */
export function GroupForm({ canPost }: { canPost: boolean }) {
  const t = useT();
  const router = useRouter();
  const [result, create, pending] = useActionState(async (_: GroupActionResult, formData: FormData): Promise<GroupActionResult> => {
    try {
      const done = await createGroup(formData);
      if (done?.ok) router.push(`/community/groups/${done.id}`);
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
      className="grid gap-4"
    >
      {!canPost && (
        <p className="rounded-xl bg-tint-amber px-3 py-2.5 text-sm font-bold text-amber-text">{t('common.pendingCantAct')}</p>
      )}
      <Field label={t('group.new.name')}>{(control) => <input {...control} name="name" required maxLength={60} disabled={!canPost} />}</Field>
      <Field label={t('group.new.category')}>
        {(control) => (
          <select {...control} name="category" defaultValue="family" disabled={!canPost}>
            {GROUP_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {GROUP_ICON[category]} {t(`group.category.${category}`)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={t('group.new.description')}>
        {(control) => <textarea {...control} name="description" rows={3} maxLength={500} disabled={!canPost} />}
      </Field>
      <Field label={t('group.new.rules')} hint={t('group.new.rulesHint')}>
        {(control) => <textarea {...control} name="rules" rows={4} maxLength={2000} disabled={!canPost} />}
      </Field>
      <p className="text-sm text-muted-2">{t('group.new.admin')}</p>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        // Stays off after success too, while the page moves to the new group: a second tap would make two.
        disabled={!canPost || pending || result?.ok === true}
        className="w-full"
      >
        {t('group.new.submit')}
      </Button>
    </form>
  );
}
