import type { Metadata } from 'next';
import Link from 'next/link';
import { LiveRefresh } from '@/components/app/LiveRefresh';
import { MiniMap } from '@/components/dashboard/MiniMap';
import { ReportSheet } from '@/components/dashboard/ReportSheet';
import { ReportUpdateForm } from '@/components/dashboard/ReportUpdateForm';
import { ReportTimeline } from '@/components/reports/ReportTimeline';
import { fixedInLabel, openLabel } from '@/components/reports/labels';
import { STATUS_TAG } from '@/components/reports/statusTag';
import { Tag } from '@/components/ui/Tag';
import { TimeAgo } from '@/components/ui/TimeAgo';
import {
  CATEGORY_ICON,
  PUBLIC_REPORT_COLUMNS,
  RESOLVED_SHOWN,
  buildTimeline,
  groupForKanban,
  hotIds,
  isOpenReport,
  scorecard,
  type KanbanColumn,
  type PublicReport,
  type ReportUpdate,
} from '@/lib/domain/reports';
import { t, type Lang } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/supabase/auth';
import { photoUrls } from '@/lib/supabase/photoUrls';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'dashboard.nav.reports') };
}

const COLUMNS: readonly KanbanColumn[] = ['new', 'acknowledged', 'in_progress', 'resolved'];

/**
 * The Management Office's reports (canvas "Reporting channel → 4"): the KPI strip, then New, Acknowledged, In progress
 * and Resolved, most-felt first, with the hottest cards outlined in red. `?report=<id>` opens a report's panel: photo,
 * place, reporter, timeline and the update form. It refreshes whenever the township's reports change.
 */
