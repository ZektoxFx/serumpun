import type { Metadata } from 'next';
import { AppHeader } from '@/components/app/AppHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { t, type MessageKey } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { markAllRead, openNotification } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'notifications.title') };
}

export default async function NotificationsPage() {
  const profile = await requireMember();
  const lang = await getLang();
  const supabase = await createClient();
  // shortcut: the latest 50, no paging; add paging if a resident can really pile up more than that.
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title_key, body, read_at, created_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(`notifications lookup failed: ${error.message}`);
  const items = data ?? [];

  return (
    <>
      <AppHeader title={t(lang, 'notifications.title')} />
      <main className="grid gap-3 px-4 py-4">
        {items.length === 0 ? (
          <EmptyState icon="🔔" title={t(lang, 'notifications.empty')} description={t(lang, 'notifications.emptyHint')} />
        ) : (
          <>
            {items.some((item) => !item.read_at) && (
              <form action={markAllRead} className="justify-self-end">
                <Button variant="outline">{t(lang, 'notifications.markAll')}</Button>
              </form>
            )}
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              {items.map((item) => {
                const unread = !item.read_at;
                return (
                  // The row fills an overflow-hidden, rounded list. The global focus ring sits outside and would be clipped, so it
                  // is drawn inside, and the row takes the list's corners (the li and form pass them down) so the ring follows them.
                  <li key={item.id} className="first:rounded-t-[inherit] last:rounded-b-[inherit]">
                    <form action={openNotification} className="rounded-[inherit]">
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        className={`flex min-h-16 w-full items-start gap-3 rounded-[inherit] px-4 py-3 text-left hover:bg-soft focus-visible:outline-offset-[-2px] ${unread ? 'bg-tint-blue' : ''}`}
                      >
                        <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${unread ? 'bg-red' : ''}`} />
                        <span className="min-w-0 flex-1">
                          {unread && <span className="sr-only">{t(lang, 'notifications.unread')}: </span>}
                          {/* title_key comes from the database; t() shows an unknown key as itself. */}
                          <span className={`block text-base ${unread ? 'font-extrabold' : 'font-medium'}`}>
                            {t(lang, item.title_key as MessageKey)}
                          </span>
                          {item.body && <span className="mt-0.5 block text-sm text-muted-2">{item.body}</span>}
                          <TimeAgo date={item.created_at} className="mt-1 block text-xs text-muted" />
                        </span>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
