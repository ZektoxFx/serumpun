'use server';

import { refresh } from 'next/cache';
import { unitErrorKey } from '@/lib/domain/units';
import type { MessageKey } from '@/lib/i18n';
import { requireManagement } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

type Answer = { error?: MessageKey };

// Each action checks the Management Office itself, and the RPC checks it again, with the card's township.
async function office(rpc: 'suspend_card' | 'lift_card_suspension', args: Record<string, unknown>): Promise<Answer> {
  await requireManagement();
  const { error } = await (await createClient()).rpc(rpc, args);
  if (error) {
    const key = unitErrorKey(error.message);
    if (key === 'common.error') console.error(`${rpc} failed: ${error.message}`);
    return { error: key };
  }
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
