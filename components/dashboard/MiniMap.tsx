'use client';

import 'leaflet/dist/leaflet.css';
import '@/components/map/map.css';
import type * as Leaflet from 'leaflet';
import { useEffect, useRef } from 'react';

/**
 * A small still map with a pin on one spot (the dashboard's report panel). Leaflet needs `window`, so it is loaded in
 * the effect, never during server rendering. Not interactive: the place is the point, the panel says the rest.
 */
export function MiniMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);
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
      L.marker([lat, lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'map-pin map-pin--high',
          html: '<span class="map-pin-head"><span class="map-pin-dot"></span></span>',
          iconSize: [44, 46],
          iconAnchor: [22, 46],
        }),
      }).addTo(map);
    })();
    return () => {
      gone = true;
      map?.remove();
    };
  }, [lat, lng]);
  return <div ref={box} role="img" aria-label={label} className="isolate h-40 overflow-hidden rounded-xl border border-line" />;
}
