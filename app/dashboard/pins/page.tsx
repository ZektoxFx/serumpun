import type { Metadata } from 'next';
import { PinForm, RemovePinButton } from '@/components/dashboard/PinForm';
import { SEVERITY_TAG } from '@/components/map/severityTag';
import { EmptyState } from '@/components/ui/EmptyState';
import { Glyph } from '@/components/ui/Glyph';
import { Tag } from '@/components/ui/Tag';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { ALERT_ICON, PUBLIC_ALERT_COLUMNS, type PublicAlert } from '@/lib/domain/alerts';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'dashboard.nav.pins') };
}

/** Official pins (road works, water cuts…): add one where the map's pin sits, or take one off the map. */
export default async function PinsPage() {
  const profile = await requireManagement();
  const lang = await getLang();
  const supabase = await createClient();
  const { data: pins, error } = await supabase
    .from('public_alerts')
    .select(PUBLIC_ALERT_COLUMNS)
    .eq('is_official', true)
    .order('created_at', { ascending: false })
    .overrideTypes<PublicAlert[], { merge: false }>();
  if (error) throw new Error(`official pins lookup failed: ${error.message}`);

  return (
    <main className="grid gap-6 p-4 sm:p-6 xl:grid-cols-2 xl:items-start">
      <h1 className="text-2xl font-extrabold xl:col-span-2">{t(lang, 'dashboard.nav.pins')}</h1>
      <section aria-labelledby="new-pin" className="grid min-w-0 gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <h2 id="new-pin" className="text-base font-extrabold">
          {t(lang, 'dashboard.pins.new')}
        </h2>
        <PinForm centre={{ lat: profile.township.centre_lat, lng: profile.township.centre_lng }} />
      </section>
      <section aria-labelledby="active-pins" className="grid min-w-0 gap-3">
        <h2 id="active-pins" className="text-base font-extrabold">
          {t(lang, 'dashboard.pins.active')}
        </h2>
        {pins.length === 0 ? (
          <EmptyState icon="📍" title={t(lang, 'dashboard.pins.empty')} />
        ) : (
          <ul className="grid gap-2">
            {pins.map((pin) => {
              const type = t(lang, `alert.type.${pin.type}`);
              return (
                <li key={pin.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
                  <span aria-hidden="true" className="text-2xl">
                    <Glyph emoji={ALERT_ICON[pin.type]} />
                  </span>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <p className="flex flex-wrap items-center gap-2 font-extrabold">
                      {type}
                      <Tag variant={SEVERITY_TAG[pin.severity]}>{t(lang, `severity.${pin.severity}`)}</Tag>
                    </p>
                    {pin.note && <p className="break-words text-sm">{pin.note}</p>}
                    <TimeAgo date={pin.created_at} className="text-xs text-muted-2" />
                  </div>
                  <RemovePinButton id={pin.id} label={t(lang, 'dashboard.pins.removeLabel', { type })} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
