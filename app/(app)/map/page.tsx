import type { Metadata } from 'next';
import { MapScreen } from '@/components/map/MapScreen';
import { PUBLIC_ALERT_COLUMNS, type PublicAlert } from '@/lib/domain/alerts';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'nav.map') };
}

export default async function MapPage() {
  const profile = await requireMember();
  const supabase = await createClient();
  // The privacy view: live pins of the caller's own township, never who posted them. The screen keeps it fresh.
  const { data, error } = await supabase
    .from('public_alerts')
    .select(PUBLIC_ALERT_COLUMNS)
    .overrideTypes<PublicAlert[], { merge: false }>();
  if (error) throw new Error(`alerts lookup failed: ${error.message}`);

  return (
    <MapScreen
      townshipId={profile.township_id}
      township={profile.township.name}
      centre={{ lat: profile.township.centre_lat, lng: profile.township.centre_lng }}
      canPost={profile.status === 'verified'}
      initialAlerts={data}
    />
  );
}
