import Link from 'next/link';
import { JoinButton } from '@/components/groups/JoinButton';
import { GROUP_ICON_TINT, GROUP_TILE } from '@/components/groups/groupStyle';
import { initials } from '@/components/ui/Avatar';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { GROUP_ICON, PUBLIC_GROUP_COLUMNS, newSince, type PublicGroup } from '@/lib/domain/community';
import { mytDate, timeAgo } from '@/lib/domain/time';
import { totalUnread, type PublicTopic } from '@/lib/domain/topics';
import { t, type Lang } from '@/lib/i18n';
import type { SessionProfile } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * Community › Groups (canvas "Community tabs › Groups"): the resident's groups, each with "N new" since their last visit
 * or else the time of its latest post, and the township's other groups to join.
 */
export async function GroupsTab({ profile, lang }: { profile: SessionProfile; lang: Lang }) {
  const supabase = await createClient();
  const { data: groups, error } = await supabase
    .from('public_groups')
    .select(PUBLIC_GROUP_COLUMNS)
    .order('name')
    .overrideTypes<PublicGroup[], { merge: false }>();
  if (error) throw new Error(`groups lookup failed: ${error.message}`);
  // General chat is pinned on its own above the resident's other groups; everyone in the township reads its topics.
  const generalChat = groups.find((g) => g.is_general);
  const mine = groups.filter((g) => g.is_member && !g.is_general);
  const others = groups.filter((g) => !g.is_member && !g.is_general);
  // shortcut: every post of the resident's groups, to count the new ones; fetch only those since the last visits once groups have hundreds.
  const [{ data: posts, error: postsError }, { data: topics, error: topicsError }] = await Promise.all([
    mine.length
      ? supabase
          .from('public_posts')
          .select('group_id, created_at, is_mine')
          .in('group_id', mine.map((g) => g.id))
          .order('created_at', { ascending: false })
      : { data: [], error: null },
    generalChat
      ? supabase.from('public_topics').select('unread_count, last_at').overrideTypes<Pick<PublicTopic, 'unread_count' | 'last_at'>[], { merge: false }>()
      : { data: [], error: null },
  ]);
  if (postsError) throw new Error(`group posts lookup failed: ${postsError.message}`);
  if (topicsError) throw new Error(`General chat topics lookup failed: ${topicsError.message}`);
  const now = new Date();
  const canAct = profile.status === 'verified';
  // Each group with its posts (newest first) and how many are new to the resident.
  const news = (g: PublicGroup) => {
    const own = posts.filter((p) => p.group_id === g.id);
    return { g, latest: own[0]?.created_at ?? null, fresh: newSince(own.filter((p) => !p.is_mine), g.last_visit_at) };
  };
  // Those with news first, then by their latest post.
  const yours = mine
    .map(news)
    .sort((a, b) => Number(b.fresh > 0) - Number(a.fresh > 0) || Date.parse(b.latest ?? '0') - Date.parse(a.latest ?? '0'));
  // General chat's "N new" is every unread message across its topics; its time is the latest message in any of them.
  const unread = totalUnread(topics);
  const latest = topics.reduce<string | null>((max, x) => (x.last_at && (!max || Date.parse(x.last_at) > Date.parse(max)) ? x.last_at : max), null);

  return (
    <main className="grid gap-3 px-4 py-4">
      {generalChat && (
        <Link
          href="/community/general"
          className="mb-2 flex items-center gap-3 rounded-2xl border-2 border-red/70 bg-surface p-3.5 shadow-card hover:bg-soft"
        >
          <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-[16px] bg-brand-gradient text-2xl">
            💬
          </span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="break-words text-lg font-bold leading-snug">{t(lang, 'general.title')}</span>
            <span className="truncate text-sm text-muted-2">
              {t(lang, 'group.general.everyone', { township: profile.township.name })} · {generalChat.description}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            {latest && <span className="text-xs font-semibold text-muted-2">{timeAgo(new Date(latest), now, lang)}</span>}
            {unread > 0 && (
              <span className="grid min-w-6 place-items-center rounded-full bg-red px-1.5 py-0.5 text-xs font-extrabold text-white">
                {unread}
                <span className="sr-only"> {t(lang, 'group.new', { n: unread })}</span>
              </span>
            )}
          </span>
        </Link>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-extrabold">{t(lang, 'group.yours')}</h2>
        <span className="text-sm font-semibold text-muted-2">{t(lang, 'group.joinedCount', { n: mine.length })}</span>
      </div>
      {mine.length === 0 ? (
        <EmptyState icon="👥" title={t(lang, 'group.mine.empty')} description={t(lang, 'group.mine.emptyHint')} />
      ) : (
        <ul className="grid gap-2">
          {yours.map(({ g, latest, fresh }) => {
            const joinedToday = g.joined_at !== null && mytDate(new Date(g.joined_at)) === mytDate(now);
            return (
              <li key={g.id}>
                <Link
                  href={`/community/groups/${g.id}`}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 ${fresh > 0 ? 'border-orange/30 bg-tint-orange' : 'border-line bg-surface shadow-card hover:bg-soft'}`}
                >
                  <span aria-hidden="true" className={`grid size-12 shrink-0 place-items-center rounded-[14px] text-base font-extrabold ${GROUP_TILE[g.colour]}`}>
                    {initials(g.name)}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="break-words font-bold leading-snug">{g.name}</span>
                    <span className="truncate text-sm text-muted-2">
                      {t(lang, 'group.members', { n: g.member_count })} · {joinedToday ? t(lang, 'group.joinedToday') : g.description}
                    </span>
                  </span>
                  {fresh > 0 ? (
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-red px-2.5 py-1 text-xs font-extrabold text-white">
                      {t(lang, 'group.new', { n: fresh })}
                    </span>
                  ) : (
                    latest && <span className="shrink-0 text-xs font-semibold text-muted-2">{timeAgo(new Date(latest), now, lang)}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-3 text-lg font-extrabold">{t(lang, 'group.discover')}</h2>
      {others.length === 0 ? (
        <p className="text-sm text-muted-2">{t(lang, 'group.discover.empty')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {others.map((g) => (
            <li key={g.id} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-3.5 shadow-card">
              <span aria-hidden="true" className={`grid size-10 place-items-center rounded-xl text-xl ${GROUP_ICON_TINT[g.category]}`}>
                {GROUP_ICON[g.category]}
              </span>
              <Link href={`/community/groups/${g.id}`} className="mt-1.5 break-words font-bold leading-snug underline-offset-2 hover:underline">
                {g.name}
              </Link>
              <span className="text-sm text-muted-2">
                {t(lang, `group.category.${g.category}`)} · {t(lang, 'group.members', { n: g.member_count })}
              </span>
              <div className="mt-auto pt-2">
                <JoinButton groupId={g.id} name={g.name} canAct={canAct} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link href="/community/groups/new" className={`${buttonClasses('outline')} mt-1`}>
        <span aria-hidden="true">＋</span> {t(lang, 'group.create')}
      </Link>
    </main>
  );
}
