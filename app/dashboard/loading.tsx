import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

/** While a dashboard page loads: its title and rows, pulsing (still when motion is reduced). */
export default async function Loading() {
  const lang = await getLang();
  return (
    <div role="status" aria-label={t(lang, 'common.loading')} className="flex animate-pulse flex-col gap-3 motion-reduce:animate-none">
      <div className="h-8 w-56 rounded-lg bg-chip" />
      <div className="h-14 rounded-xl bg-chip" />
      <div className="h-14 rounded-xl bg-chip" />
      <div className="h-14 rounded-xl bg-chip" />
      <div className="h-14 rounded-xl bg-chip" />
    </div>
  );
}
