import type { Metadata } from 'next';
import { AnnouncementForm } from '@/components/dashboard/AnnouncementForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'dashboard.nav.announcements') };
}

/** Post an announcement to every resident (each gets a notification), and the latest ones posted. */
export default async function AnnouncementsPage() {
  await requireManagement();
  const lang = await getLang();
  const supabase = await createClient();
  const { data: posted, error } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(`announcements lookup failed: ${error.message}`);

  return (
    <main className="grid max-w-3xl gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-extrabold">{t(lang, 'dashboard.nav.announcements')}</h1>
      <section aria-labelledby="new-announcement" className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <h2 id="new-announcement" className="text-base font-extrabold">
          {t(lang, 'dashboard.announcements.new')}
        </h2>
        <AnnouncementForm />
      </section>
      <section aria-labelledby="recent-announcements" className="grid gap-3">
        <h2 id="recent-announcements" className="text-base font-extrabold">
          {t(lang, 'dashboard.announcements.recent')}
        </h2>
        {posted.length === 0 ? (
          <EmptyState icon="📢" title={t(lang, 'dashboard.announcements.empty')} />
        ) : (
          <ul className="grid gap-2">
            {posted.map((a) => (
              <li key={a.id} className="grid gap-1 rounded-2xl border border-line bg-surface p-4 shadow-card">
                <p className="break-words font-extrabold">{a.title}</p>
                <p className="whitespace-pre-line break-words text-sm">{a.body}</p>
                <TimeAgo date={a.created_at} className="text-xs text-muted-2" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
