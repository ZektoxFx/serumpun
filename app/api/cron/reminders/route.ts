import type { NextRequest } from 'next/server';
import { dueToday, type BorrowStatus } from '@/lib/domain/community';
import { mytDateTime } from '@/lib/domain/events';
import { mytDate } from '@/lib/domain/time';
import { createAdminClient } from '@/lib/supabase/admin';

type Borrow = { borrower_id: string; listing_id: string; to_date: string; status: BorrowStatus; listing: { title: string; owner_id: string } };

/**
 * Return-day reminders: Vercel Cron calls this every day at 8 am in Malaysia (vercel.ts), and the borrower and the owner
 * of everything picked up and due back today each get a notification. Only a caller with the CRON_SECRET Vercel was
 * given gets in. A second run on the same day (a retry, or `vercel crons run`) sends nothing new.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const admin = createAdminClient();
  const now = new Date();
  const [borrows, sent] = await Promise.all([
    admin
      .from('borrow_requests')
      .select('borrower_id, listing_id, to_date, status, listing:listings(title, owner_id)')
      .eq('status', 'picked_up')
      .overrideTypes<Borrow[], { merge: false }>(),
    admin
      .from('notifications')
      .select('user_id, link')
      .in('title_key', ['notify.borrow.dueBorrower', 'notify.borrow.dueOwner'])
      .gte('created_at', mytDateTime(mytDate(now), '00:00')!.toISOString()),
  ]);
  for (const { error } of [borrows, sent]) if (error) throw new Error(`reminders lookup failed: ${error.message}`);
  const already = new Set(sent.data!.map((n) => `${n.user_id} ${n.link}`));

  let count = 0;
  for (const b of dueToday(borrows.data!, now)) {
    const link = `/community/share/${b.listing_id}`;
    const people: [string, string][] = [
      [b.borrower_id, 'notify.borrow.dueBorrower'],
      [b.listing.owner_id, 'notify.borrow.dueOwner'],
    ];
    for (const [user, key] of people) {
      if (already.has(`${user} ${link}`)) continue;
      const { error } = await admin.rpc('notify', { p_users: [user], p_type: 'borrow', p_title_key: key, p_body: b.listing.title, p_link: link });
      if (error) throw new Error(`reminder failed: ${error.message}`);
      count++;
    }
  }
  return Response.json({ sent: count });
}
