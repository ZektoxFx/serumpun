import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/app/AppHeader';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tag } from '@/components/ui/Tag';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { NOTICE_COLUMNS, NOTICE_ICON, noticeDates, type ResidentNotice } from '@/lib/domain/notices';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'notice.mine') };
}

/** Me › My notices: what the resident told the office, newest first, each Sent or Noted with the office's reply. */
export default async function NoticesPage() {
  const profile = await requireMember();
  const lang = await getLang();
  const supabase = await createClient();
  // Row-level security: the resident's own notices only.
  const { data: notices, error } = await supabase
    .from('resident_notices')
    .select(NOTICE_COLUMNS)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .overrideTypes<ResidentNotice[], { merge: false }>();
  if (error) throw new Error(`notices lookup failed: ${error.message}`);
  const newNotice = (
    <Link href="/notices/new" className={buttonClasses('primary')}>
      <span aria-hidden="true">＋</span> {t(lang, 'notice.new')}
    </Link>
  );

  return (
    <>
      <AppHeader title={t(lang, 'notice.mine')} back="/me" />
      <main className="flex flex-col gap-3 px-4 py-4">
        {notices.length === 0 ? (
          <EmptyState icon="📝" title={t(lang, 'notice.empty')} description={t(lang, 'notice.emptyHint')} action={newNotice} />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {notices.map((n) => (
                <li key={n.id} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-3.5 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold">
                      <span aria-hidden="true">{NOTICE_ICON[n.kind]} </span>
                      {t(lang, `notice.kind.${n.kind}`)}
                    </p>
                    <Tag variant={n.status === 'noted' ? 'green' : 'info'} className="shrink-0">
                      {t(lang, `notice.status.${n.status}`)}
                    </Tag>
                  </div>
                  <p className="text-sm font-semibold">{noticeDates(n.starts_on, n.ends_on, lang)}</p>
                  <p className="whitespace-pre-line break-words text-sm text-muted-2">{n.details}</p>
                  {n.reply && <p className="rounded-xl bg-tint-green px-3 py-2 text-sm">{t(lang, 'notice.reply', { reply: n.reply })}</p>}
                  <TimeAgo date={n.created_at} className="text-xs text-muted-2" />
                </li>
              ))}
            </ul>
            {newNotice}
          </>
        )}
      </main>
    </>
  );
}
