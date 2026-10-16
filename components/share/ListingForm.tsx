'use client';

import { useRouter } from 'next/navigation';
import { Fragment, startTransition, useActionState, useState } from 'react';
import { createListing, type ShareActionResult } from '@/app/(app)/community/share/actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { LISTING_EMOJI, type ListingKind } from '@/lib/domain/community';
import { mytDate } from '@/lib/domain/time';
import { useT } from '@/lib/i18n';

/**
 * "List an item": lend it, give it away or swap it; what it is, its condition and a picture; what a swap wants, how long
 * a lend item is there, and a group of the resident's to post it in too. The new listing opens once it is up.
 */
export function ListingForm({ canPost, groups }: { canPost: boolean; groups: { id: string; name: string }[] }) {
  const t = useT();
  const router = useRouter();
  const [kind, setKind] = useState<ListingKind>('lend');
  const [result, create, pending] = useActionState(async (_: ShareActionResult, formData: FormData): Promise<ShareActionResult> => {
    try {
      const done = await createListing(formData);
      if (done?.ok) router.push(`/community/share/${done.id}`);
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form
      // Not `action={create}`: React resets a form after every action, which would wipe it when listing fails.
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => create(new FormData(event.currentTarget)));
      }}
      className="flex flex-col gap-4"
    >
      {!canPost && (
        <p className="rounded-xl bg-tint-amber px-3 py-2.5 text-sm font-bold text-amber-text">{t('common.pendingCantAct')}</p>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-bold">{t('share.new.kind')}</p>
        <Segmented
          value={kind}
          onChange={setKind}
          label={t('share.new.kind')}
          options={[
            { value: 'lend', label: t('share.new.lend') },
            { value: 'give', label: t('share.new.give') },
            { value: 'swap', label: t('share.new.swap') },
          ]}
        />
        <input type="hidden" name="kind" value={kind} />
      </div>
      <Field label={t('share.new.title')}>{(control) => <input {...control} name="title" required maxLength={80} disabled={!canPost} />}</Field>
      <Field label={t('share.new.description')}>
        {(control) => <textarea {...control} name="description" rows={2} maxLength={500} disabled={!canPost} />}
      </Field>
      <Field label={t('share.new.emoji')}>
        {(control) => (
          <select {...control} name="emoji" defaultValue="📦" disabled={!canPost}>
            {LISTING_EMOJI.map((emoji) => (
              <option key={emoji} value={emoji}>
                {emoji}
              </option>
            ))}
          </select>
        )}
      </Field>
      {/* Keyed by kind, so a field of one kind never keeps its text as another's. */}
      {kind === 'swap' && (
        <Fragment key="swap">
          <Field label={t('share.new.swapFor')}>{(control) => <input {...control} name="swapFor" maxLength={120} disabled={!canPost} />}</Field>
        </Fragment>
      )}
      {kind === 'lend' && (
        <Fragment key="lend">
          <Field label={t('share.new.availableUntil')}>
            {(control) => <input {...control} type="date" name="availableUntil" min={mytDate(new Date())} disabled={!canPost} />}
          </Field>
        </Fragment>
      )}
      {groups.length > 0 && (
        <Field label={t('share.new.group')} hint={t('share.new.groupHint')}>
          {(control) => (
            <select {...control} name="group" defaultValue="" disabled={!canPost}>
              <option value="">{t('share.new.groupNone')}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      <p className="text-sm text-muted-2">{t('share.noSelling')}</p>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        // Stays off after success too, while the page moves to the new listing: a second tap would list it twice.
        disabled={!canPost || pending || result?.ok === true}
        className="w-full"
      >
        {t('share.new.submit')}
      </Button>
    </form>
  );
}
