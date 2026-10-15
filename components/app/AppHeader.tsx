import Link from 'next/link';
import type { ReactNode } from 'react';
import { iconButtonClasses } from '@/components/ui/IconButton';
import { unreadBadge } from '@/lib/domain/notifications';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { getSessionProfile } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { BackButton } from './BackButton';
import { LiveBell } from './LiveBell';

/** Notifications the signed-in user has not opened. LiveBell renders the page again when they change. */
async function unreadNotifications() {
  const supabase = await createClient();
  // Row-level security limits this to the caller's own notifications.
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) {
    console.error(`unread notifications were not counted: ${error.message}`);
    return 0; // a missing badge beats a broken page
  }
  return count ?? 0;
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/**
 * The top of a resident page: a title with the bell (notifications) and inbox (messages) on the right.
 * `tone="gradient"` is Home's brand header: its title is large and bold (small text cannot sit on the gradient), and
 * `children` sits under it (put small text on a HeroChip). On the plain tone the bar stays at the top while scrolling.
 * There is no messages badge until Task 13. `back` adds "←" before the title (plain tone): it goes back, or to `back`
 * when the page was opened first.
 */
export async function AppHeader({
  title,
  back,
  showInbox = false,
  showBell = false,
  tone = 'plain',
  children,
}: {
  title?: ReactNode;
  back?: string;
  showInbox?: boolean;
  showBell?: boolean;
  tone?: 'plain' | 'gradient';
  children?: ReactNode;
}) {
  const [lang, unread, profile] = await Promise.all([
    getLang(),
    showBell ? unreadNotifications() : 0,
    showBell ? getSessionProfile() : null, // cached: the page has already looked it up
  ]);
  const badge = unreadBadge(unread);
  const gradient = tone === 'gradient';
  const buttonClass = `relative ${iconButtonClasses(gradient ? 'overlay' : 'default')}`;
  return (
    <header
      className={gradient ? 'bg-brand-gradient px-4 pb-5 pt-5 text-white' : 'sticky top-0 z-20 border-b border-line bg-surface px-4 py-3'}
    >
      <div className={`flex gap-3 ${back ? 'items-center' : 'items-start'}`}>
        {back && <BackButton fallback={back} />}
        {title && (
          <h1 className={`min-w-0 flex-1 font-extrabold leading-tight tracking-tight ${back ? 'text-lg' : 'text-2xl'}`}>{title}</h1>
        )}
        <div className="ml-auto flex shrink-0 gap-2">
          {showBell && (
            <Link
              href="/notifications"
              aria-label={badge ? t(lang, 'notifications.bellUnread', { n: unread }) : t(lang, 'notifications.title')}
              className={buttonClass}
            >
              <Glyph>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </Glyph>
              {badge && (
                <span
                  aria-hidden="true"
                  className={`absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red px-1 text-xs font-extrabold leading-none text-white ring-2 ${gradient ? 'ring-white' : 'ring-surface'}`}
                >
                  {badge}
                </span>
              )}
            </Link>
          )}
          {showBell && profile && <LiveBell userId={profile.id} />}
          {showInbox && (
            <Link href="/messages" aria-label={t(lang, 'messages.title')} className={buttonClass}>
              <Glyph>
                <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
              </Glyph>
            </Link>
          )}
        </div>
      </div>
      {children}
    </header>
  );
}
