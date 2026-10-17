import type { Metadata } from 'next';
import { MapScreen } from '@/components/map/MapScreen';
import type { WalkPlace } from '@/components/map/SafeWalkPanel';
import { PUBLIC_ALERT_COLUMNS, type PublicAlert } from '@/lib/domain/alerts';
import { FACILITY_COLUMNS, SPORT_ICON, type Facility } from '@/lib/domain/booking';
import { PUBLIC_EMERGENCY_COLUMNS, type PublicEmergency } from '@/lib/domain/emergency';
import { PLACES, neighbourhoodCentre } from '@/lib/domain/places';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'nav.map') };
}

export default async function MapPage({ searchParams }: PageProps<'/map'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const { walkTo } = await searchParams;
  const supabase = await createClient();
  const [alerts, courts, emergencies] = await Promise.all([
    // The privacy view: live pins of the caller's own township, never who posted them. The screen keeps it fresh.
    supabase.from('public_alerts').select(PUBLIC_ALERT_COLUMNS).overrideTypes<PublicAlert[], { merge: false }>(),
    supabase.from('facilities').select(FACILITY_COLUMNS).order('court_label').overrideTypes<Facility[], { merge: false }>(),
    // Live emergencies (where and what, never who): a red 2 km circle each.
    supabase.from('public_emergencies').select(PUBLIC_EMERGENCY_COLUMNS).overrideTypes<PublicEmergency[], { merge: false }>(),
  ]);
  for (const { error } of [alerts, courts, emergencies]) if (error) throw new Error(`map lookup failed: ${error.message}`);
  const place = (label: 'place.mall' | 'place.centralPark', icon: string): WalkPlace => {
    const { lat, lng } = PLACES.find((p) => p.label === label)!;
    return { lat, lng, label: t(lang, label), icon };
  };
  // Safe Walk's places (canvas): the mall, the park and the courts. Book a Court's Directions asks for one court.
  const [court] = courts.data!;
  const places = [
    place('place.mall', '🛍️'),
    place('place.centralPark', '🌳'),
    ...(court ? [{ lat: court.lat, lng: court.lng, label: court.place_name, icon: '🏸' }] : []),
  ];
  const target = courts.data!.find((c) => c.id === walkTo);

  return (
    <MapScreen
      townshipId={profile.township_id}
      township={profile.township.name}
      centre={{ lat: profile.township.centre_lat, lng: profile.township.centre_lng }}
      canPost={profile.status === 'verified'}
      initialAlerts={alerts.data!}
      initialEmergencies={emergencies.data!}
      home={neighbourhoodCentre(profile.neighbourhood)}
      places={places}
      walkTo={target ? { lat: target.lat, lng: target.lng, label: target.court_label, icon: SPORT_ICON[target.sport] } : null}
    />
  );
}
