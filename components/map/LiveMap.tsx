'use client';

import 'leaflet/dist/leaflet.css';
import './map.css';
import * as L from 'leaflet';
import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react';
import { ALERT_ICON, type AlertType, type Severity } from '@/lib/domain/alerts';
import type { LatLng } from '@/lib/domain/geo';
import { useT } from '@/lib/i18n';

/** One alert as the map draws it. `label` is the pin's accessible name: type, severity and how fresh it is. */
export type MapPin = { id: string; lat: number; lng: number; type: AlertType; severity: Severity; official: boolean; label: string };

const ZOOM = 16;
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const CREDIT = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
// Where pins overlap, the more serious one is drawn on top (and the selected one above all).
const RISE: Record<Severity, number> = { high: 300, medium: 200, low: 100 };

/** Leaflet's view of the tiles and attribution, shared with the place picker. */
export function addStreetMap(map: L.Map) {
  map.attributionControl.setPrefix(false);
  L.tileLayer(TILES, { maxZoom: 19, attribution: CREDIT }).addTo(map);
}

// Only fixed emoji and class names go into the HTML; the pin's name is set with setAttribute.
const pinIcon = (pin: MapPin) =>
  L.divIcon({
    className: `map-pin map-pin--${pin.severity}${pin.official ? ' map-pin--official' : ''}`,
    html: `<span class="map-pin-ring"></span><span class="map-pin-head"><span class="map-pin-glyph" aria-hidden="true">${ALERT_ICON[pin.type]}</span></span>`,
    iconSize: [44, 46],
    iconAnchor: [22, 46],
  });

const meIcon = L.divIcon({ className: 'map-me', iconSize: [18, 18] });

function Control({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full border border-line bg-surface text-text shadow-md hover:bg-soft"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

/**
 * The Leaflet map of the township's alerts (client only: the page loads it with next/dynamic and ssr: false).
 * Pins are buttons: Tab reaches them, Enter or Space opens them. It opens on the resident's GPS fix when they are in the
 * township, else on its centre, and follows the first fix unless the resident has already moved the map.
 */
export function LiveMap({
  pins,
  selectedId,
  onSelect,
  centre,
  me,
  focus,
  onViewChange,
  township,
}: {
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The township centre. */
  centre: LatLng;
  /** The device, only when it is in the township. */
  me: LatLng | null;
  /** The map pans here whenever this changes (a freshly posted alert). */
  focus: LatLng | null;
  onViewChange: (centre: LatLng) => void;
  township: string;
}) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const meDot = useRef<L.Marker | null>(null);
  const opening = useRef(me ?? centre);
  const moved = useRef(false); // the resident moved the map, so a late GPS fix no longer pulls it away
  const select = useEffectEvent(onSelect);
  const viewChanged = useEffectEvent(onViewChange);

  useEffect(() => {
    const m = L.map(box.current!, { zoomControl: false, center: opening.current, zoom: ZOOM });
    addStreetMap(m);
    m.on('dragstart', () => {
      moved.current = true;
    });
    m.on('moveend', () => {
      const { lat, lng } = m.getCenter();
      viewChanged({ lat, lng });
    });
    map.current = m;
    const drawn = markers.current;
    return () => {
      m.remove();
      map.current = null;
      drawn.clear();
      meDot.current = null;
    };
  }, []);

  // Add new pins, drop gone ones, and keep names and the selection current. A pin's look never changes after it is
  // posted, so existing markers are kept (and keep keyboard focus).
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const live = new Set<string>();
    for (const pin of pins) {
      live.add(pin.id);
      let marker = markers.current.get(pin.id);
      if (!marker) {
        marker = L.marker([pin.lat, pin.lng], { icon: pinIcon(pin) })
          .on('click', () => select(pin.id))
          .on('keydown', (e: L.LeafletKeyboardEvent) => {
            if (e.originalEvent.key !== 'Enter' && e.originalEvent.key !== ' ') return;
            e.originalEvent.preventDefault();
            select(pin.id);
          })
          .addTo(m);
        markers.current.set(pin.id, marker);
      }
      const selected = pin.id === selectedId;
      marker.getElement()?.setAttribute('aria-label', pin.label);
      marker.getElement()?.classList.toggle('is-selected', selected);
      marker.setZIndexOffset(selected ? 1000 : RISE[pin.severity]);
    }
    for (const [id, marker] of markers.current) {
      if (live.has(id)) continue;
      marker.remove();
      markers.current.delete(id);
    }
  }, [pins, selectedId]);

  // The alert sheet covers the lower half of the screen, so the selected pin moves up into view.
  useEffect(() => {
    const m = map.current;
    const marker = selectedId ? markers.current.get(selectedId) : undefined;
    if (!m || !marker) return;
    m.panTo(m.unproject(m.project(marker.getLatLng()).add([0, m.getSize().y * 0.22])));
  }, [selectedId]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!me) {
      meDot.current?.remove();
      meDot.current = null;
    } else if (meDot.current) {
      meDot.current.setLatLng(me);
    } else {
      meDot.current = L.marker(me, { icon: meIcon, interactive: false, keyboard: false, zIndexOffset: -1000 }).addTo(m);
      if (!moved.current) m.setView(me, ZOOM);
    }
  }, [me]);

  useEffect(() => {
    if (focus) map.current?.panTo(focus);
  }, [focus]);

  const zoomBy = (step: number) => {
    moved.current = true;
    map.current?.setZoom(map.current.getZoom() + step);
  };

  return (
    <div className="absolute inset-0">
      <div ref={box} role="region" aria-label={t('map.label')} className="absolute inset-0 isolate" />
      <div className="absolute bottom-10 right-3 grid gap-2">
        <Control
          label={me ? t('map.locate') : t('map.recentre', { township })}
          onClick={() => map.current?.setView(me ?? centre, Math.max(map.current.getZoom(), ZOOM))}
        >
          <circle cx="12" cy="12" r="7" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </Control>
        <Control label={t('map.zoomIn')} onClick={() => zoomBy(1)}>
          <path d="M12 5v14M5 12h14" />
        </Control>
        <Control label={t('map.zoomOut')} onClick={() => zoomBy(-1)}>
          <path d="M5 12h14" />
        </Control>
      </div>
    </div>
  );
}