export default async function DashboardReportsPage({ searchParams }: PageProps<'/dashboard'>) {
  const profile = await requireManagement();
  const lang = await getLang();
  const supabase = await createClient();
  // For the Management Office the view holds every report of its township, private ones included.
  const { data: reports, error } = await supabase
    .from('public_reports')
    .select(PUBLIC_REPORT_COLUMNS)
    .overrideTypes<PublicReport[], { merge: false }>();
  if (error) throw new Error(`reports lookup failed: ${error.message}`);

  const now = new Date();
  const open = reports.filter((r) => isOpenReport(r.status));
  const score = scorecard(reports, now);
  const columns = groupForKanban(reports);
  const hot = hotIds(open);
  const wanted = (await searchParams).report;
  const selected = reports.find((r) => r.id === wanted) ?? null;

  const kpis: { label: Parameters<typeof t>[1]; value: string | number; good?: true }[] = [
    { label: 'dashboard.kpi.open', value: open.length },
    { label: 'dashboard.kpi.inProgress', value: reports.filter((r) => r.status === 'in_progress').length },
    { label: 'report.board.resolved', value: score.resolvedThisMonth, good: true },
    {
      label: 'dashboard.kpi.avgFix',
      value: score.avgDaysToFix === null ? '–' : t(lang, 'report.board.days', { n: score.avgDaysToFix }),
      good: true,
    },
    { label: 'dashboard.kpi.saidFixed', value: score.pctSaidFixed === null ? '–' : `${score.pctSaidFixed}%`, good: true },
  ];

  return (
    <main className="grid gap-5 p-4 sm:p-6">
      <LiveRefresh townshipId={profile.township_id} tables={['reports', 'report_updates']} />
      <h1 className="text-2xl font-extrabold">{t(lang, 'dashboard.nav.reports')}</h1>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-line bg-surface p-3 shadow-card">
            <dt className="text-xs font-bold text-muted-2">{t(lang, kpi.label)}</dt>
            <dd className={`text-2xl font-extrabold ${kpi.good ? 'text-green-text' : ''}`}>{kpi.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const cards = columns[column];
          const total = column === 'resolved' ? reports.length - open.length : cards.length;
          return (
            <section key={column} aria-labelledby={`column-${column}`} className="grid gap-2 rounded-2xl bg-chip p-2">
              <h2 id={`column-${column}`} className="flex items-center justify-between px-1 pt-1 text-sm font-extrabold">
                {t(lang, `dashboard.column.${column}`)}
                <span className="text-muted-2">{total}</span>
              </h2>
              {column === 'resolved' && total > RESOLVED_SHOWN && (
                <p className="px-1 text-xs text-muted-2">{t(lang, 'dashboard.column.latest', { n: RESOLVED_SHOWN })}</p>
              )}
              {cards.length === 0 ? (
                <p className="px-1 pb-2 text-sm text-muted-2">{t(lang, 'dashboard.column.empty')}</p>
              ) : (
                <ul className="grid gap-2">
                  {cards.map((r) => (
                    <li key={r.id}>
                      <ReportCard report={r} lang={lang} hot={hot.has(r.id)} selected={r.id === selected?.id} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {selected && <ReportPanel report={selected} lang={lang} now={now} officeId={profile.id} />}
    </main>
  );
}

function ReportCard({ report: r, lang, hot, selected }: { report: PublicReport; lang: Lang; hot: boolean; selected: boolean }) {
  return (
    <Link
      href={`/dashboard?report=${r.id}`}
      scroll={false}
      aria-current={selected ? 'true' : undefined}
      className={`grid gap-1 rounded-xl border-2 bg-surface p-3 text-sm shadow-card hover:bg-soft ${hot ? 'border-red' : 'border-transparent'}`}
    >
      {(hot || r.is_private || r.status === 'reopened' || r.status === 'confirmed') && (
        <span className="flex flex-wrap gap-1">
          {hot && (
            <Tag variant="red">
              <span aria-hidden="true">🔥</span> {t(lang, 'dashboard.hot')}
            </Tag>
          )}
          {(r.status === 'reopened' || r.status === 'confirmed') && (
            <Tag variant={STATUS_TAG[r.status]}>{t(lang, `report.status.${r.status}`)}</Tag>
          )}
          {r.is_private && (
            <Tag variant="info">
              <span aria-hidden="true">🔒</span> {t(lang, 'report.private')}
            </Tag>
          )}
        </span>
      )}
      <span className="break-words font-extrabold leading-snug">
        <span aria-hidden="true">{CATEGORY_ICON[r.category]}</span> #{r.ref_no} {r.title}
      </span>
      <span className="text-muted-2">{r.team ? t(lang, `report.team.${r.team}`) : r.location_text}</span>
      <span className="flex items-center justify-between gap-2 text-xs text-muted-2">
        <TimeAgo date={r.created_at} />
        {!r.is_private && (
          <span className="font-extrabold text-red-text">
            <span aria-hidden="true">👍</span> {r.metoo_count}
            <span className="sr-only"> {t(lang, 'report.metoo')}</span>
          </span>
        )}
      </span>
    </Link>
  );
}

/** The right-hand panel for one report. Only the Management Office reaches this: the reporter's name and unit are here. */
async function ReportPanel({ report, lang, now, officeId }: { report: PublicReport; lang: Lang; now: Date; officeId: string }) {
  const supabase = await createClient();
  const [own, timeline] = await Promise.all([
    supabase.from('reports').select('created_by').eq('id', report.id).maybeSingle(),
    supabase
      .from('public_report_updates')
      .select('status, message, photo_path, created_at, by_management')
      .eq('report_id', report.id)
      .overrideTypes<ReportUpdate[], { merge: false }>(),
  ]);
  if (own.error) throw new Error(`report lookup failed: ${own.error.message}`);
  if (timeline.error) throw new Error(`report timeline lookup failed: ${timeline.error.message}`);
  const reporterId: string | null = own.data?.created_by ?? null;
  const [person, home] = reporterId
    ? await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', reporterId).maybeSingle(),
        supabase.from('profile_private').select('unit_no').eq('id', reporterId).maybeSingle(),
      ])
    : [null, null];

  const steps = buildTimeline(report.status, timeline.data);
  const urls = await photoUrls(supabase, report.is_private, [report.photo_path, ...steps.flatMap((s) => s.notes.map((n) => n.photo_path))]);
  const photo = report.photo_path && urls.get(report.photo_path);
  const status = t(lang, `report.status.${report.status}`);
  const age =
    (report.status === 'resolved' || report.status === 'confirmed') && report.resolved_at
      ? fixedInLabel(lang, report.created_at, report.resolved_at)
      : openLabel(lang, report.created_at, now);
  const reporter = person?.data ? [person.data.full_name, home?.data?.unit_no].filter(Boolean).join(' · ') : t(lang, 'dashboard.report.gone');

  return (
    <ReportSheet title={t(lang, 'report.ref', { n: report.ref_no })}>
      <div className="grid gap-4 pb-4">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- already shrunk to 1280 px before upload; private links are signed per view
          <img
            src={photo}
            alt={t(lang, 'report.photoAlt', { category: t(lang, `report.category.${report.category}`), status })}
            className="max-h-64 w-full rounded-xl object-cover"
          />
        )}
        <div className="grid gap-1">
          <p className="flex flex-wrap gap-1">
            <Tag variant={STATUS_TAG[report.status]}>
              {status} · {age}
            </Tag>
            {report.is_private && (
              <Tag variant="info">
                <span aria-hidden="true">🔒</span> {t(lang, 'report.private')}
              </Tag>
            )}
          </p>
          <h3 className="break-words text-lg font-extrabold leading-snug">
            <span aria-hidden="true">{CATEGORY_ICON[report.category]}</span> {report.title}
          </h3>
          <p className="text-sm text-muted-2">
            {[report.location_text, report.team && t(lang, `report.team.${report.team}`)].filter(Boolean).join(' · ')}
          </p>
        </div>

        <dl className="grid gap-2 rounded-xl bg-soft p-3 text-sm">
          <div>
            <dt className="text-xs font-bold text-muted-2">{t(lang, 'dashboard.report.reporter')}</dt>
            <dd className="font-bold">{reporter}</dd>
          </div>
          {!report.is_private && (
            <div>
              <dt className="sr-only">{t(lang, 'report.metoo')}</dt>
              <dd>
                <span aria-hidden="true">👍</span> {t(lang, 'dashboard.report.metoo', { n: report.metoo_count })}
              </dd>
            </div>
          )}
          {report.fixed_yes + report.fixed_no > 0 && (
            <div>
              <dt className="sr-only">{t(lang, 'report.fixedAsk')}</dt>
              <dd>{t(lang, 'report.fixedCounts', { yes: report.fixed_yes, no: report.fixed_no })}</dd>
            </div>
          )}
        </dl>

        {report.description && <p className="whitespace-pre-line break-words text-sm">{report.description}</p>}
        <MiniMap lat={report.lat} lng={report.lng} label={t(lang, 'dashboard.report.map')} />
        <ReportUpdateForm
          report={{ id: report.id, status: report.status, team: report.team, is_private: report.is_private }}
          officeId={officeId}
        />
        <ReportTimeline steps={steps} lang={lang} now={now} urls={urls} headingId="panel-progress" />
      </div>
    </ReportSheet>
  );
}
