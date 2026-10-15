import type { Metadata } from 'next';
import { ResidentDecision } from '@/components/dashboard/ResidentDecision';
import { EmptyState } from '@/components/ui/EmptyState';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'dashboard.nav.residents') };
}

/** Pending sign-ups of the township, newest first, with their unit so the office can check it before approving. */
export default async function ResidentsPage() {
  await requireManagement();
  const lang = await getLang();
  const supabase = await createClient();
  // Row-level security: profiles of the office's own township; units only through profile_private's office rule.
  const { data: people, error } = await supabase
    .from('profiles')
    .select('id, full_name, neighbourhood, created_at')
    .eq('role', 'resident')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`pending residents lookup failed: ${error.message}`);
  const { data: units, error: unitError } = people.length
    ? await supabase.from('profile_private').select('id, unit_no').in('id', people.map((p) => p.id))
    : { data: [], error: null };
  if (unitError) throw new Error(`units lookup failed: ${unitError.message}`);
  const unitOf = new Map(units.map((u) => [u.id, u.unit_no]));
  const head = 'px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-muted';

  return (
    <main className="grid gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-extrabold">{t(lang, 'dashboard.nav.residents')}</h1>
      <p className="text-sm text-muted-2">{t(lang, 'dashboard.residents.intro')}</p>
      {people.length === 0 ? (
        <EmptyState icon="🪪" title={t(lang, 'dashboard.residents.empty')} description={t(lang, 'dashboard.residents.emptyHint')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className={head}>{t(lang, 'dashboard.residents.name')}</th>
                <th scope="col" className={head}>{t(lang, 'dashboard.residents.neighbourhood')}</th>
                <th scope="col" className={head}>{t(lang, 'dashboard.residents.unit')}</th>
                <th scope="col" className={head}>{t(lang, 'dashboard.residents.signedUp')}</th>
                <th scope="col" className={head}>{t(lang, 'dashboard.residents.decide')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {people.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className="px-3 py-3 font-bold">{p.full_name}</th>
                  <td className="px-3 py-3">{p.neighbourhood}</td>
                  <td className="px-3 py-3">{unitOf.get(p.id) ?? '–'}</td>
                  <td className="px-3 py-3 text-muted-2">
                    <TimeAgo date={p.created_at} />
                  </td>
                  <td className="px-3 py-2">
                    <ResidentDecision id={p.id} name={p.full_name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
