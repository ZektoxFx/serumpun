'use client';

import 'leaflet/dist/leaflet.css';
import '@/components/map/map.css';
import * as L from 'leaflet';
import { useEffect, useEffectEvent, useRef } from 'react';
import { addStreetMap } from '@/components/map/LiveMap';
import type { LatLng } from '@/lib/domain/geo';
import { useT } from '@/lib/i18n';

/**
 * Where something is: a small map with the pin held in its middle. Dragging the map, the arrow keys or a tap on
 * another spot move the place under the pin, and each move is reported through `onChange`. `value` null means nothing
 * chosen yet (the map opens on `centre`). When the parent changes `value` itself (a GPS fix arriving) the map follows
 * without reporting it back as the resident's choice. Client only: load it with next/dynamic and `ssr: false`.
 */
export function LocationPicker({
  value,
  onChange,
  centre,
}: {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
  centre: LatLng;
}) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const opening = useRef(value ?? centre);
  const moved = useEffectEvent((place: LatLng) => {
    if (place.lat !== value?.lat || place.lng !== value?.lng) onChange(place);
  });

  useEffect(() => {
    const m = L.map(box.current!, { zoomControl: false, center: opening.current, zoom: 17 });
    addStreetMap(m);
    m.on('moveend', () => {
      const { lat, lng } = m.getCenter();
      moved({ lat, lng });
    });
    m.on('click', (e: L.LeafletMouseEvent) => m.panTo(e.latlng));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    // Not animated: the move ends at once, on exactly `value`, so `moved` sees nothing new to report.
    if (m && value && !m.getCenter().equals(value)) m.setView(value, m.getZoom(), { animate: false });
  }, [value]);

  return (
    <div className="relative h-48 overflow-hidden rounded-xl border border-line">
      <div ref={box} role="region" aria-label={t('map.picker')} className="absolute inset-0 isolate" />
      {/* The pin's tip is the map's centre: the box is 44x46 with the tip in the middle of its bottom edge. */}
      <span aria-hidden="true" className="map-pin map-pin--high pointer-events-none absolute left-1/2 top-1/2 -ml-[22px] -mt-[46px] h-[46px] w-[44px]">
        <span className="map-pin-head">
          <span className="map-pin-dot" />
        </span>
      </span>
    </div>
  );
}
