import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

/**
 * Home's "Happening now": the nearest active alert, the latest announcement and the next event. Task 17 passes the
 * three cards in; until then it says all is quiet.
 */
export async function HappeningNow({
  alert,
  announcement,
  event,
}: {
  alert?: ReactNode;
  announcement?: ReactNode;
  event?: ReactNode;
}) {
  const lang = await getLang();
  return (
    <section aria-labelledby="happening-now" className="grid gap-2">
      <h2 id="happening-now" className="px-1 text-xs font-extrabold uppercase tracking-wide text-muted">
        {t(lang, 'home.happening')}
      </h2>
      {alert}
      {announcement}
      {event}
      {!alert && !announcement && !event && (
        <EmptyState icon="🌿" title={t(lang, 'home.happening.empty')} description={t(lang, 'home.happening.emptyHint')} />
      )}
    </section>
  );
}
