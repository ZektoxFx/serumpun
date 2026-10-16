import type { NextRequest } from 'next/server';
import { MY_BOOKING_COLUMNS, toIcs, type MyBooking } from '@/lib/domain/booking';
import { isUuid } from '@/lib/domain/reports';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** Add to calendar: the reader's own booking, while it stands, as an .ics file. */
export async function GET(_request: NextRequest, ctx: RouteContext<'/book/[id]/ics'>) {
  const profile = await requireMember();
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response(null, { status: 404 });
  const supabase = await createClient();
  const { data: b, error } = await supabase
    .from('bookings')
    .select(MY_BOOKING_COLUMNS)
    .eq('id', id)
    .eq('user_id', profile.id)
    .eq('status', 'booked')
    .maybeSingle()
    .overrideTypes<MyBooking, { merge: false }>();
  if (error) throw new Error(`booking lookup failed: ${error.message}`);
  if (!b) return new Response(null, { status: 404 });
  const ics = toIcs({ title: b.facility.court_label, location: b.facility.place_name, date: b.date, hour: b.start_hour, uid: b.id });
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="booking-${b.id.slice(0, 6)}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
