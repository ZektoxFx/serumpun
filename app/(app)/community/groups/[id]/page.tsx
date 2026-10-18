import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { AppHeader } from '@/components/app/AppHeader';
import { JoinButton } from '@/components/groups/JoinButton';
import { MarkVisited } from '@/components/groups/MarkVisited';
import { PostCard, type PostListing } from '@/components/groups/PostCard';
import { PostComposer } from '@/components/groups/PostComposer';
import { GROUP_TILE } from '@/components/groups/groupStyle';
import { Avatar, initials } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Glyph } from '@/components/ui/Glyph';
import { Tag } from '@/components/ui/Tag';
import {
  PUBLIC_COMMENT_COLUMNS,
  PUBLIC_GROUP_COLUMNS,
  PUBLIC_POST_COLUMNS,
  type PublicComment,
  type PublicGroup,
  type PublicPost,
} from '@/lib/domain/community';
import { EVENT_ICON, eventDay, eventTime, type PublicEvent } from '@/lib/domain/events';
import { firstName } from '@/lib/domain/profile';
import { isUuid } from '@/lib/domain/reports';
import { t, type Lang } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember, type SessionProfile } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

const TABS = ['posts', 'members', 'rules'] as const;
/** How long a new member sees the welcome card with "Say hi". */
const WELCOME_MS = 7 * 86_400_000;

/** The group, with the caller's membership, shared by the page and its title. */
const getGroup = cache(async (id: string) => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_groups')
    .select(PUBLIC_GROUP_COLUMNS)
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<PublicGroup, { merge: false }>();
  if (error) throw new Error(`group lookup failed: ${error.message}`);
  return data;
});

export async function generateMetadata({ params }: PageProps<'/community/groups/[id]'>): Promise<Metadata> {
  const [lang, group] = await Promise.all([getLang(), getGroup((await params).id)]);
  return { title: group?.name ?? t(lang, 'community.tab.groups') };
}

/**
 * A group (spec §8.4, the groupmate's design): its tile and members, then Posts, Members or Rules (`?tab=`). Everyone in
 * the township reads it; members post, comment and vote Helpful.
 */
