import { t, type Lang, type MessageKey } from '@/lib/i18n/core';
import { PLACES } from './places';

// Sime Darby Property's own malls (feedback round 2, spec §4.1), as SDP's pages said on 18 Oct 2026: Elmina Lakeside
// Mall (its second wholly owned mall, in City of Elmina) and KL East Mall (its first). Elmina's hourly rate is not
// published anywhere we found, so it is a sample and says so; KL East Mall's is its real one, before 8% service tax.

export type MallSlug = 'elmina-lakeside-mall' | 'kl-east-mall';

/** "First 2 hours (or part) RM2, then each hour (or part) RM1", in sen, plus a tax rate on the total. */
export type ParkingRate = { firstHours: number; firstSen: number; nextHourSen: number; taxRate: number; sample: boolean };

export type Mall = {
  slug: MallSlug;
  name: string;
  /** The township it belongs to (as `townships.name`), or null for a mall in a township not on Serumpun yet. */
  township: string | null;
  area: string;
  address: string;
  lat: number;
  lng: number;
  rate: ParkingRate;
  /** Minutes to leave the car park after paying (the user's "20 minutes"; KL East Mall's own rule is 15). */
  graceMinutes: number;
  valet: MessageKey;
  freeParking: MessageKey | null;
  ev: MessageKey | null;
  /** SDP's car park map, in public/. */
  carParkMap: { src: string; width: number; height: number } | null;
  /** Has a shop directory (/malls/<slug>). */
  directory: boolean;
  waze: string;
  googleMaps: string;
};

const elmina = PLACES.find((p) => p.label === 'place.mall')!;

export const MALLS: readonly Mall[] = [
  {
    slug: 'elmina-lakeside-mall',
    name: 'Elmina Lakeside Mall',
    township: 'City of Elmina',
    area: 'City of Elmina, Shah Alam',
    address: 'No. 5, Persiaran Garcinia, Elmina West, 40170 Shah Alam, Selangor',
    lat: elmina.lat,
    lng: elmina.lng,
    rate: { firstHours: 2, firstSen: 200, nextHourSen: 100, taxRate: 0, sample: true },
    graceMinutes: 20,
    valet: 'mall.elmina.valet',
    freeParking: 'mall.elmina.free',
    ev: 'mall.elmina.ev',
    carParkMap: { src: '/malls/elmina-lakeside-mall-car-parks.webp', width: 1568, height: 902 },
    directory: true,
    waze: 'https://www.waze.com/en/live-map/directions/my/selangor/shah-alam/elmina-lakeside-mall?place=ChIJWzWvBgBRzDERFJIngI5lFa0',
    googleMaps: 'https://maps.app.goo.gl/9wJUDTYCKXSSGoow6',
  },
  {
    slug: 'kl-east-mall',
    name: 'KL East Mall',
    township: null,
    area: 'KL East, Kuala Lumpur',
    address: '823, Jalan Lingkaran Tengah 2, KL Timur, 53100 Kuala Lumpur',
    // OpenStreetMap's KL East Mall.
    lat: 3.224784,
    lng: 101.7306315,
    rate: { firstHours: 2, firstSen: 200, nextHourSen: 200, taxRate: 0.08, sample: false },
    graceMinutes: 20,
    valet: 'mall.klEast.valet',
    freeParking: null,
    ev: null,
    carParkMap: null,
    directory: false,
    waze: 'https://waze.com/ul?q=KL%20East%20Mall',
    googleMaps: 'https://www.google.com/maps/search/?api=1&query=KL%20East%20Mall',
  },
];

export function findMall(slug: string | undefined): Mall | null {
  return MALLS.find((m) => m.slug === slug) ?? null;
}

/** "RM2.00 first 2 hours, then RM1.00 an hour", and the service tax when there is one. */
export function rateText(rate: ParkingRate, lang: Lang): string {
  const rm = (sen: number) => (sen / 100).toFixed(2);
  const text = t(lang, 'parking.rate', { first: rm(rate.firstSen), hours: rate.firstHours, next: rm(rate.nextHourSen) });
  return rate.taxRate > 0 ? `${text}, ${t(lang, 'parking.tax', { n: Math.round(rate.taxRate * 100) })}` : text;
}
