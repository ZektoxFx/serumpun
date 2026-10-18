'use client';

import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { useEffect, useRef } from 'react';
import { PLAN, type Point } from '@/lib/domain/mallDirectory';
import { useT } from '@/lib/i18n';

// The plan's pixels as Leaflet's flat map: y grows downwards on the image, upwards on the map.
const at = ([x, y]: Point): L.LatLngTuple => [-y, x];
const BOUNDS = L.latLngBounds([-PLAN.height, 0], [0, PLAN.width]);

/**
 * SDP's layout plan of Elmina Lakeside Mall as a pinch-zoom, pan map (as SDP's own site does), with red pins for `pins`,
 * moving to `focus` when it changes. Client only: the directory loads it with next/dynamic.
 */
export default function MallPlan({ pins, focus }: { pins: { point: Point; label: string }[]; focus: Point | null }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const m = L.map(box.current!, { crs: L.CRS.Simple, zoomSnap: 0.25, minZoom: -4, maxZoom: 1, attributionControl: false, maxBounds: BOUNDS.pad(0.2) });
    L.imageOverlay(PLAN.src, BOUNDS).addTo(m);
    m.fitBounds(BOUNDS);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    for (const pin of pins) {
      // The label goes in as text, never as HTML.
      const label = document.createElement('span');
      label.textContent = pin.label;
      L.circleMarker(at(pin.point), { radius: 9, color: '#FFFFFF', weight: 3, fillColor: '#D51A21', fillOpacity: 1, interactive: false })
        .bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -9] })
        .addTo(group);
    }
  }, [pins]);

  useEffect(() => {
    const m = map.current;
    if (!focus || !m) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    m.setView(at(focus), Math.max(m.getZoom(), -1), { animate: !still });
  }, [focus]);

  return <div ref={box} role="region" aria-label={t('mall.planLabel')} className="isolate aspect-[3/2] w-full overflow-hidden rounded-2xl border border-line bg-white" />;
}
