/**
 * Where tapping a notification may go: an in-app path, or null. Next's redirect() follows any URL, so this is what
 * stops a notification from sending a resident off-site. Same rule as the check on notifications.link in 0001_core.sql
 * ("/" or "/x", never "//host" or "/\host"), plus no control characters, which could split a redirect header.
 */
export function internalPath(link: unknown): string | null {
  return typeof link === 'string' && /^\/(?![/\\])[^\x00-\x1f\x7f]*$/.test(link) ? link : null;
}

/** What the bell's badge says: nothing for none, the count up to 9, then "9+". */
export function unreadBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? '9+' : String(count);
}
