import type en from './en';

// Bahasa Malaysia. Typed from en.ts: a missing key is a compile error.
const ms: Record<keyof typeof en, string> = {
  // Landing / app
  'landing.tagline': 'Kejiranan anda, bersama',

  // Bottom navigation
  'nav.home': 'Utama',
  'nav.map': 'Peta',
  'nav.create': 'Cipta',
  'nav.community': 'Komuniti',
  'nav.me': 'Saya',

  // Community tabs
  'community.tab.groups': 'Kumpulan',
  'community.tab.events': 'Acara',
  'community.tab.services': 'Perkhidmatan',
  'community.tab.share': 'Kongsi & Pinjam',

  // Common buttons
  'common.save': 'Simpan',
  'common.cancel': 'Batal',
  'common.back': 'Kembali',
  'common.close': 'Tutup',
  'common.send': 'Hantar',
  'common.join': 'Sertai',
  'common.message': 'Mesej',

  // Home greeting (picked by Malaysia time of day)
  'home.greeting.morning': 'Selamat pagi, {name}',
  'home.greeting.afternoon': 'Selamat petang, {name}',
  'home.greeting.evening': 'Selamat malam, {name}',
};

export default ms;