export default async function GroupPage({ params, searchParams }: PageProps<'/community/groups/[id]'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const group = await getGroup((await params).id);
  if (!group) notFound();
  if (group.is_general) redirect('/community/general'); // General chat is its topics now
  const query = await searchParams;
  const tab = TABS.find((x) => x === query.tab) ?? 'posts';
  const segment = (on: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-sm font-extrabold ${on ? 'bg-surface text-text shadow-card' : 'text-muted-2'}`;

  return (
    <>
      <AppHeader title={group.name} back="/community?tab=groups" />
      {group.is_member && <MarkVisited groupId={group.id} />}
      {/* grid-cols-1 (minmax(0, 1fr)): no card can stretch the column past the screen. */}
      <main className="grid grid-cols-1 gap-3 px-4 py-4">
        <section className="flex items-center gap-3">
          <span aria-hidden="true" className={`grid size-14 shrink-0 place-items-center rounded-2xl text-lg font-extrabold ${GROUP_TILE[group.colour]}`}>
            {initials(group.name)}
          </span>
          <div className="grid min-w-0 flex-1 justify-items-start gap-1">
            <p className="text-sm text-muted-2">{t(lang, 'group.verifiedOnly', { n: group.member_count })}</p>
            {group.is_member && <Tag variant="green">✓ {t(lang, 'group.joined')}</Tag>}
          </div>
          {!group.is_member && (
            <div className="shrink-0">
              <JoinButton groupId={group.id} name={group.name} canAct={profile.status === 'verified'} variant="primary" />
            </div>
          )}
        </section>
        <nav aria-label={t(lang, 'group.sections')} className="flex rounded-xl bg-chip p-1">
          {TABS.map((x) => (
            // replace: switching sections is not a step back's worth of history (← leaves the group).
            <Link key={x} href={`/community/groups/${group.id}?tab=${x}`} replace scroll={false} aria-current={tab === x ? 'page' : undefined} className={segment(tab === x)}>
              {t(lang, `group.tab.${x}`)}
            </Link>
          ))}
        </nav>
        {tab === 'posts' && <Posts group={group} profile={profile} lang={lang} />}
        {tab === 'members' && <Members group={group} profile={profile} lang={lang} />}
        {tab === 'rules' && <Rules group={group} lang={lang} />}
      </main>
    </>
  );
}

/** Welcome card (new members), the next event pinned in the group, the composer (members) and the latest posts. */
async function Posts({ group, profile, lang }: { group: PublicGroup; profile: SessionProfile; lang: Lang }) {
  const supabase = await createClient();
  const now = new Date();
  const [posts, events] = await Promise.all([
    supabase
      .from('public_posts')
      .select(PUBLIC_POST_COLUMNS)
      .eq('group_id', group.id)
      .order('created_at', { ascending: false })
      .limit(30) // shortcut: the latest 30 posts only; add "older posts" once a group outgrows a page
      .overrideTypes<PublicPost[], { merge: false }>(),
    supabase
      .from('public_events')
      .select('id, title, category, starts_at, location_text')
      .eq('group_id', group.id)
      .gt('ends_at', now.toISOString())
      .order('starts_at')
      .limit(1)
      .overrideTypes<Pick<PublicEvent, 'id' | 'title' | 'category' | 'starts_at' | 'location_text'>[], { merge: false }>(),
  ]);
  for (const { error } of [posts, events]) if (error) throw new Error(`group posts lookup failed: ${error.message}`);
  const ids = posts.data!.map((p) => p.id);
  const { data: comments, error } = ids.length
    ? await supabase
        .from('public_comments')
        .select(PUBLIC_COMMENT_COLUMNS)
        .in('post_id', ids)
        .order('created_at')
        .overrideTypes<PublicComment[], { merge: false }>()
    : { data: [], error: null };
  if (error) throw new Error(`group comments lookup failed: ${error.message}`);
  // A Share & Lend post about an item that is still up shows the item under it.
  const listingIds = posts.data!.flatMap((p) => (p.listing_id ? [p.listing_id] : []));
  const { data: items, error: itemsError } = listingIds.length
    ? await supabase.from('public_listings').select('id, kind, title, emoji').in('id', listingIds).overrideTypes<PostListing[], { merge: false }>()
    : { data: [], error: null };
  if (itemsError) throw new Error(`group listings lookup failed: ${itemsError.message}`);

  const next = events.data![0];
  const pinned = next && (
    <Link href={`/community/events/${next.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-card hover:bg-soft">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-tint-orange text-xl">
        <Glyph emoji={EVENT_ICON[next.category]} />
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="text-xs font-extrabold uppercase tracking-wide text-muted">
          <span aria-hidden="true">📌 </span>
          {t(lang, 'group.nextEvent')}
        </span>
        <span className="break-words font-bold">{next.title}</span>
        <span className="text-sm text-muted-2">
          {eventDay(new Date(next.starts_at), lang)} · {eventTime(new Date(next.starts_at), lang)} · {next.location_text}
        </span>
      </span>
      <span aria-hidden="true" className="text-xl text-muted">
        ›
      </span>
    </Link>
  );
  // A member who joined lately; not the admin, who made the group.
  const isNew = group.my_role === 'member' && group.joined_at !== null && now.getTime() - Date.parse(group.joined_at) < WELCOME_MS;
  const canAct = group.is_member && profile.status === 'verified';

  return (
    <>
      {group.is_member ? (
        <PostComposer
          groupId={group.id}
          groupName={group.name}
          sayHi={isNew ? t(lang, 'group.sayHiText', { name: firstName(profile.full_name), place: profile.neighbourhood }) : null}
          canPost={profile.status === 'verified'}
        >
          {pinned}
        </PostComposer>
      ) : (
        <>
          {pinned}
          <p className="rounded-2xl bg-tint-blue px-3.5 py-3 text-sm">{t(lang, 'group.joinToPost')}</p>
        </>
      )}
      {posts.data!.length === 0 ? (
        <EmptyState icon="💬" title={t(lang, 'group.posts.empty')} description={t(lang, 'group.posts.emptyHint')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.data!.map((p) => (
            <li key={p.id}>
              <PostCard
                post={p}
                listing={items.find((l) => l.id === p.listing_id)}
                comments={comments.filter((c) => c.post_id === p.id)}
                lang={lang}
                canAct={canAct}
                canMessage={profile.status === 'verified'}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The members with accounts (admin first, then the newest), and how many more the count holds. Members may leave here. */
async function Members({ group, profile, lang }: { group: PublicGroup; profile: SessionProfile; lang: Lang }) {
  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from('public_group_members')
    .select('user_id, full_name, neighbourhood, role')
    .eq('group_id', group.id)
    .order('role') // 'admin' before 'member'
    .order('joined_at', { ascending: false });
  if (error) throw new Error(`group members lookup failed: ${error.message}`);
  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={m.full_name} size={36} />
            <span className="grid min-w-0 flex-1">
              <span className="break-words font-bold">{m.full_name}</span>
              <span className="text-sm text-muted-2">{m.neighbourhood}</span>
            </span>
            {m.role === 'admin' && <Tag variant="amber">{t(lang, 'group.admin')}</Tag>}
          </li>
        ))}
      </ul>
      {group.member_count > members.length && (
        <p className="text-center text-sm text-muted-2">{t(lang, 'group.moreMembers', { n: group.member_count - members.length })}</p>
      )}
      {group.my_role === 'member' && !group.is_general && (
        <JoinButton groupId={group.id} name={group.name} member canAct={profile.status === 'verified'} />
      )}
    </>
  );
}

function Rules({ group, lang }: { group: PublicGroup; lang: Lang }) {
  const rules = (group.rules ?? '')
    .split('\n')
    .map((rule) => rule.trim())
    .filter(Boolean);
  const heading = 'text-xs font-extrabold uppercase tracking-wide text-muted';
  return (
    <section className="grid gap-2 rounded-2xl border border-line bg-surface p-4 shadow-card">
      {group.description && (
        <>
          <h2 className={heading}>{t(lang, 'group.about')}</h2>
          <p className="whitespace-pre-line break-words">{group.description}</p>
        </>
      )}
      <h2 className={`${heading} ${group.description ? 'pt-2' : ''}`}>{t(lang, 'group.tab.rules')}</h2>
      {rules.length === 0 ? (
        <p className="text-muted-2">{t(lang, 'group.noRules')}</p>
      ) : (
        <ol className="grid list-decimal gap-1.5 pl-5">
          {rules.map((rule, i) => (
            <li key={i} className="break-words">
              {rule}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
