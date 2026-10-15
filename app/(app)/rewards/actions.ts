'use server';

import { refresh } from 'next/cache';
import { rewardErrorKey } from '@/lib/domain/points';
import type { MessageKey } from '@/lib/i18n';
import { requireVerified } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** What the reward buttons get back: the voucher's id, or a message key. Null before the first press. */
export type RewardResult = { ok: true; id?: string } | { ok: false; error: MessageKey } | null;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '');

function failed(rpc: string, error: { message: string }): RewardResult {
  const key = rewardErrorKey(error.message);
  if (key === 'common.error') console.error(`${rpc} failed: ${error.message}`);
  return { ok: false, error: key };
}

/**
 * Spends points on a reward. `request` is the button's one id for this press: sent twice (a double tap), redeem_reward
 * returns the first voucher instead of making a second.
 */
export async function redeem(formData: FormData): Promise<RewardResult> {
  await requireVerified();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('redeem_reward', { p_reward: field(formData, 'id'), p_request: field(formData, 'request') });
  if (error) return failed('redeem_reward', error);
  return { ok: true, id: String(data) };
}

/** "Slide to use": marks the resident's voucher used, once. */
export async function markVoucherUsed(formData: FormData): Promise<RewardResult> {
  await requireVerified();
  const supabase = await createClient();
  const { error } = await supabase.rpc('use_voucher', { p_redemption: field(formData, 'id') });
  if (error) return failed('use_voucher', error);
  refresh();
  return { ok: true };
}
