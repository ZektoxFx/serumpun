/** The report categories (spec §8.2). Task 7 adds statuses and the Issue Board logic. */
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
