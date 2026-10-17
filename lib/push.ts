import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';

/** What a phone shows, and where tapping it goes (public/sw.js). */
export type PushMessage = { title: string; body: string; url: string; tag: string };

/**
 * Sends each user's message to every phone they turned alerts on for (Me › Emergency alerts), and forgets phones the
 * push service no longer knows. Sends nothing without the VAPID keys. `admin` is the service-role client.
 */
export async function pushTo(admin: SupabaseClient, messages: Map<string, PushMessage>): Promise<number> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey || messages.size === 0) return 0;
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, user_id, p256dh, auth')
    .in('user_id', [...messages.keys()]);
  if (error) throw new Error(`push subscriptions lookup failed: ${error.message}`);
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    data.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(messages.get(s.user_id)), {
          vapidDetails: { subject: 'https://serumpun-six.vercel.app', publicKey, privateKey },
          TTL: 3600, // an alert an hour late is no use
          urgency: 'high',
        });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.endpoint); // the phone turned alerts off or the app was removed
        else console.error(`push failed (${status ?? 'no status'})`);
      }
    }),
  );
  if (gone.length) await admin.from('push_subscriptions').delete().in('endpoint', gone);
  return sent;
}
