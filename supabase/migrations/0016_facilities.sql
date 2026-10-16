-- Facilities (feedback, 17 Oct): Book a Court becomes Facilities, so the gym, a BBQ pit and a function room are booked
-- like the courts and the hall (1-hour slots, the same household limit). Only the list of kinds changes; the column keeps
-- its first name, sport. lib/domain/booking.ts lists the same kinds.

alter table public.facilities drop constraint facilities_sport_check;
alter table public.facilities add constraint facilities_sport_check
  check (sport in ('badminton', 'futsal', 'tennis', 'hall', 'gym', 'bbq', 'room'));
