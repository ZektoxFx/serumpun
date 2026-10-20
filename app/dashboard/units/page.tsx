import type { Metadata } from 'next';
import Link from 'next/link';
import { CardSuspension } from '@/components/dashboard/CardSuspension';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tag, type TagVariant } from '@/components/ui/Tag';
import { unitState, type UnitState } from '@/lib/domain/units';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'dashboard.nav.units') };
}

type OfficeUnit = {
  id: string;
  label: string;
  record_name: string;
  record_tenure: 'owner' | 'tenant';
  lease_end: string | null;
  card: { id: string; status: 'active' | 'suspended'; suspended_reason: string | null; phone_limit: number; phones: { count: number }[] } | null;
};

// Words carry the state; the colour only helps.
const STATE_TAG: Record<UnitState, TagVariant> = { not_registered: 'info', active: 'green', suspended: 'red', lease_ended: 'amber' };

/** Every home in the township: who is on record, whether its card works, and the office's Suspend and Lift. */
export default async function UnitsPage() {
  await requireManagement();
  const lang = await getLang();
  const supabase = await createClient();
  // Row-level security: the office's own township. The unit's columns are named: `record_phone` is not granted to
  // signed-in users, and a `*` is refused. A unit has at most one card, so PostgREST sends it as an object (or null).
  const { data, error } = await supabase
    .from('units')
    .select('id, label, record_name, record_tenure, lease_end, card:cards(id, status, suspended_reason, phone_limit, phones:card_phones(count))')
    .overrideTypes<OfficeUnit[], { merge: false }>();
  if (error) throw new Error(`units lookup failed: ${error.message}`);
  const now = new Date();
  // "No. 3" before "No. 18", which the database's text order would not do.
  const units = data.toSorted((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
  const head = 'px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-muted';

  return (
    <main className="grid gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t(lang, 'dashboard.nav.units')}</h1>
        <Link href="/reader" className={buttonClasses('outline')}>
          {t(lang, 'units.openReader')}
        </Link>
      </div>
      <p className="text-sm text-muted-2">{t(lang, 'units.intro')}</p>
      {units.length === 0 ? (
        <EmptyState icon="🏘️" title={t(lang, 'units.empty')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className={head}>{t(lang, 'units.col.unit')}</th>
                <th scope="col" className={head}>{t(lang, 'units.col.record')}</th>
                <th scope="col" className={head}>{t(lang, 'units.col.card')}</th>
                <th scope="col" className={head}>{t(lang, 'units.col.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {units.map((unit) => {
                const { card } = unit;
                const state = unitState(unit, now);
                return (
                  <tr key={unit.id}>
                    <th scope="row" className="px-3 py-3 font-bold">{unit.label}</th>
                    <td className="px-3 py-3">
                      {unit.record_name} · {t(lang, `units.tenure.${unit.record_tenure}`)}
                    </td>
                    <td className="px-3 py-3">
                      <Tag variant={STATE_TAG[state]}>{t(lang, `units.state.${state}`)}</Tag>
                      {card && (
                        <p className="mt-1 break-words text-muted-2">
                          {card.status === 'suspended'
                            ? card.suspended_reason
                            : t(lang, 'units.phones', { n: card.phones[0]?.count ?? 0, max: card.phone_limit })}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {card && <CardSuspension card={card.id} unit={unit.label} suspended={card.status === 'suspended'} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
