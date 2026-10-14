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
  'nav.label': 'Menu utama',

  // Create sheet (the + button)
  'create.report': 'Laporkan isu',
  'create.alert': 'Hantar amaran di peta',
  'create.post': 'Siar dalam kumpulan',
  'create.service': 'Tawar atau minta perkhidmatan',
  'create.item': 'Senaraikan barang',
  'create.event': 'Cipta acara',

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

  // Home
  'home.status.verified': 'Penduduk disahkan ✓',
  'home.status.pending': 'Menunggu kelulusan',
  'home.report.body': 'Terus ke Pejabat Pengurusan',
  'home.tile.map': 'Peta Langsung',
  'home.tile.book': 'Tempah Gelanggang',
  'home.tile.rewards': 'Ganjaran',
  'home.tile.issues': 'Papan Isu',
  'home.happening': 'Sedang berlaku',
  'home.happening.empty': 'Tiada apa-apa buat masa ini',
  'home.happening.emptyHint': 'Amaran, notis daripada Pejabat Pengurusan dan acara berdekatan akan dipaparkan di sini.',

  // Points (the ★ is drawn next to the number, not part of the text)
  'points.count': '{n} mata',

  // Header icons
  'messages.title': 'Mesej',

  // Notifications
  'notifications.title': 'Pemberitahuan',
  'notifications.bellUnread': 'Pemberitahuan, {n} belum dibaca',
  'notifications.markAll': 'Tandakan semua dibaca',
  'notifications.unread': 'Belum dibaca',
  'notifications.empty': 'Belum ada pemberitahuan',
  'notifications.emptyHint': 'Perkembangan laporan, tempahan dan akaun anda akan dipaparkan di sini.',

  // Me
  'me.points': 'Mata anda',
  'me.rewards': 'Ganjaran →',
  'me.vouchers': 'Baucar saya',
  'me.reports': 'Laporan saya',
  'me.bookings': 'Tempahan saya',
  'me.listings': 'Senarai barang saya',
  'me.pointsHistory': 'Sejarah mata',
  'me.darkMode': 'Mod gelap',
  'me.township': 'Perbandaran',

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
  'signup.unitNo.hint': 'Pejabat Pengurusan menggunakan ini untuk mengesahkan anda.',
  'signup.demoNotice':
    'Ini demo awam: sesiapa sahaja boleh mencuba paparan Pejabat Pengurusan. Sila gunakan nama dan alamat rekaan.',
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
  'rejected.title': 'Permohonan anda tidak diluluskan',
  'rejected.body': 'Sila hubungi Pejabat Pengurusan.',
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
  'notify.report.acknowledged': 'Pejabat Pengurusan telah menerima laporan yang anda ikuti',
  'notify.report.in_progress': 'Kerja telah bermula untuk laporan yang anda ikuti',
  'notify.report.resolved': 'Laporan yang anda ikuti telah diselesaikan. Sudah dibaiki?',
  'notify.report.update': 'Kemas kini baharu daripada Pejabat Pengurusan untuk laporan yang anda ikuti',
  'notify.report.reopened': 'Penduduk kata laporan yang diselesaikan belum dibaiki. Ia dibuka semula.',

  'common.error': 'Sesuatu tidak kena. Sila cuba lagi.',
  // Every create/act screen shows this to a pending resident, with its submit disabled (Task 4 ruling).
  'common.pendingCantAct': 'Anda boleh melakukan ini selepas Pejabat Pengurusan meluluskan akaun anda.',

  // Alert types and severities (lib/domain/alerts.ts)
  'alert.type.accident': 'Kemalangan',
  'alert.type.snake': 'Ular / haiwan liar',
  'alert.type.suspicious': 'Orang mencurigakan',
  'alert.type.stray_dogs': 'Anjing liar',
  'alert.type.flood': 'Banjir / lopak besar',
  'alert.type.fallen_tree': 'Pokok tumbang',
  'alert.type.walkway_blocked': 'Laluan terhalang',
  'alert.type.streetlight': 'Lampu jalan padam',
  'alert.type.police': 'Polis / sekatan jalan',
  'severity.high': 'Tinggi',
  'severity.medium': 'Sederhana',
  'severity.low': 'Rendah',

  // Named places (lib/domain/places.ts)
  'place.centralPark': 'Elmina Valley Central Park',
  'place.joggingTrack': 'Trek joging Central Park',
  'place.carPark': 'Tempat letak kereta Central Park',
  'place.mall': 'Elmina Lakeside Mall',
  'place.persiaranTamarind': 'Persiaran Tamarind',
  'place.persiaranElmina': 'Persiaran Elmina',
  'place.persiaranGarcinia': 'Persiaran Garcinia',
  'place.valley3': 'Elmina Valley 3',

  // Live Map
  'map.label': 'Peta amaran. Gunakan kekunci anak panah untuk menggerakkannya.',
  'map.picker': 'Lokasi pin. Gunakan kekunci anak panah untuk menggerakkan peta di bawah pin.',
  'map.search': 'Cari amaran',
  'map.search.placeholder': 'Cari amaran di {township}',
  'map.search.clear': 'Kosongkan carian',
  'map.zoomIn': 'Zum masuk',
  'map.zoomOut': 'Zum keluar',
  'map.locate': 'Tunjukkan lokasi saya',
  'map.recentre': 'Kembali ke {township}',
  'map.drop.open': 'Hantar amaran',
  'map.readOnly': 'Lihat sahaja: anda boleh menyiar dan mengundi selepas diluluskan.',
  'map.shown': '{shown} daripada {total} amaran',
  'map.quiet': 'Semuanya tenang: tiada amaran buat masa ini',
  'map.clear': 'Kosongkan',
  'map.posted': 'Dihantar. Jiran berdekatan boleh melihatnya sekarang.',
  'map.pin.confirmed': '{type}, tahap bahaya {severity}, terakhir disahkan {time}',
  'map.pin.reported': '{type}, tahap bahaya {severity}, dilaporkan {time}',
  'map.pin.official': '{type}, tahap bahaya {severity}, notis daripada Pejabat Pengurusan',

  // Live Map: an alert's sheet
  'map.alert.near': 'Dekat {place}',
  'map.alert.fromYou': '{distance} dari anda',
  'map.alert.official': 'Pejabat Pengurusan',
  'map.alert.firstReported': 'Mula dilaporkan',
  'map.alert.byNeighbour': 'oleh jiran yang disahkan',
  'map.alert.byYou': 'oleh anda',
  'map.alert.byOffice': 'oleh Pejabat Pengurusan',
  'map.alert.lastConfirmed': 'Terakhir disahkan',
  'map.alert.notYet': 'Belum lagi',
  'map.alert.confirmedOne': '1 jiran setakat ini',
  'map.alert.confirmedMany': '{n} jiran setakat ini',
  'map.alert.noOne': 'Belum ada jiran yang mengesahkannya',
  'map.alert.goneVotes': 'Undi “sudah tiada”: {n} daripada 3',
  'map.alert.stays': 'Kekal sehingga',
  'map.alert.staysValue': 'Pejabat membuangnya',
  'map.alert.staysHint': 'Notis rasmi',
  'map.alert.stillThere': 'Masih ada',
  'map.alert.gone': 'Sudah tiada',
  'map.alert.yourVote.still_there': 'Anda kata ia masih ada. Anda boleh menukar undian.',
  'map.alert.yourVote.gone': 'Anda kata ia sudah tiada. Anda boleh menukar undian.',
  'map.alert.yours': 'Anda yang menghantar amaran ini. Jiran akan mengesahkannya atau menandakannya sudah tiada.',
  'map.alert.escalate': 'Masalah berpanjangan? Hantar ke Pejabat Pengurusan',

  // Live Map: dropping an alert
  'map.drop.atYou': 'Di lokasi semasa anda',
  'map.drop.atPin': 'Di tempat pin',
  'map.drop.movePin': 'Alih pin',
  'map.drop.pinDone': 'Siap',
  'map.drop.pinHint': 'Seret peta sehingga pin berada tepat di tempatnya.',
  'map.drop.noGps': 'Lokasi anda tidak dapat dikesan, jadi letakkan pin sendiri.',
  'map.drop.privacy': 'Jiran boleh melihat tempat ini. Jika anda berada di rumah, alihkan pin ke tempat kejadian.',
  'map.drop.type': 'Apa yang anda lihat?',
  'map.drop.severity': 'Sejauh mana bahayanya?',
  'map.drop.note': 'Nota (pilihan)',
  'map.drop.noteHint': 'Ringkaskan. Jangan tulis nama atau nombor rumah.',
  'map.drop.fine':
    'Jiran melihat amaran ini tetapi bukan siapa yang menghantarnya. Ia hilang selepas 2 jam kecuali ada yang mengesahkannya.',
  'map.drop.post': 'Siarkan ke peta',

  // Live Map: filters
  'map.filter.title': 'Tapis amaran',
  'map.filter.distance': 'Jarak dari saya',
  'map.filter.anyDistance': 'Seluruh perbandaran',
  'map.filter.noLocation': 'Penapis jarak berfungsi selepas laman ini dibenarkan menggunakan lokasi anda.',
  'map.filter.severity': 'Tahap bahaya',
  'map.filter.type': 'Jenis',
  'map.filter.chip.distance': 'Jarak',
  'map.filter.within': 'Dalam {distance}',
  'map.filter.show': 'Papar {n} amaran',
  'map.filter.showOne': 'Papar 1 amaran',
  'map.filter.showNone': 'Tiada amaran sepadan',
  'map.filter.reset': 'Set semula',

  // Live Map: what the alert RPCs refuse (alertErrorKey)
  'map.error.type': 'Pilih jenis amaran.',
  'map.error.severity': 'Pilih tahap bahaya.',
  'map.error.outOfArea': 'Tempat itu terlalu jauh dari perbandaran anda. Alihkan pin lebih dekat.',
  'map.error.photo': 'Gambar itu tidak dapat ditambah. Sila ambil atau pilih semula.',
  'map.error.vote': 'Pilih Masih ada atau Sudah tiada.',
  'map.error.notFound': 'Amaran ini sudah tiada di peta.',
  'map.error.ownAlert': 'Anda yang menghantar amaran ini, jadi jiran anda yang mengesahkannya.',
  'map.error.officialPin': 'Notis Pejabat Pengurusan tidak boleh diundi.',
  'map.error.notActive': 'Amaran ini sudah luput atau telah dikosongkan.',
  'map.error.notManagement': 'Hanya Pejabat Pengurusan boleh melakukan ini.',
};

export default ms;
