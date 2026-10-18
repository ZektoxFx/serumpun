import Image from 'next/image';
import Link from 'next/link';
import { signOut } from '@/app/(auth)/actions';
import { EmergencyPopup } from '@/components/app/EmergencyPopup';
import { HeroChip } from '@/components/app/HeroChip';
import { LanguageSwitch } from '@/components/app/LanguageSwitch';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { ResolveEmergency } from '@/components/dashboard/ResolveEmergency';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { EMERGENCY_ICON, type EmergencyKind } from '@/lib/domain/emergency';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * The Management Office's shell (canvas "Reporting channel → 4"): a navy sidebar beside the page from 900 px, above it on
 * narrower screens. Only the sections that exist are listed (ruling R5). Each page still calls requireManagement itself:
 * a layout does not stop its page from rendering.
 */
export default async function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  const profile = await requireManagement();
  const lang = await getLang();
  const supabase = await createClient();
  // Row-level security limits both counts to the office's own township.
  const [open, waiting, asking, told] = await Promise.all([
    supabase.from('reports').select('id', { count: 'exact', head: true }).not('status', 'in', '(resolved,confirmed)'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'resident').eq('status', 'pending'),
    supabase
      .from('public_events')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending')
      .gt('ends_at', new Date().toISOString()),
    supabase.from('resident_notices').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
  ]);
  for (const { error } of [open, waiting, asking, told]) if (error) console.error(`dashboard counts: ${error.message}`); // the menu still works
  // Emergencies not yet resolved or cancelled, with who sent them and where they live: only the office sees that. They
  // stay here until resolved, even after they fade from residents' maps at 2 hours.
  const { data: live, error: liveError } = await supabase
    .from('emergencies')
    .select('id, created_by, kind, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .overrideTypes<{ id: string; created_by: string; kind: EmergencyKind; created_at: string }[], { merge: false }>();
  if (liveError) console.error(`emergencies lookup: ${liveError.message}`);
  const senders = live?.length
    ? await Promise.all([
        supabase.from('profiles').select('id, full_name, neighbourhood').in('id', live.map((e) => e.created_by)),
        supabase.from('profile_private').select('id, unit_no, phone').in('id', live.map((e) => e.created_by)),
      ])
    : null;
  const sender = new Map(senders?.[0].data?.map((p) => [p.id, p]) ?? []);
  const home = new Map(senders?.[1].data?.map((p) => [p.id, p]) ?? []);

  return (
    <div className="min-h-dvh min-[900px]:flex">
      <aside className="bg-sidebar text-white min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-dvh min-[900px]:w-64 min-[900px]:shrink-0 min-[900px]:overflow-y-auto">
        <div className="grid gap-4 p-4">
          {/* Only large, bold text on the gradient; the small line sits on a white chip. */}
          <div className="rounded-xl bg-brand-gradient px-4 py-3">
            <Image src="/brand/logo-horizontal-white.png" alt="Serumpun" width={1200} height={305} priority className="h-auto w-48" />
            <HeroChip className="mt-2">
              {t(lang, 'dashboard.title')} · {profile.township.name}
            </HeroChip>
          </div>
          <DashboardNav
            label={t(lang, 'dashboard.nav')}
            items={[
              {
                href: '/dashboard',
                icon: '📋',
                label: t(lang, 'dashboard.nav.reports'),
                badge: { n: open.count ?? 0, label: t(lang, 'dashboard.nav.open', { n: open.count ?? 0 }) },
              },
              {
                href: '/dashboard/residents',
                icon: '🪪',
                label: t(lang, 'dashboard.nav.residents'),
                badge: { n: waiting.count ?? 0, label: t(lang, 'dashboard.nav.waiting', { n: waiting.count ?? 0 }) },
              },
              {
                href: '/dashboard/events',
                icon: '📅',
                label: t(lang, 'dashboard.nav.events'),
                badge: { n: asking.count ?? 0, label: t(lang, 'dashboard.nav.waiting', { n: asking.count ?? 0 }) },
              },
              {
                href: '/dashboard/notices',
                icon: '📝',
                label: t(lang, 'dashboard.nav.notices'),
                badge: { n: told.count ?? 0, label: t(lang, 'dashboard.nav.waiting', { n: told.count ?? 0 }) },
              },
              { href: '/dashboard/announcements', icon: '📢', label: t(lang, 'dashboard.nav.announcements') },
              { href: '/dashboard/general', icon: '💬', label: t(lang, 'general.title') },
              { href: '/dashboard/pins', icon: '📍', label: t(lang, 'dashboard.nav.pins') },
              { href: '/dashboard/rewards', icon: '🎁', label: t(lang, 'dashboard.nav.rewards') },
              { href: '/dashboard/reset', icon: '🔄', label: t(lang, 'dashboard.nav.reset') },
            ]}
          />
          <div className="grid gap-3 border-t border-white/15 pt-4">
            <p className="text-sm font-bold">{profile.full_name}</p>
            <LanguageSwitch lang={lang} />
            <form action={signOut}>
              <button className="min-h-11 rounded-lg px-3 text-sm font-bold text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-white">
                {t(lang, 'auth.signOut')}
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        {live && live.length > 0 && (
          <section aria-label={t(lang, 'emergency.title')} className="grid gap-px bg-red text-white">
            {live.map((e) => {
              const who = sender.get(e.created_by);
              const where = home.get(e.created_by);
              return (
                <div key={e.id} role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
                  <p className="min-w-0 flex-1 font-bold">
                    <span aria-hidden="true">{EMERGENCY_ICON[e.kind]} </span>
                    <span className="font-extrabold">{e.kind === 'unknown' ? t(lang, 'emergency.title') : t(lang, `emergency.kind.${e.kind}`)}</span>
                    {' · '}
                    {[who?.full_name, where?.unit_no, who?.neighbourhood, where?.phone].filter(Boolean).join(' · ')}
                    {' · '}
                    <TimeAgo date={e.created_at} />
                  </p>
                  <Link href={`/map?emergency=${e.id}`} className="min-h-11 content-center rounded-xl px-3 text-sm font-bold underline focus-visible:outline-white">
                    {t(lang, 'emergency.showMap')}
                  </Link>
                  <ResolveEmergency id={e.id} />
                </div>
              );
            })}
          </section>
        )}
        {children}
      </div>
      {/* The office hears of every emergency in the township, and the banner above follows each change. */}
      <EmergencyPopup townshipId={profile.township_id} home={null} refresh />
    </div>
  );
}
