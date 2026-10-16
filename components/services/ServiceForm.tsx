'use client';

import { useRouter } from 'next/navigation';
import { Fragment, startTransition, useActionState, useState } from 'react';
import { createService, type ServiceActionResult } from '@/app/(app)/community/services/actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { SERVICE_CATEGORIES, SERVICE_ICON, type ServiceKind } from '@/lib/domain/community';
import { mytDate } from '@/lib/domain/time';
import { useT } from '@/lib/i18n';

/**
 * "Offer or request a service": what it is, its category and details, then a price and availability (an offer) or a
 * budget and date (a request). The Services tab opens on the new one's side once it is posted.
 */
export function ServiceForm({ canPost }: { canPost: boolean }) {
  const t = useT();
  const router = useRouter();
  const [kind, setKind] = useState<ServiceKind>('offer');
  const [result, create, pending] = useActionState(async (_: ServiceActionResult, formData: FormData): Promise<ServiceActionResult> => {
    try {
      const done = await createService(formData);
      if (done?.ok) router.push(formData.get('kind') === 'request' ? '/community?tab=services&view=requested' : '/community?tab=services');
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form
      // Not `action={create}`: React resets a form after every action, which would wipe it when the post fails.
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
        <p className="text-sm font-bold">{t('service.new.kind')}</p>
        <Segmented
          value={kind}
          onChange={setKind}
          label={t('service.new.kind')}
          options={[
            { value: 'offer', label: t('service.new.offer') },
            { value: 'request', label: t('service.new.request') },
          ]}
        />
        <input type="hidden" name="kind" value={kind} />
      </div>
      <Field label={t('service.new.category')}>
        {(control) => (
          <select {...control} name="category" defaultValue="tutoring" disabled={!canPost}>
            {SERVICE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {SERVICE_ICON[category]} {t(`service.category.${category}`)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={t('service.new.title')}>{(control) => <input {...control} name="title" required maxLength={80} disabled={!canPost} />}</Field>
      <Field label={t('service.new.description')}>
        {(control) => <textarea {...control} name="description" rows={3} maxLength={1000} disabled={!canPost} />}
      </Field>
      {/* Keyed by kind: without it React would keep a price typed in the offer's box as the request's budget. */}
      {kind === 'offer' ? (
        <Fragment key="offer">
          <Field label={t('service.new.price')} hint={t('service.new.priceHint')}>
            {(control) => <input {...control} name="price" maxLength={40} disabled={!canPost} />}
          </Field>
          <Field label={t('service.new.availability')}>
            {(control) => <input {...control} name="availability" maxLength={80} disabled={!canPost} />}
          </Field>
        </Fragment>
      ) : (
        <Fragment key="request">
          <Field label={t('service.new.budget')} hint={t('service.new.budgetHint')}>
            {(control) => <input {...control} name="budget" maxLength={40} disabled={!canPost} />}
          </Field>
          <Field label={t('service.new.neededBy')}>
            {(control) => <input {...control} type="date" name="neededBy" min={mytDate(new Date())} disabled={!canPost} />}
          </Field>
        </Fragment>
      )}
      <p className="text-sm text-muted-2">{t('service.payment')}</p>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        // Stays off after success too, while the page moves to the Services tab: a second tap would post twice.
        disabled={!canPost || pending || result?.ok === true}
        className="w-full"
      >
        {t('service.new.submit')}
      </Button>
    </form>
  );
}
