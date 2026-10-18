import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/app/AppHeader';
import { LiveRefresh } from '@/components/app/LiveRefresh';
import { fixedInLabel } from '@/components/reports/labels';
import { STATUS_TAG } from '@/components/reports/statusTag';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Glyph } from '@/components/ui/Glyph';
import { Tag } from '@/components/ui/Tag';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { CATEGORY_ICON, PUBLIC_REPORT_COLUMNS, boardOrder, scorecard, type PublicReport } from '@/lib/domain/reports';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'home.tile.issues') };
}

/**
 * The Issue Board (canvas "Reporting channel → 3"): the township's public reports with the most-felt problems first, and
 * the scorecard that keeps the Management Office accountable. `?view=mine` lists the resident's own reports instead,
 * private ones included.
 */
export default async function ReportsPage({ searchParams }: PageProps<'/reports'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const mine = (await searchParams).view === 'mine';
  const supabase = await createClient();
  // The privacy view: public reports and the caller's own private ones, never who sent them.
  const { data, error } = await supabase
    .from('public_reports')
    .select(PUBLIC_REPORT_COLUMNS)
    .overrideTypes<PublicReport[], { merge: false }>();
  if (error) throw new Error(`reports lookup failed: ${error.message}`);

  const board = data.filter((r) => !r.is_private);
  const own = data.filter((r) => r.is_mine);
  const score = scorecard(board, new Date());
  const list = mine ? own.toSorted((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)) : boardOrder(board);
  const township = profile.township.name;

  const view = (selected: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-center text-sm font-extrabold leading-tight ${
      selected ? 'bg-surface text-text shadow-card' : 'text-muted'
    }`;
  const stat = 'rounded-2xl border border-line bg-surface p-3 shadow-card';

  return (
    <>
      <AppHeader title={t(lang, 'report.board.title', { township })} back="/home" showBell />
      <LiveRefresh townshipId={profile.township_id} tables={['reports', 'report_updates']} />
      <main className="grid gap-4 px-4 py-4">
        <nav aria-label={t(lang, 'report.board.views')} className="flex rounded-xl bg-chip p-1">
          <Link href="/reports" aria-current={mine ? undefined : 'page'} className={view(!mine)}>
            {t(lang, 'report.board.tab', { township })}
          </Link>
          <Link href="/reports?view=mine" aria-current={mine ? 'page' : undefined} className={view(mine)}>
            {t(lang, 'report.board.mine', { n: own.length })}
          </Link>
        </nav>

        {!mine && (
          <section className="grid gap-2">
            <dl className="grid grid-cols-2 gap-2">
              <div className={stat}>
                <dt className="text-xs font-bold text-muted-2">{t(lang, 'report.board.resolved')}</dt>
                <dd className="text-2xl font-extrabold">{score.resolvedThisMonth}</dd>
              </div>
              <div className={stat}>
                <dt className="text-xs font-bold text-muted-2">{t(lang, 'report.board.avgFix')}</dt>
                <dd className="text-2xl font-extrabold">
                  {score.avgDaysToFix === null ? '–' : t(lang, 'report.board.days', { n: score.avgDaysToFix })}
                </dd>
              </div>
            </dl>
            {score.pctSaidFixed !== null && (
              <p className="text-sm font-bold text-green-text">
                <span aria-hidden="true">✓</span> {t(lang, 'report.board.saidFixed', { n: score.pctSaidFixed })}
              </p>
            )}
          </section>
        )}

        {list.length === 0 ? (
          mine ? (
            <EmptyState
              icon="📋"
              title={t(lang, 'report.mine.empty')}
              description={t(lang, 'report.mine.emptyHint')}
              action={
                <Link href="/reports/new" className={buttonClasses('primary')}>
                  {t(lang, 'create.report')}
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon="📋"
              title={t(lang, 'report.board.empty')}
              description={t(lang, 'report.board.emptyHint')}
              action={
                <Link href="/reports/new" className={buttonClasses('primary')}>
                  {t(lang, 'create.report')}
                </Link>
              }
            />
          )
        ) : (
          <ul className="grid gap-2">
            {list.map((r) => {
              const fixedAt = r.status === 'resolved' || r.status === 'confirmed' ? r.resolved_at : null;
              return (
                <li key={r.id}>
                  <Link
                    href={`/reports/${r.id}`}
                    className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap gap-1">
                        <Tag variant={STATUS_TAG[r.status]}>{t(lang, `report.status.${r.status}`)}</Tag>
                        {r.is_private && (
                          <Tag variant="info">
                            <Glyph emoji="🔒" /> {t(lang, 'report.private')}
                          </Tag>
                        )}
                      </span>
                      <span className="mt-1 block break-words text-base font-extrabold leading-snug">
                        <Glyph emoji={CATEGORY_ICON[r.category]} /> {r.title}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-2">
                        {fixedAt ? (
                          <>
                            {fixedInLabel(lang, r.created_at, fixedAt)}
                            {r.fixed_yes > 0 && ` · ${t(lang, 'report.board.confirmed', { n: r.fixed_yes })}`}
                          </>
                        ) : (
                          <>
                            <TimeAgo date={r.created_at} />
                            {r.team && ` · ${t(lang, `report.team.${r.team}`)}`}
                          </>
                        )}
                      </span>
                    </span>
                    {!r.is_private && (
                      <span className="shrink-0 text-center leading-none">
                        <span className="block text-2xl font-extrabold text-red-text">{r.metoo_count}</span>
                        <span className="block text-xs font-bold text-muted-2">{t(lang, 'report.board.metoo')}</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
