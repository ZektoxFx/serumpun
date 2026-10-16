import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

/** While a resident page loads: where its header and first cards will be, pulsing (still when motion is reduced). */
export default async function Loading() {
  const lang = await getLang();
  return (
    <div role="status" aria-label={t(lang, 'common.loading')} className="animate-pulse motion-reduce:animate-none">
      <div className="h-[68px] border-b border-line bg-surface" />
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="h-11 rounded-xl bg-chip" />
        <div className="h-28 rounded-2xl bg-chip" />
        <div className="h-28 rounded-2xl bg-chip" />
        <div className="h-28 rounded-2xl bg-chip" />
      </div>
    </div>
  );
}
