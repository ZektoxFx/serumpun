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

  // Landing page
  'landing.demo.title': 'Cuba demo',
  'landing.demo.aisyah': 'Cuba sebagai Aisyah (penduduk)',
  'landing.demo.nur': 'Cuba sebagai Nur (menunggu kelulusan)',
  'landing.demo.office': 'Cuba sebagai Pejabat Pengurusan',
  'landing.demo.error': 'Log masuk demo tidak berjaya. Sila cuba lagi.',
  'landing.signIn.title': 'Log masuk',
  'landing.newHere': 'Baru di Serumpun?',
  'landing.createAccount': 'Daftar akaun',

  // Accounts
  'auth.email': 'E-mel',
  'auth.password': 'Kata laluan',
  'auth.signIn': 'Log masuk',
  'auth.signOut': 'Log keluar',
  'auth.error.signIn': 'E-mel atau kata laluan tidak betul.',

  // Sign-up
  'signup.title': 'Daftar akaun anda',
  'signup.intro': 'Pejabat Pengurusan akan menyemak nombor rumah atau unit anda sebelum anda boleh menyiarkan.',
  'signup.township': 'Perbandaran',
  'signup.comingSoon': '{name} (akan datang)',
  'signup.neighbourhood': 'Kejiranan',
  'signup.neighbourhood.hint': 'Contohnya, Elmina Valley 3',
  'signup.unitNo': 'No. rumah / unit',
  'signup.unitNo.hint': 'Hanya Pejabat Pengurusan yang dapat melihat ini.',
  'signup.fullName': 'Nama penuh',
  'signup.password.hint': 'Sekurang-kurangnya 8 aksara.',
  'signup.submit': 'Daftar akaun',
  'signup.haveAccount': 'Sudah ada akaun?',
  'signup.error.required': 'Sila isi ruangan ini.',
  'signup.error.email': 'Masukkan alamat e-mel yang sah.',
  'signup.error.emailTaken': 'E-mel ini sudah mempunyai akaun. Sila log masuk.',
  'signup.error.password': 'Gunakan 8 hingga 72 aksara.',
  'signup.error.townshipSoon': 'Serumpun belum dibuka di perbandaran ini.',

  // Account status and roles
  'pending.banner':
    'Akaun anda sedang menunggu kelulusan Pejabat Pengurusan. Anda boleh melihat-lihat; anda boleh menyiarkan selepas disahkan.',
  'role.resident': 'Penduduk',
  'role.management': 'Pejabat Pengurusan',

  // Language switch
  'lang.label': 'Bahasa',
  'lang.en': 'English',
  'lang.ms': 'Bahasa Malaysia',

  // Relative times (lib/domain/time.ts)
  'time.justNow': 'baru sahaja',
  'time.minutes': '{n} min lalu',
  'time.hours': '{n} jam lalu',
  'time.days': '{n} hari lalu',

  // Notification titles: the database stores these keys in notifications.title_key
  'notify.account.verified': 'Akaun anda telah diluluskan. Selamat datang ke Serumpun!',
  'notify.account.rejected': 'Pendaftaran anda tidak diluluskan. Sila hubungi Pejabat Pengurusan.',

  'common.error': 'Sesuatu tidak kena. Sila cuba lagi.',
};

export default ms;
