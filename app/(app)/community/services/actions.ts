'use server';

import { serviceErrorKey } from '@/lib/domain/community';
import type { MessageKey } from '@/lib/i18n';
import { requireVerified } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** What the service form gets back: the new service's id, or a message key. Null before the first submit. */
export type ServiceActionResult = { ok: true; id?: string } | { ok: false; error: MessageKey } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '');

/**
 * A new offer or request. create_service checks the caller, kind, category, title and date again itself, and keeps
 * only the fields of the kind: this action only passes the form on.
 */
export async function createService(formData: FormData): Promise<ServiceActionResult> {
  await requireVerified();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_service', {
    p_kind: field(formData, 'kind'),
    p_category: field(formData, 'category'),
    p_title: field(formData, 'title'),
    p_description: field(formData, 'description'),
    p_price_text: field(formData, 'price'),
    p_availability_text: field(formData, 'availability'),
    p_budget_text: field(formData, 'budget'),
    p_needed_by: field(formData, 'neededBy') || null,
  });
  if (error) {
    const key = serviceErrorKey(error.message);
    if (key === 'common.error') console.error(`create_service failed: ${error.message}`);
    return { ok: false, error: key };
  }
  return { ok: true, id: String(data) };
}
