'use client';

import { useActionState, useState } from 'react';
import { rateService, type ServiceActionResult } from '@/app/(app)/community/services/actions';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useT } from '@/lib/i18n';

const STARS = [1, 2, 3, 4, 5] as const;
const STAR_PATH = 'M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z';

/**
 * In a conversation about an offer, for the client: "How was Cikgu Farah's service?" and Rate, or the stars they gave
 * and Change. Both open the rate sheet. The database checks again that they talked to the provider about it.
 */
export function RateService({ serviceId, name, rating, canAct }: { serviceId: string; name: string; rating: number | null; canAct: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
      {rating === null ? (
        <p className="text-sm font-bold">{t('service.rate.ask', { name })}</p>
      ) : (
        <p className="text-sm">
          <span className="text-muted-2">{t('service.rate.yours')}: </span>
          <span aria-hidden="true">{'⭐'.repeat(rating)}</span>
          <span className="sr-only">{t(rating === 1 ? 'service.rate.starOne' : 'service.rate.starMany', { n: rating })}</span>
        </p>
      )}
      <Button type="button" variant={rating === null ? 'ink' : 'outline'} disabled={!canAct} onClick={() => setOpen(true)}>
        {rating === null ? (
          <>
            <span aria-hidden="true">⭐</span> {t('service.rate.cta')}
          </>
        ) : (
          t('service.rate.change')
        )}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('service.rate.title', { name })}>
        <RateForm serviceId={serviceId} initial={rating} onDone={() => setOpen(false)} />
      </Sheet>
    </div>
  );
}

/** Five stars (a radio group, so arrow keys work) and Save. Mounted on every opening, so no old error stays. */
function RateForm({ serviceId, initial, onDone }: { serviceId: string; initial: number | null; onDone: () => void }) {
  const t = useT();
  const [stars, setStars] = useState(initial ?? 0);
  const [result, rate, pending] = useActionState(async (_: ServiceActionResult, formData: FormData): Promise<ServiceActionResult> => {
    try {
      const done = await rateService(formData);
      if (done?.ok) onDone();
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form action={rate} className="flex flex-col gap-4 pt-1">
      <input type="hidden" name="id" value={serviceId} />
      <fieldset className="flex justify-center gap-1">
        <legend className="sr-only">{t('service.rate.stars')}</legend>
        {STARS.map((n) => (
          <label
            key={n}
            className="grid size-14 cursor-pointer place-items-center rounded-xl has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-red-text"
          >
            <input type="radio" name="rating" value={n} checked={stars === n} onChange={() => setStars(n)} className="sr-only" />
            {/* An outline when off, amber when on: both keep 3:1 against the sheet in light and dark. */}
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              strokeWidth={1.5}
              strokeLinejoin="round"
              className={`size-10 ${n <= stars ? 'fill-amber stroke-amber-text' : 'fill-none stroke-muted'}`}
            >
              <path d={STAR_PATH} />
            </svg>
            <span className="sr-only">{t(n === 1 ? 'service.rate.starOne' : 'service.rate.starMany', { n })}</span>
          </label>
        ))}
      </fieldset>
      <p className="text-center text-sm text-muted-2">{t('service.rate.hint')}</p>
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={stars === 0 || pending || result?.ok === true} className="w-full">
        {t('service.rate.submit')}
      </Button>
    </form>
  );
}
