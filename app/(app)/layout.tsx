import type { ReactNode } from 'react';
import { BottomNav } from '@/components/app/BottomNav';
import { EmergencyPopup } from '@/components/app/EmergencyPopup';
import { neighbourhoodCentre } from '@/lib/domain/places';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

/**
 * Every resident page: a banner while the Management Office has not verified the user, the phone-width column, and the
 * bottom navigation. Each page still calls requireMember itself: a layout does not stop its page from rendering, and
 * rejected applicants must not get one.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await requireMember();
  const lang = await getLang();
  // The resident's neighbourhood (the app never knows a home): who an emergency alerts, and where one is sent from
  // when the phone gives no location in the township.
  const home = neighbourhoodCentre(profile.neighbourhood);
  return (
    <>
      {profile.status === 'pending' && (
        <div role="status" className="bg-tint-amber text-amber-text">
          <p className="mx-auto max-w-md px-4 py-3 text-sm font-bold">{t(lang, 'pending.banner')}</p>
        </div>
      )}
      {/* pb-24 keeps the last of a page clear of the fixed bottom bar and the Create button standing above it. */}
      <div className="mx-auto w-full max-w-md pb-24">{children}</div>
      <BottomNav fallback={home ?? { lat: profile.township.centre_lat, lng: profile.township.centre_lng }} />
      <EmergencyPopup townshipId={profile.township_id} home={home} />
    </>
  );
}
