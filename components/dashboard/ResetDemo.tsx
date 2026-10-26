'use client';

import { useActionState, useState } from 'react';
import { resetDemoData, type DashboardResult } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/Button';
import { Glyph } from '@/components/ui/Glyph';
import { useT } from '@/lib/i18n';

/** "Reset demo data", with one confirm step in the page (it cannot be undone). */
export function ResetDemo() {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [result, reset, pending] = useActionState(async (): Promise<DashboardResult> => {
    try {
      const done = await resetDemoData();
      if (done?.ok) setConfirming(false);
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form action={reset} className="grid justify-items-start gap-3">
      {confirming ? (
        <>
          <p className="text-base font-bold">{t('dashboard.reset.confirm')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={pending}>
              {t('dashboard.reset.yes')}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={(event) => {
            event.preventDefault(); // this click only opens the question: React reuses this button as "Yes, reset" while the click is handled, and the browser would submit it
            setConfirming(true);
          }}
        >
          <Glyph emoji="🔄" /> {t('dashboard.reset.button')}
        </Button>
      )}
      <div role="status">
        {pending ? (
          <p className="text-sm text-muted-2">{t('dashboard.reset.running')}</p>
        ) : (
          result?.ok && <p className="text-sm font-bold text-green-text">{t('dashboard.reset.done')}</p>
        )}
      </div>
      {result && !result.ok && !pending && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
    </form>
  );
}
