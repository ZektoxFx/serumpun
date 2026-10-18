import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Glyph';
import { iconButtonClasses } from '@/components/ui/IconButton';
import { unreadBadge } from '@/lib/domain/notifications';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { getSessionProfile } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { BackButton } from './BackButton';
import { LiveBell } from './LiveBell';
import { LiveMessages } from './LiveMessages';

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

/** The other people's messages the signed-in user has not read. LiveMessages renders the page again on a new one. */
async function unreadMessages() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('unread_message_count');
  if (error) {
    console.error(`unread messages were not counted: ${error.message}`);
    return 0; // a missing badge beats a broken page
  }
  return Number(data ?? 0);
}

/** The red count on the bell or the inbox. Hidden from screen readers: the button's own label says the number. */
function CountBadge({ text, gradient }: { text: string; gradient: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red px-1 text-xs font-extrabold leading-none text-white ring-2 ${gradient ? 'ring-white' : 'ring-surface'}`}
    >
      {text}
    </span>
  );
}

/**
 * The top of a resident page: a title with the bell (notifications) and inbox (messages) on the right, each with its
 * unread count, kept live. `tone="gradient"` is Home's brand header: its title is large and bold (small text cannot sit
 * on the gradient), and `children` sits under it (put small text on a HeroChip). On the plain tone the bar stays at the
 * top while scrolling. `back` adds "←" before the title (plain tone): it goes back, or to `back` when the page was
 * opened first.
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
  const [lang, unread, profile, unreadChats] = await Promise.all([
    getLang(),
    showBell ? unreadNotifications() : 0,
    showBell ? getSessionProfile() : null, // cached: the page has already looked it up
    showInbox ? unreadMessages() : 0,
  ]);
  const badge = unreadBadge(unread);
  const inboxBadge = unreadBadge(unreadChats);
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
              <Icon name="bell" className="size-5" />
              {badge && <CountBadge text={badge} gradient={gradient} />}
            </Link>
          )}
          {showBell && profile && <LiveBell userId={profile.id} />}
          {showInbox && (
            <Link
              href="/messages"
              aria-label={inboxBadge ? t(lang, 'messages.inboxUnread', { n: unreadChats }) : t(lang, 'messages.title')}
              className={buttonClass}
            >
              <Icon name="message" className="size-5" />
              {inboxBadge && <CountBadge text={inboxBadge} gradient={gradient} />}
            </Link>
          )}
          {showInbox && <LiveMessages />}
        </div>
      </div>
      {children}
    </header>
  );
}
