import type { MessageKey } from '@/lib/i18n';
import type { LatLng } from './geo';
import { mytDate, startOfMytMonth } from './time';

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

/** The resolved column shows this many of the latest fixes; the KPIs count them all. */
export const RESOLVED_SHOWN = 20;

/**
 * The dashboard's four columns. Each is ordered by Me too, then the longest waiting first; the resolved column keeps
 * only the RESOLVED_SHOWN most recent reports.
 */
export function groupForKanban<T extends { id: string; status: ReportStatus; metoo_count: number; created_at: string }>(
  reports: readonly T[],
): Record<KanbanColumn, T[]> {
  const columns: Record<KanbanColumn, T[]> = { new: [], acknowledged: [], in_progress: [], resolved: [] };
  for (const r of reports) columns[kanbanColumn(r.status)].push(r);
  const age = (r: T) => Date.parse(r.created_at);
  columns.resolved = columns.resolved.sort((a, b) => age(b) - age(a)).slice(0, RESOLVED_SHOWN);
  for (const column of Object.values(columns)) column.sort((a, b) => b.metoo_count - a.metoo_count || age(a) - age(b));
  return columns;
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

/** A row of the public_reports view. The view never says who sent a report. */
export type PublicReport = {
  id: string;
  ref_no: number;
  category: ReportCategory;
  title: string;
  description: string | null;
  lat: number;
  lng: number;
  location_text: string | null;
  photo_path: string | null;
  is_private: boolean;
  status: ReportStatus;
  team: ReportTeam | null;
  metoo_count: number;
  created_at: string;
  resolved_at: string | null;
  is_mine: boolean;
  has_metoo: boolean;
  fixed_yes: number;
  fixed_no: number;
};
export const PUBLIC_REPORT_COLUMNS =
  'id, ref_no, category, title, description, lat, lng, location_text, photo_path, is_private, status, team, metoo_count, created_at, resolved_at, is_mine, has_metoo, fixed_yes, fixed_no';

/** A row of the public_report_updates view: a step or a message, never who wrote it. */
export type ReportUpdate = {
  status: ReportStatus;
  message: string | null;
  photo_path: string | null;
  created_at: string;
  by_management: boolean;
};

/** Still waiting for a fix: everything before "resolved", and a reopened report. */
export function isOpenReport(status: ReportStatus): boolean {
  return status !== 'resolved' && status !== 'confirmed';
}

/** Same rule as metoo_report: someone else's open, public report. */
export function canMeToo(r: { is_private: boolean; is_mine: boolean; status: ReportStatus }): boolean {
  return !r.is_private && !r.is_mine && isOpenReport(r.status);
}

/** Same rule as confirm_report_fix: the reporter or a Me-too neighbour, while the report is resolved. */
export function canAnswerFix(r: { is_mine: boolean; has_metoo: boolean; status: ReportStatus }): boolean {
  return r.status === 'resolved' && (r.is_mine || r.has_metoo);
}

/** Whole Malaysian calendar days since the report was sent: 0 on the day itself. */
export function openDays(createdAt: string, now: Date): number {
  return Math.round((Date.parse(mytDate(now)) - Date.parse(mytDate(new Date(createdAt)))) / DAY);
}

/** How long a fix took, for "fixed in 6 hours": whole hours (at least 1) within a day, then whole days. */
export function fixTime(createdAt: string, resolvedAt: string): { unit: 'hours' | 'days'; n: number } {
  const hours = (Date.parse(resolvedAt) - Date.parse(createdAt)) / 3_600_000;
  return hours < 23.5 ? { unit: 'hours', n: Math.max(1, Math.round(hours)) } : { unit: 'days', n: Math.round(hours / 24) };
}

export type TimelineStep = {
  status: ReportStatus;
  /** When it happened; null for a step still to come. */
  at: string | null;
  state: 'done' | 'current' | 'next';
  /** The Management Office's messages and photos at this step. */
  notes: { message: string | null; photo_path: string | null; at: string; by_management: boolean }[];
};

// What can still happen after each status. After a reopen the office may skip straight to a fix, so only that and the
// residents' answer are certain.
const STILL_TO_COME: Record<ReportStatus, ReportStatus[]> = {
  submitted: ['acknowledged', 'in_progress', 'resolved', 'confirmed'],
  acknowledged: ['in_progress', 'resolved', 'confirmed'],
  in_progress: ['resolved', 'confirmed'],
  reopened: ['resolved', 'confirmed'],
  resolved: ['confirmed'],
  confirmed: [],
};

/**
 * The report's timeline: each change of status in the order it happened (a row at the same status is a message under
 * that step, not a new step), the latest one current, then the steps still to come. A confirmed report is all done.
 */
export function buildTimeline(status: ReportStatus, updates: readonly ReportUpdate[]): TimelineStep[] {
  const steps: TimelineStep[] = [];
  for (const u of [...updates].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) {
    if (steps.at(-1)?.status !== u.status) steps.push({ status: u.status, at: u.created_at, state: 'done', notes: [] });
    if (u.message || u.photo_path) {
      steps.at(-1)!.notes.push({ message: u.message, photo_path: u.photo_path, at: u.created_at, by_management: u.by_management });
    }
  }
  const last = steps.at(-1);
  if (last && status !== 'confirmed') last.state = 'current';
  return [...steps, ...STILL_TO_COME[status].map((s) => ({ status: s, at: null, state: 'next' as const, notes: [] }))];
}

/**
 * The Issue Board's order: open reports first, most Me toos first (the longest waiting first on a tie), then the latest
 * fixes, at most `finishedLimit` of them.
 */
export function boardOrder<T extends { status: ReportStatus; metoo_count: number; created_at: string; resolved_at: string | null }>(
  rows: readonly T[],
  finishedLimit = 10,
): T[] {
  const open = rows
    .filter((r) => isOpenReport(r.status))
    .sort((a, b) => b.metoo_count - a.metoo_count || Date.parse(a.created_at) - Date.parse(b.created_at));
  // shortcut: older fixes drop off the board instead of paging; the scorecard still counts them. Page if residents ask.
  const finished = rows
    .filter((r) => !isOpenReport(r.status))
    .sort((a, b) => Date.parse(b.resolved_at ?? '') - Date.parse(a.resolved_at ?? ''))
    .slice(0, finishedLimit);
  return [...open, ...finished];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `value` can be a report or alert id (Postgres refuses anything else with an error, not "no rows"). */
export const isUuid = (value: string) => UUID.test(value);

/**
 * What a "Send to Management Office" link from a map alert pre-fills (`/reports/new?category=…&lat=…&lng=…&alert=…`).
 * Anyone can craft the link, so each part is checked and dropped when it is not a real category, place or id; the RPC
 * checks them all again.
 */
export function parsePrefill(params: Record<string, string | string[] | undefined>): {
  category: ReportCategory | null;
  at: LatLng | null;
  alertId: string | null;
} {
  const one = (name: string) => (typeof params[name] === 'string' ? (params[name] as string) : '');
  const category = REPORT_CATEGORIES.find((c) => c === one('category')) ?? null;
  const [lat, lng] = [one('lat'), one('lng')].map((v) => (v.trim() === '' ? NaN : Number(v)));
  const at = Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null; // NaN fails both comparisons
  return { category, at, alertId: isUuid(one('alert')) ? one('alert') : null };
}

// The `raise exception` codes of create_report, metoo_report, confirm_report_fix and update_report_status (0003_reports.sql).
const ERROR_KEYS: Record<string, MessageKey> = {
  not_verified: 'common.pendingCantAct',
  bad_category: 'report.error.category',
  bad_title: 'report.error.title',
  out_of_area: 'map.error.outOfArea',
  bad_photo: 'map.error.photo',
  not_found: 'report.error.notFound',
  own_report: 'report.error.ownReport',
  not_open: 'report.error.notOpen',
  not_management: 'map.error.notManagement',
  bad_status: 'report.error.status',
  bad_team: 'report.error.team',
  bad_answer: 'report.error.answer',
  not_affected: 'report.error.notAffected',
  not_resolved: 'report.error.notResolved',
};

/** What to tell the user when a report RPC fails (`error.message` is the code it raised). Anything else is generic. */
export function reportErrorKey(message: string | undefined): MessageKey {
  return message !== undefined && Object.hasOwn(ERROR_KEYS, message) ? ERROR_KEYS[message] : 'common.error';
}
