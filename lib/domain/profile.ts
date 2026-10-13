import type { MessageKey } from '@/lib/i18n';

/** "Aisyah Rahman" -> "Aisyah": what the greeting calls a resident. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

/** The line under a resident's name. (A rejected applicant never reaches a page that shows it.) */
export function statusKey(profile: { role: string; status: string }): MessageKey {
  if (profile.role === 'management') return 'role.management';
  return profile.status === 'verified' ? 'home.status.verified' : 'home.status.pending';
}
