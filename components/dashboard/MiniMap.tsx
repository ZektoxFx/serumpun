'use client';

import 'leaflet/dist/leaflet.css';
import '@/components/map/map.css';
import type * as Leaflet from 'leaflet';
import { useEffect, useRef } from 'react';
import type { LatLng } from '@/lib/domain/geo';

/**
 * A small still map with a pin on one spot (the dashboard's report panel, Book a Court's court). Leaflet needs `window`,
 * so it is loaded in the effect, never during server rendering. Not interactive: the place is the point, the panel says
 * the rest. `also` adds a plain marker (the other court) and `me` the blue "you" dot; the map then fits them all in.
 */
export function MiniMap({
  lat,
  lng,
  label,
  also = null,
  me = null,
  pin = 'map-pin--high',
  className = 'h-40 rounded-xl border border-line',
}: {
  lat: number;
  lng: number;
  label: string;
  also?: LatLng | null;
  me?: LatLng | null;
  pin?: 'map-pin--high' | 'map-pin--place';
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Plain numbers for the effect: a new object every render would rebuild the map each time.
  const [alsoLat, alsoLng, meLat, meLng] = [also?.lat, also?.lng, me?.lat, me?.lng];
  useEffect(() => {
    let map: Leaflet.Map | undefined;
    let gone = false;
    void (async () => {
      const [L, { addStreetMap }] = await Promise.all([import('leaflet'), import('@/components/map/LiveMap')]);
      if (gone || !box.current) return;
      map = L.map(box.current, {
        center: [lat, lng],
        zoom: 17,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
      });
      addStreetMap(map);
      const still = { interactive: false, keyboard: false };
      if (alsoLat !== undefined && alsoLng !== undefined) {
        L.marker([alsoLat, alsoLng], { ...still, icon: L.divIcon({ className: 'map-court', iconSize: [14, 14] }) }).addTo(map);
      }
      L.marker([lat, lng], {
        ...still,
        zIndexOffset: 1000, // over the other court, which stands right beside it
        icon: L.divIcon({
          className: `map-pin ${pin}`,
          html: '<span class="map-pin-head"><span class="map-pin-dot"></span></span>',
          iconSize: [44, 46],
          iconAnchor: [22, 46],
        }),
      }).addTo(map);
      if (meLat !== undefined && meLng !== undefined) {
        L.marker([meLat, meLng], { ...still, icon: L.divIcon({ className: 'map-me', iconSize: [18, 18] }) }).addTo(map);
        // Room at the top for the pin, which stands 46 px above its spot.
        map.fitBounds(L.latLngBounds([lat, lng], [meLat, meLng]), { paddingTopLeft: [24, 52], paddingBottomRight: [24, 16], maxZoom: 17 });
      }
    })();
    return () => {
      gone = true;
      map?.remove();
    };
  }, [lat, lng, alsoLat, alsoLng, meLat, meLng, pin]);
  return <div ref={box} role="img" aria-label={label} className={`isolate overflow-hidden ${className}`} />;
}
