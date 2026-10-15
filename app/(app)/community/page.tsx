import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/app/AppHeader';
import { EventsTab } from '@/components/events/EventsTab';
import { GroupsTab } from '@/components/groups/GroupsTab';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'nav.community') };
}

/** The tabs that exist, in the canvas order (ruling R5): Services and Share & Lend join as their tasks land. */
const TABS = ['groups', 'events'] as const;

/** Community (canvas "Community tabs"): the township's name over the title, the tab pills, and the tab `?tab=` picks. */
export default async function CommunityPage({ searchParams }: PageProps<'/community'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const params = await searchParams;
  const tab = TABS.find((x) => x === params.tab) ?? 'groups';
  const pill = (on: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-bold ${
      on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-surface text-text'
    }`;

  return (
    <>
      <AppHeader
        title={
          <>
            <span className="block text-sm font-semibold tracking-normal text-muted-2">{profile.township.name}</span>{' '}
            {t(lang, 'nav.community')}
          </>
        }
        showBell
        showInbox
      >
        <nav aria-label={t(lang, 'community.tabs')} className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {TABS.map((x) => (
            <Link key={x} href={`/community?tab=${x}`} aria-current={tab === x ? 'page' : undefined} className={pill(tab === x)}>
              {t(lang, `community.tab.${x}`)}
            </Link>
          ))}
        </nav>
      </AppHeader>
      {tab === 'events' ? <EventsTab profile={profile} lang={lang} params={params} /> : <GroupsTab profile={profile} lang={lang} />}
    </>
  );
}
