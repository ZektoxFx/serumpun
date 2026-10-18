import type { Metadata } from 'next';
import { NoticeNote } from '@/components/dashboard/NoticeNote';
import { EmptyState } from '@/components/ui/EmptyState';
import { Glyph } from '@/components/ui/Glyph';
import { Tag } from '@/components/ui/Tag';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { NOTICE_COLUMNS, NOTICE_ICON, noticeDates, type ResidentNotice } from '@/lib/domain/notices';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'dashboard.nav.notices') };
}

/**
 * Resident notices: renovation, moving day, events at home and contractors residents told the office about, with who
 * and which unit. The ones still to note come first; noted ones keep the reply that was sent.
 */
export default async function NoticesDashboardPage() {
  await requireManagement();
  const lang = await getLang();
  const supabase = await createClient();
  // Row-level security: the office's own township; units only through profile_private's office rule.
  const { data: notices, error } = await supabase
    .from('resident_notices')
    .select(NOTICE_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(100) // shortcut: the latest 100; add paging when a township sends more than that between visits
    .overrideTypes<ResidentNotice[], { merge: false }>();
  if (error) throw new Error(`notices lookup failed: ${error.message}`);
  const ids = [...new Set(notices.map((n) => n.user_id))];
  const [people, units] = ids.length
    ? await Promise.all([
        supabase.from('profiles').select('id, full_name, neighbourhood').in('id', ids),
        supabase.from('profile_private').select('id, unit_no').in('id', ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  for (const { error: e } of [people, units]) if (e) throw new Error(`residents lookup failed: ${e.message}`);
  const person = new Map(people.data!.map((p) => [p.id, p]));
  const unit = new Map(units.data!.map((u) => [u.id, u.unit_no]));
  const ordered = [...notices.filter((n) => n.status === 'sent'), ...notices.filter((n) => n.status === 'noted')];

  return (
    <main className="grid gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-extrabold">{t(lang, 'dashboard.nav.notices')}</h1>
      <p className="text-sm text-muted-2">{t(lang, 'dashboard.notices.intro')}</p>
      {ordered.length === 0 ? (
        <EmptyState icon="📝" title={t(lang, 'dashboard.notices.empty')} description={t(lang, 'dashboard.notices.emptyHint')} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {ordered.map((n) => {
            const who = person.get(n.user_id);
            const name = who?.full_name ?? '–';
            return (
              <li key={n.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-bold">
                    <span aria-hidden="true"><Glyph emoji={NOTICE_ICON[n.kind]} /> </span>
                    {t(lang, `notice.kind.${n.kind}`)} · {noticeDates(n.starts_on, n.ends_on, lang)}
                  </p>
                  <Tag variant={n.status === 'noted' ? 'green' : 'amber'}>{t(lang, `notice.status.${n.status}`)}</Tag>
                </div>
                <p className="text-sm">
                  <span className="font-bold">{name}</span> · {unit.get(n.user_id) ?? '–'} · {who?.neighbourhood ?? '–'} ·{' '}
                  <TimeAgo date={n.created_at} className="text-muted-2" />
                </p>
                <p className="whitespace-pre-line break-words text-sm">{n.details}</p>
                {n.status === 'sent' ? (
                  <NoticeNote id={n.id} name={name} />
                ) : (
                  n.reply && <p className="rounded-xl bg-tint-green px-3 py-2 text-sm">{t(lang, 'notice.reply', { reply: n.reply })}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
