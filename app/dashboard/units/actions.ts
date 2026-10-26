'use server';

import { refresh } from 'next/cache';
import { formatCode, hashCode, newCode } from '@/lib/card/codes';
import { normalizePhone } from '@/lib/domain/phone';
import { unitErrorKey } from '@/lib/domain/units';
import type { MessageKey } from '@/lib/i18n';
import { requireManagement } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

type Answer = { error?: MessageKey };

// A refusal is told in words; anything unexpected is logged, and only its message.
function refused(rpc: string, message: string): { error: MessageKey } {
  const key = unitErrorKey(message);
  if (key === 'common.error') console.error(`${rpc} failed: ${message}`);
  return { error: key };
}

// Each action checks the Management Office itself, and the RPC checks it again, with the card's township.
async function office(rpc: 'suspend_card' | 'lift_card_suspension', args: Record<string, unknown>): Promise<Answer> {
  await requireManagement();
  const { error } = await (await createClient()).rpc(rpc, args);
  if (error) return refused(rpc, error.message);
  refresh();
  return {};
}

/** Suspends a card, with the reason everyone on it is told. Suspending it again only changes the reason. */
export async function suspendCard(card: string, reason: string): Promise<Answer> {
  // It arrives from the browser: anything but text goes on as empty, and suspend_card refuses that as bad_reason.
  return office('suspend_card', { p_card: card, p_reason: typeof reason === 'string' ? reason.trim() : '' });
}

/** Lifts a card's suspension, and lift_card_suspension tells everyone on it. */
export async function liftSuspension(card: string): Promise<Answer> {
  return office('lift_card_suspension', { p_card: card });
}

/** The home's record as the office has just checked it at the counter, and the two checks it made. */
export type UnitRecord = { name: string; tenure: 'owner' | 'tenant'; phone: string; leaseEnd: string | null; icSeen: boolean; papersSeen: boolean };

/**
 * Saves a home's record and gives it a fresh code that cancels the one it had. The code is made here and only its hash goes
 * to the database; it exists in this answer alone, so it is never logged, kept or put in a URL. The office hands it over once,
 * on the printed slip.
 */
export async function giveCode(unit: string, record: UnitRecord): Promise<{ code: string; expiresAt: string } | { error: MessageKey }> {
  await requireManagement();
  // It arrives from the browser: only a real `true` is a tick, and the number must be a mobile that can get an SMS code.
  if (record.icSeen !== true || record.papersSeen !== true) return { error: 'units.error.not_checked' };
  const phone = normalizePhone(record.phone);
  if (!phone) return { error: 'phone.error.format' };
  const code = newCode();
  const { data, error } = await (await createClient()).rpc('give_unit_code', {
    p_unit: unit,
    p_name: typeof record.name === 'string' ? record.name.trim() : '', // give_unit_code refuses an empty one as bad_name
    p_tenure: record.tenure,
    p_phone: phone,
    p_lease_end: record.leaseEnd, // null for an owner; the database refuses a tenant's missing or past one as bad_lease
    p_code_hash: await hashCode(code),
  });
  if (error) return refused('give_unit_code', error.message);
  refresh();
  return { code: formatCode(code), expiresAt: new Date(data).toISOString() };
}
