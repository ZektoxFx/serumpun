import { startOfMytMonth } from './time';

// supabase/migrations/0003_reports.sql enforces the same categories, statuses, teams and transitions.

/** The report categories (spec §8.2). */
export const REPORT_CATEGORIES = ['streetlight', 'road', 'tree', 'rubbish', 'drain', 'park', 'walkway', 'security', 'animals'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** As on the canvas "New report" grid. Animals is not drawn there; it shares the stray-dogs alert's dog. */
export const CATEGORY_ICON: Record<ReportCategory, string> = {
  streetlight: '💡',
  road: '🕳️',
  tree: '🌳',
  rubbish: '🗑️',
  drain: '💧',
  park: '🛝',
  walkway: '🚧',
  security: '🔒',
  animals: '🐕',
};

/** Submitted → Acknowledged → In progress → Resolved → Confirmed fixed; "Not fixed" reopens it. */
export const REPORT_STATUSES = ['submitted', 'acknowledged', 'in_progress', 'resolved', 'confirmed', 'reopened'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** The Management Office's teams: a label on the report, not separate logins (spec §8.3). */
export const REPORT_TEAMS = ['facilities', 'roads', 'landscape', 'cleaning', 'security'] as const;
export type ReportTeam = (typeof REPORT_TEAMS)[number];

/** Where the Management Office may move a report. Residents alone confirm or reopen it once it is resolved. */
export const MANAGEMENT_NEXT: Record<ReportStatus, ReportStatus[]> = {
  submitted: ['acknowledged', 'in_progress', 'resolved'],
  acknowledged: ['in_progress', 'resolved'],
  reopened: ['acknowledged', 'in_progress', 'resolved'],
  in_progress: ['resolved'],
  resolved: [],
  confirmed: [],
};

export type KanbanColumn = 'new' | 'acknowledged' | 'in_progress' | 'resolved';
const COLUMN: Record<ReportStatus, KanbanColumn> = {
  submitted: 'new',
  acknowledged: 'acknowledged',
  reopened: 'acknowledged', // back on someone's desk
  in_progress: 'in_progress',
  resolved: 'resolved',
  confirmed: 'resolved',
};

/** The dashboard column a report sits in. */
export function kanbanColumn(status: ReportStatus): KanbanColumn {
  return COLUMN[status];
}

const DAY = 86_400_000;

/**
 * The board's public scorecard: reports resolved this Malaysian month, their average days from submitted to resolved
 * (one decimal), and the share of residents' answers that said "fixed" across all reports. Null when there is nothing
 * to average.
 */
export function scorecard(
  rows: { created_at: string; resolved_at: string | null; fixed_yes: number; fixed_no: number }[],
  now: Date,
): { resolvedThisMonth: number; avgDaysToFix: number | null; pctSaidFixed: number | null } {
  const monthStart = startOfMytMonth(now).getTime();
  const days = rows
    .filter((r) => r.resolved_at !== null && Date.parse(r.resolved_at) >= monthStart)
    .map((r) => (Date.parse(r.resolved_at!) - Date.parse(r.created_at)) / DAY);
  const yes = rows.reduce((sum, r) => sum + r.fixed_yes, 0);
  const answers = yes + rows.reduce((sum, r) => sum + r.fixed_no, 0);
  return {
    resolvedThisMonth: days.length,
    avgDaysToFix: days.length ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : null,
    pctSaidFixed: answers ? Math.round((yes / answers) * 100) : null,
  };
}

/** After "resolved": the reporter's "not fixed", or two from Me-too neighbours, reopen the report. */
export function shouldReopen(c: { byReporter: boolean; fixed: boolean }[]): boolean {
  return c.some((a) => a.byReporter && !a.fixed) || c.filter((a) => !a.byReporter && !a.fixed).length >= 2;
}

/** The open reports the dashboard highlights: 20 or more Me toos, plus the single most supported one if it has any. */
export function hotIds(open: { id: string; metoo_count: number }[]): Set<string> {
  const hot = new Set(open.filter((r) => r.metoo_count >= 20).map((r) => r.id));
  const top = open.reduce<(typeof open)[number] | null>((best, r) => (best && best.metoo_count >= r.metoo_count ? best : r), null);
  if (top && top.metoo_count > 0) hot.add(top.id);
  return hot;
}

/** "Already reported nearby?" looks this far for open reports of the same category (nearby_open_reports). */
export const DUPLICATE_RADIUS_M = 150;
