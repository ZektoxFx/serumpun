import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Lang } from '@/lib/i18n';
import { createClient } from './server';

export type Role = 'resident' | 'management';

export type SessionProfile = {
  id: string;
  township_id: string;
  full_name: string;
  neighbourhood: string;
  role: Role;
  status: 'pending' | 'verified' | 'rejected';
  lang: Lang;
};

/** Where a signed-in user starts: the dashboard for the Management Office, Home for everyone else. */
export function homePath(role: Role | undefined) {
  return role === 'management' ? '/dashboard' : '/home';
}

/**
 * The signed-in user's profile; null when signed out, or signed in without a profile.
 * Cached per render, so a layout and its page share one lookup. Every page and action checks this itself:
 * proxy.ts only redirects, it is not the gate.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();
  // Verifies the JWT signature (keys cached by the client), so a forged cookie never gets this far.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, township_id, full_name, neighbourhood, role, status, lang')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`profile lookup failed: ${error.message}`);
  return profile;
});

/** A verified user (resident or Management Office). Visitors go to the landing page, pending users to Home and its banner. */
export async function requireVerified(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/');
  if (profile.status !== 'verified') redirect('/home');
  return profile;
}

/** A Management Office user. Residents are sent to Home, visitors to the landing page. */
export async function requireManagement(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/');
  if (profile.role !== 'management' || profile.status !== 'verified') redirect('/home');
  return profile;
}
