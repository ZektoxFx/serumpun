'use server';

import { refresh } from 'next/cache';
import { reportErrorKey } from '@/lib/domain/reports';
import type { MessageKey } from '@/lib/i18n';
import { requireVerified } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** What the report forms get back: the new report's id, or a message key. Null before the first submit. */
export type ReportActionResult = { ok: true; id?: string } | { ok: false; error: MessageKey } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '');

// The RPCs check the caller, township, category, place, photo and report again themselves: these actions only pass the
// form on.
function failed(rpc: string, error: { message: string }): ReportActionResult {
  const key = reportErrorKey(error.message);
  if (key === 'common.error') console.error(`${rpc} failed: ${error.message}`);
  return { ok: false, error: key };
}

/** Sends a report to the Management Office. The form has already uploaded its photo, if any. */
export async function createReport(formData: FormData): Promise<ReportActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_report', {
    p_category: field(formData, 'category'),
    p_title: field(formData, 'title'),
    p_description: field(formData, 'description'),
    p_lat: Number(field(formData, 'lat')),
    p_lng: Number(field(formData, 'lng')),
    p_location_text: field(formData, 'location') || null,
    p_photo_path: field(formData, 'photo') || null,
    p_is_private: formData.get('private') === 'on',
    p_source_alert: field(formData, 'alert') || null,
  });
  if (error) return failed('create_report', error);
  return { ok: true, id: String(data) };
}

/** "Me too" on a neighbour's open report. A second tap changes nothing. */
export async function meToo(formData: FormData): Promise<ReportActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { error } = await supabase.rpc('metoo_report', { p_report: field(formData, 'id') });
  if (error) return failed('metoo_report', error);
  refresh(); // the page shows the new count and "Following" at once
  return { ok: true };
}

/** "Fixed" or "Not fixed" on a resolved report, from its reporter or a Me-too neighbour. */
export async function answerFix(formData: FormData): Promise<ReportActionResult> {
  await requireVerified();
  const answer = field(formData, 'fixed');
  const supabase = await createClient();
  const { error } = await supabase.rpc('confirm_report_fix', {
    p_report: field(formData, 'id'),
    p_fixed: answer === 'yes' ? true : answer === 'no' ? false : null,
  });
  if (error) return failed('confirm_report_fix', error);
  refresh();
  return { ok: true };
}
