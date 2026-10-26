import type { Metadata } from 'next';
import Link from 'next/link';
import { CardSuspension } from '@/components/dashboard/CardSuspension';
import { GiveCode } from '@/components/dashboard/GiveCode';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tag, type TagVariant } from '@/components/ui/Tag';
import { formatPhone, normalizePhone } from '@/lib/domain/phone';
import { clockTime } from '@/lib/domain/time';
import { unitState, type UnitState } from '@/lib/domain/units';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
const STATE_TAG: Record<UnitState, TagVariant> = { not_registered: 'info', code_given: 'amber', active: 'green', suspended: 'red', lease_ended: 'amber' };

/** Every home in the township: who is on record, whether its card works, and the office's Give code, Suspend and Lift. */
export default async function UnitsPage() {
  const office = await requireManagement();
  const lang = await getLang();
  const supabase = await createClient();
  const now = new Date();
  // Row-level security: the office's own township. The unit's columns are named: `record_phone` is not granted to
  // signed-in users, and a `*` is refused. A unit has at most one card, so PostgREST sends it as an object (or null).
  const [unitsRead, codesRead, phonesRead] = await Promise.all([
    supabase
      .from('units')
      .select('id, label, record_name, record_tenure, lease_end, card:cards(id, status, suspended_reason, phone_limit, phones:card_phones(count))')
      .overrideTypes<OfficeUnit[], { merge: false }>(),
    // A code is open until it is used, cancelled or runs out. The office reads when, never the code: its hash is not granted.
    supabase
      .from('card_codes')
      .select('unit_id, expires_at')
      .eq('kind', 'office')
      .is('used_at', null)
      .is('cancelled_at', null)
      .gt('expires_at', now.toISOString()),
    // The office can't read record_phone as itself: the service role does, after requireManagement and for its own township only.
    createAdminClient().from('units').select('id, record_phone').eq('township_id', office.township_id),
  ]);
  if (unitsRead.error) throw new Error(`units lookup failed: ${unitsRead.error.message}`);
  if (codesRead.error) throw new Error(`office codes lookup failed: ${codesRead.error.message}`);
  if (phonesRead.error) throw new Error(`record phones lookup failed: ${phonesRead.error.message}`);
  const codeUntil = new Map<string, string>(codesRead.data.map((c) => [c.unit_id, c.expires_at]));
  const recordPhone = new Map<string, string | null>(phonesRead.data.map((u) => [u.id, u.record_phone]));
  // "No. 3" before "No. 18", which the database's text order would not do.
  const units = unitsRead.data.toSorted((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
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
        // `relative`: the buttons' sr-only text is absolute, and without a positioned wrapper it sticks out of this one and widens a phone's page
        <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
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
                const until = codeUntil.get(unit.id) ?? null;
                const state = unitState({ ...unit, codeUntil: until }, now);
                // Only a home with no card gets a code, so only its phone goes to the browser. A number that is not a mobile one starts the field empty.
                const phone = normalizePhone(recordPhone.get(unit.id));
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
                      {!card && until && (
                        <p className="mt-1 text-muted-2">{t(lang, 'units.codeUntil', { time: clockTime(new Date(until), now, lang) })}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {card ? (
                        <CardSuspension card={card.id} unit={unit.label} suspended={card.status === 'suspended'} />
                      ) : (
                        <GiveCode
                          unit={unit.id}
                          label={unit.label}
                          record={{
                            name: unit.record_name,
                            tenure: unit.record_tenure,
                            phone: phone ? formatPhone(phone) : '',
                            leaseEnd: unit.lease_end,
                          }}
                        />
                      )}
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
