'use server';

import { refresh } from 'next/cache';
import { alertErrorKey } from '@/lib/domain/alerts';
import { reportErrorKey } from '@/lib/domain/reports';
import type { MessageKey } from '@/lib/i18n';
import { seedAll } from '@/lib/seed';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireManagement } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** What the dashboard's forms get back: done, or a message key. Null before the first submit. */
export type DashboardResult = { ok: true } | { ok: false; error: MessageKey } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '');

// Every action checks the Management Office itself, and the RPCs check it again (with the township) on their own.
function failed(what: string, error: { message: string }, key: MessageKey): DashboardResult {
  if (key === 'common.error') console.error(`${what} failed: ${error.message}`);
  return { ok: false, error: key };
}

/** A step, team, message or after-photo on a report. update_report_status tells the reporter and its Me-too neighbours. */
export async function updateReport(formData: FormData): Promise<DashboardResult> {
  await requireManagement();
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_report_status', {
    p_report: field(formData, 'id'),
    p_status: field(formData, 'status'),
    p_team: field(formData, 'team') || null,
    p_message: field(formData, 'message'),
    p_photo_path: field(formData, 'photo') || null, // uploaded by the form just before; the RPC checks it is the caller's
  });
  if (error) return failed('update_report_status', error, reportErrorKey(error.message));
  refresh();
  return { ok: true };
}

const RESIDENT_ERRORS: Record<string, MessageKey> = {
  not_management: 'map.error.notManagement',
  not_found: 'dashboard.residents.gone',
};

/** Approves (`verified`) or rejects a pending resident. set_resident_status tells them. */
export async function decideResident(formData: FormData): Promise<DashboardResult> {
  await requireManagement();
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_resident_status', {
    p_profile: field(formData, 'id'),
    p_status: field(formData, 'status'),
  });
  if (error) {
    return failed('set_resident_status', error, Object.hasOwn(RESIDENT_ERRORS, error.message) ? RESIDENT_ERRORS[error.message] : 'common.error');
  }
  refresh();
  return { ok: true };
}

/** Posts an announcement to the township, then tells every resident in it (Home shows it from Task 17). */
export async function postAnnouncement(formData: FormData): Promise<DashboardResult> {
  const office = await requireManagement();
  const title = field(formData, 'title').trim();
  const body = field(formData, 'body').trim();
  if (!title || !body) return { ok: false, error: 'signup.error.required' };
  const supabase = await createClient();
  // Row-level security keeps this to the office's own township; the column grants let only title and body through.
  const { error } = await supabase.from('announcements').insert({ title, body });
  if (error) return failed('announcement', error, 'common.error');

  // notify() runs on the service role only (residents could otherwise message anyone), after requireManagement above.
  const admin = createAdminClient();
  const { data: residents, error: peopleError } = await admin
    .from('profiles')
    .select('id')
    .eq('township_id', office.township_id)
    .eq('role', 'resident')
    .neq('status', 'rejected');
  const { error: notifyError } = peopleError
    ? { error: peopleError }
    : await admin.rpc('notify', {
        p_users: residents.map((r) => r.id),
        p_type: 'announcement',
        p_title_key: 'notify.announcement',
        p_body: title,
        p_link: '/home',
      });
  if (notifyError) console.error(`announcement posted, but residents were not notified: ${notifyError.message}`);
  refresh();
  return { ok: true };
}

/** Pins road works, a water cut or the like to the township's map. It stays until removed. */
export async function addPin(formData: FormData): Promise<DashboardResult> {
  await requireManagement();
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_official_pin', {
    p_type: field(formData, 'type'),
    p_severity: field(formData, 'severity'),
    p_lat: Number(field(formData, 'lat')),
    p_lng: Number(field(formData, 'lng')),
    p_note: field(formData, 'note'),
  });
  if (error) return failed('create_official_pin', error, alertErrorKey(error.message));
  refresh();
  return { ok: true };
}

/** Takes an official pin off the map. A second click changes nothing. */
export async function removePin(formData: FormData): Promise<DashboardResult> {
  await requireManagement();
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_official_pin', { p_alert: field(formData, 'id') });
  if (error) return failed('remove_official_pin', error, alertErrorKey(error.message));
  refresh();
  return { ok: true };
}

/**
 * "Reset demo data": the same rebuild as `npm run db:seed` (seedAll), so the demo looks fresh before a recording or a
 * pitch. It also deletes visitors' accounts and every uploaded photo.
 */
export async function resetDemoData(): Promise<DashboardResult> {
  await requireManagement();
  try {
    await seedAll(createAdminClient(), new Date());
  } catch (error) {
    console.error(`demo reset failed: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false, error: 'common.error' };
  }
  refresh();
  return { ok: true };
}
