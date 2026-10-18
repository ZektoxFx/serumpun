import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { AppHeader } from '@/components/app/AppHeader';
import { LiveRefresh } from '@/components/app/LiveRefresh';
import { FixAnswer } from '@/components/reports/FixAnswer';
import { MeTooButton } from '@/components/reports/MeTooButton';
import { ReportTimeline } from '@/components/reports/ReportTimeline';
import { fixedInLabel, openLabel } from '@/components/reports/labels';
import { STATUS_TAG } from '@/components/reports/statusTag';
import { Glyph } from '@/components/ui/Glyph';
import { Tag } from '@/components/ui/Tag';
import {
  CATEGORY_ICON,
  PUBLIC_REPORT_COLUMNS,
  buildTimeline,
  canAnswerFix,
  canMeToo,
  isUuid,
  type PublicReport,
  type ReportUpdate,
} from '@/lib/domain/reports';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { photoUrls } from '@/lib/supabase/photoUrls';
import { createClient } from '@/lib/supabase/server';

/** The report through the privacy view, shared by the page and its title. Null when the caller may not see it. */
const getReport = cache(async (id: string) => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_reports')
    .select(PUBLIC_REPORT_COLUMNS)
    .eq('id', id)
    .maybeSingle()
    .overrideTypes<PublicReport, { merge: false }>();
  if (error) throw new Error(`report lookup failed: ${error.message}`);
  return data;
});

export async function generateMetadata({ params }: PageProps<'/reports/[id]'>): Promise<Metadata> {
  const [lang, report] = await Promise.all([getLang(), getReport((await params).id)]);
  return { title: report ? t(lang, 'report.ref', { n: report.ref_no }) : t(lang, 'home.tile.issues') };
}

const pill = 'flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-center text-sm font-extrabold';

/**
 * One report (canvas "Reporting channel → 2"): its photo, status and place, Me too, the timeline with the Management
 * Office's messages, and "Is it fixed?" once it is resolved. Someone else's private report is "not found".
 */
export default async function ReportPage({ params }: PageProps<'/reports/[id]'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  const supabase = await createClient();
  const { data: updates, error } = await supabase
    .from('public_report_updates')
    .select('status, message, photo_path, created_at, by_management')
    .eq('report_id', id)
    .overrideTypes<ReportUpdate[], { merge: false }>();
  if (error) throw new Error(`report timeline lookup failed: ${error.message}`);
  const steps = buildTimeline(report.status, updates);

  const urls = await photoUrls(supabase, report.is_private, [
    report.photo_path,
    ...steps.flatMap((s) => s.notes.map((n) => n.photo_path)),
  ]);
  const photo = report.photo_path && urls.get(report.photo_path);

  const now = new Date();
  const verified = profile.status === 'verified';
  const status = t(lang, `report.status.${report.status}`);
  const age =
    (report.status === 'resolved' || report.status === 'confirmed') && report.resolved_at
      ? fixedInLabel(lang, report.created_at, report.resolved_at)
      : openLabel(lang, report.created_at, now);
  const following = report.is_mine || report.has_metoo;
  const answers = report.fixed_yes + report.fixed_no;

  return (
    <>
      <AppHeader title={t(lang, 'report.ref', { n: report.ref_no })} back="/reports" showBell />
      <LiveRefresh townshipId={profile.township_id} tables={['reports', 'report_updates']} />
      <main className="grid gap-4 pb-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- already shrunk to 1280 px before upload; private links are signed per view
          <img
            src={photo}
            alt={t(lang, 'report.photoAlt', { category: t(lang, `report.category.${report.category}`), status })}
            className="h-56 w-full object-cover"
          />
        ) : (
          <div aria-hidden="true" className="grid h-32 place-items-center bg-sidebar text-6xl">
            <Glyph emoji={CATEGORY_ICON[report.category]} />
          </div>
        )}

        <div className="grid gap-4 px-4">
          <div className="grid gap-1">
            <p className="flex flex-wrap gap-1">
              <Tag variant={STATUS_TAG[report.status]}>
                {status} · {age}
              </Tag>
              {report.is_private && (
                <Tag variant="info">
                  <Glyph emoji="🔒" /> {t(lang, 'report.private')}
                </Tag>
              )}
            </p>
            <h2 className="break-words text-xl font-extrabold leading-snug">
              <Glyph emoji={CATEGORY_ICON[report.category]} /> {report.title}
            </h2>
            <p className="text-sm text-muted-2">
              {[report.location_text, report.team && t(lang, `report.team.${report.team}`)].filter(Boolean).join(' · ')}
            </p>
            <p className="text-sm text-muted-2">{t(lang, report.is_mine ? 'report.byYou' : 'report.byResident')}</p>
          </div>

          {report.description && <p className="whitespace-pre-line break-words text-base">{report.description}</p>}
          {report.is_private && <p className="rounded-xl bg-tint-blue px-3 py-2 text-sm">{t(lang, 'report.privateHint')}</p>}

          {(!report.is_private || following) && (
            <div className="grid gap-1">
              <div className="grid grid-cols-2 gap-2">
                {!report.is_private &&
                  (report.has_metoo || (verified && canMeToo(report)) ? (
                    <MeTooButton reportId={report.id} done={report.has_metoo} count={report.metoo_count} />
                  ) : (
                    <p className={`${pill} bg-chip text-muted-2`}>
                      <span aria-hidden="true">👍</span> {t(lang, 'report.metooCount', { n: report.metoo_count })}
                    </p>
                  ))}
                {following && (
                  <p className={`${pill} border border-line-strong bg-surface`}>
                    <Glyph emoji="🔔" /> {t(lang, 'report.following')}
                  </p>
                )}
              </div>
              {following && <p className="text-xs text-muted-2">{t(lang, 'report.followingHint')}</p>}
              {!verified && canMeToo(report) && <p className="text-sm text-muted-2">{t(lang, 'common.pendingCantAct')}</p>}
            </div>
          )}

          {verified && canAnswerFix(report) && <FixAnswer reportId={report.id} />}
          {answers > 0 && (
            <p className="text-sm text-muted-2">{t(lang, 'report.fixedCounts', { yes: report.fixed_yes, no: report.fixed_no })}</p>
          )}

          <ReportTimeline steps={steps} lang={lang} now={now} urls={urls} headingId="report-progress" />
        </div>
      </main>
    </>
  );
}
