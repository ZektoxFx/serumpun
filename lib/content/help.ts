import type { Lang } from '@/lib/i18n/core';

// Me › Help & policies (feedback round 2, spec §7): the long copy of the four help pages, in both languages. Kept out of
// the i18n dictionaries because it is prose, not UI; the type makes the two languages keep the same shape.

/** A headed part of a page, with its steps or paragraphs in order. */
export type HelpSection = { title: string; steps: string[] };
export type HelpRule = { title: string; body: string };
export type FaqItem = { q: string; a: string };
export type HelpContent = {
  guidelines: HelpSection[];
  rules: HelpRule[];
  /** What happens when a rule is broken, under the list. */
  rulesAfter: string;
  faq: FaqItem[];
  terms: { updated: string; draftNote: string; sections: HelpSection[] };
};

const en: HelpContent = {
  guidelines: [
    {
      title: 'Report an issue',
      steps: [
        'Tap Report an issue on Home and pick what is wrong, like a broken streetlight or a blocked drain.',
        'Add a photo and the place on the map. If a neighbour already reported it nearby, tap Me too instead of sending it again.',
        'Follow it on the Issue Board: submitted, acknowledged, in progress, resolved. You get a notification at each step.',
        'When the office marks it resolved, tell them whether it is really fixed. If it is not, it reopens.',
      ],
    },
    {
      title: 'Map alerts and Safe Walk',
      steps: [
        'Open Map to see what neighbours warned about: stray dogs, a fallen tree, a flood and more.',
        'Seen it too? Tap Still there. Gone? Tap Gone. An alert fades 2 hours after the last neighbour confirms it.',
        'Tap Safe Walk and pick a place: the walking route goes around confirmed hazards.',
        'Something lasting, like a broken path? Use Send to Management Office on the alert.',
      ],
    },
    {
      title: 'The emergency button',
      steps: [
        'For real danger only: a fire, a medical emergency, a break-in. If anyone is in danger, call 999 first.',
        'Hold the + button for 3 seconds until it turns red with "!", then tap it once.',
        'The Management Office and verified neighbours within 2 km get an alert, and a red circle shows on their map.',
        'Say what is happening (fire, medical, crime or something else), or cancel it if it was a false alarm.',
      ],
    },
    {
      title: 'Notify the office',
      steps: [
        'Before a renovation, moving day, an event at home or a contractor visit, tap Notify office on Home.',
        'Pick what it is about, the dates, and add the details, like the working hours or when the lift is needed.',
        'The office marks it noted, sometimes with a reply, and you are told. Only the office sees it.',
      ],
    },
    {
      title: 'General chat',
      steps: [
        'Everyone in the township is in General chat, pinned at the top of Community › Groups.',
        'It has topics, like Help & support or Borak-borak. Tap one to chat with your neighbours.',
        'Announcements is for the Management Office only: read it for official news.',
      ],
    },
    {
      title: 'Groups and events',
      steps: [
        'Join groups that suit you, like runners or parents, and post, ask questions or vote Helpful.',
        'In Events, tap Going to save a seat. At the event, scan its QR code to check in and earn points.',
        'Want to organise something? Create an event; the office can approve points for it.',
      ],
    },
    {
      title: 'Services',
      steps: [
        'Find neighbours who tutor, repair, clean, cook, babysit and more, or ask for help yourself.',
        'Message them to agree the details; payment is between you and them.',
        'After the job, rate their offer with 1 to 5 stars to help others choose.',
      ],
    },
    {
      title: 'Share & Lend',
      steps: [
        'List things you can lend, give away or swap.',
        'To borrow, pick the dates and send a request. The owner approves, you pick it up, then give it back.',
        'On the return day you both get a reminder in the morning.',
      ],
    },
    {
      title: 'Facilities',
      steps: [
        'Book courts, the hall, the gym, the BBQ pit or the function room for free, in 1-hour slots from 7 am to 11 pm, up to 7 days ahead.',
        'Each household can book up to 2 hours a day. Your booking pass has a QR code and can go into your calendar.',
        'Need players? Turn on Find players and neighbours can join your game.',
        "Can't make it? Cancel at least 2 hours before, so someone else can use the slot.",
      ],
    },
    {
      title: 'Pay parking',
      steps: [
        'Tap Pay parking, pick the mall and enter your car plate.',
        'Check the amount, pick a way to pay and tap Pay.',
        'You then have 20 minutes to leave the car park.',
        'In this prototype the payment is a demo: no real money is charged.',
      ],
    },
    {
      title: 'Rewards and points',
      steps: [
        "Earn points by checking in at events: 150 at the office's events, 100 at approved resident events.",
        'Swap points for vouchers at Elmina Lakeside Mall in Rewards.',
        'At the counter, slide to use the voucher; it lasts 30 days.',
      ],
    },
  ],
  rules: [
    { title: 'Be kind', body: 'Disagree politely. No insults, threats, hate or harassment.' },
    {
      title: 'Keep homes private',
      body: "Never post someone's unit number, car plate or photos of children without asking first.",
    },
    { title: 'No selling in chats', body: 'Use Services or Share & Lend instead of selling in groups or General chat.' },
    {
      title: 'Emergencies only',
      body: 'The emergency button is for real danger. False alarms frighten neighbours and can get your account paused.',
    },
    { title: 'One report per problem', body: 'Tap Me too instead of reporting the same problem again.' },
    { title: 'Fair bookings', body: "2 hours a day per household; cancel if you can't come." },
    {
      title: "Respect the office's decisions",
      body: 'The Management Office looks after the township and this app; follow its instructions in General chat and on reports.',
    },
  ],
  rulesAfter:
    'If a rule is broken, the Management Office first sends a reminder. If it happens again, posting can be paused, and in serious or repeated cases the office may remove the account.',
  faq: [
    {
      q: 'Who can see my unit number?',
      a: 'Only the Management Office. Neighbours see your name and neighbourhood, never your unit, phone number or car plate.',
    },
    {
      q: "Why can't I post yet?",
      a: 'The Management Office checks every new account against its unit first. Until then you can look around, but posting, voting, booking, borrowing, messaging and alerts wait for approval.',
    },
    {
      q: 'Is the parking payment real money?',
      a: 'No. Serumpun is a prototype: the parking payment shows how it would work, and no money is charged.',
    },
    {
      q: 'When should I use the emergency button?',
      a: 'Only for real danger, like a fire, a medical emergency or a break-in. Call 999 first if anyone is in danger; the button then warns the office and your neighbours within 2 km.',
    },
    {
      q: 'How do I get alerts on my lock screen?',
      a: 'Go to Me › Emergency alerts on this phone and turn it on, then allow notifications. On an iPhone, first add Serumpun to your Home Screen (Share › Add to Home Screen, iOS 16.4 or later) and open it from there.',
    },
    {
      q: 'How do points and vouchers work?',
      a: "Check in at an event with its QR code, from an hour before it starts until three hours after: 150 points at the office's events, 100 at approved resident events. Swap points for vouchers in Rewards; a voucher lasts 30 days.",
    },
    {
      q: 'How do I book a facility?',
      a: 'Home › Facilities, pick the place, the day and a free 1-hour slot, then confirm. Up to 2 hours a day per household, up to 7 days ahead.',
    },
    {
      q: 'What happens to my report?',
      a: 'The office acknowledges it, works on it and marks it resolved, with an update at each step. You then say whether it is really fixed; if not, it reopens.',
    },
    {
      q: 'How do I change the buttons on Home?',
      a: 'Tap Edit next to My favourites. Remove a button with −, add one with +, hold and drag to move it, then tap Save. You can keep up to 7; the rest are under More.',
    },
    {
      q: 'Can I make the text bigger?',
      a: 'Yes. Me › Text size has Small, Normal, Large and Extra large.',
    },
    {
      q: 'Who can post in General chat?',
      a: 'Every verified resident can post in its topics. Only the Management Office posts in Announcements, and only the office adds or removes topics.',
    },
    {
      q: 'How do I find a shop at Elmina Lakeside Mall?',
      a: 'Open Mall directory, search for the shop or pick a category, and tap it to see where it is on the layout plan.',
    },
  ],
  terms: {
    updated: '18 October 2026',
    draftNote:
      'This is a draft written for the Serumpun prototype, made for the Sime Darby Property University Hackathon 2026. It is not legal advice and is not yet a binding agreement.',
    sections: [
      {
        title: 'About these terms',
        steps: [
          'These terms explain how you may use Serumpun, an app for the residents of a Sime Darby Property township and its Management Office. By creating an account you agree to them.',
        ],
      },
      {
        title: 'Who can use Serumpun',
        steps: [
          'Residents of a township where Serumpun is live, and the staff of its Management Office.',
          'Each account is for one person; keep your password to yourself.',
        ],
      },
      {
        title: 'Your account and verification',
        steps: [
          'When you sign up you give your name, township, neighbourhood and unit number. The Management Office checks them before approving the account, and may reject or pause an account that is not genuine.',
        ],
      },
      {
        title: 'Using Serumpun fairly',
        steps: [
          "Follow the Community rules. Do not post anything unlawful, hateful, misleading or that invades someone's privacy, and do not use the app to sell.",
        ],
      },
      {
        title: 'What you post',
        steps: [
          'You are responsible for your posts, messages, photos and reports. The Management Office may remove anything that breaks these terms or the Community rules.',
        ],
      },
      {
        title: 'Your privacy',
        steps: [
          "We handle your personal data in line with Malaysia's Personal Data Protection Act 2010. Your unit number and phone number are seen only by the Management Office; neighbours see your name and neighbourhood.",
          'Your location is used only on your phone, for the map and Safe Walk, and to send an emergency alert you raise. Car plates you save for parking are kept for your account only.',
          'When your household card is tapped at a reader, the visit is recorded with your unit, the place and the time, never your name. The reader shows no names either.',
        ],
      },
      {
        title: 'Not an emergency service',
        steps: [
          'Serumpun is not an emergency service. If anyone is in danger, call 999 first. Alerts may arrive late or not at all.',
        ],
      },
      {
        title: 'Payments in this prototype',
        steps: [
          'Parking payments in this version are a demonstration. No money is charged and no payment details are collected.',
        ],
      },
      {
        title: 'Points and vouchers',
        steps: [
          "Points have no cash value and cannot be transferred. Vouchers follow each partner's conditions and expire after 30 days.",
        ],
      },
      {
        title: 'Our responsibility',
        steps: [
          'We work to keep Serumpun accurate and available, but it is provided as it is. Information from neighbours and partners, like alerts, services and mall details, may be out of date.',
        ],
      },
      {
        title: 'Changes and contact',
        steps: [
          "We may update these terms and will say so in the app. Questions? Contact your township's Management Office.",
        ],
      },
    ],
  },
};

const ms: HelpContent = {
  guidelines: [
    {
      title: 'Laporkan isu',
      steps: [
        'Ketik Laporkan isu di Utama dan pilih masalahnya, seperti lampu jalan rosak atau longkang tersumbat.',
        'Tambah foto dan tempatnya pada peta. Jika jiran sudah melaporkannya berdekatan, ketik Saya juga dan jangan hantar sekali lagi.',
        'Ikuti di Papan Isu: dihantar, diterima, sedang dibaiki, selesai. Anda menerima pemberitahuan pada setiap langkah.',
        'Apabila pejabat menandakannya selesai, beritahu sama ada ia benar-benar sudah dibaiki. Jika belum, ia dibuka semula.',
      ],
    },
    {
      title: 'Amaran peta dan Jalan Selamat',
      steps: [
        'Buka Peta untuk melihat amaran jiran: anjing liar, pokok tumbang, banjir dan lain-lain.',
        'Nampak juga? Ketik Masih ada. Sudah tiada? Ketik Sudah tiada. Amaran hilang 2 jam selepas jiran terakhir mengesahkannya.',
        'Ketik Jalan Selamat dan pilih tempat: laluan jalan kaki mengelak bahaya yang disahkan.',
        'Masalah yang berlarutan, seperti laluan rosak? Gunakan Hantar kepada Pejabat Pengurusan pada amaran itu.',
      ],
    },
    {
      title: 'Butang kecemasan',
      steps: [
        'Hanya untuk bahaya sebenar: kebakaran, kecemasan perubatan, pecah masuk. Jika ada yang dalam bahaya, hubungi 999 dahulu.',
        'Tekan dan tahan butang + selama 3 saat sehingga ia bertukar merah dengan "!", kemudian ketik sekali.',
        'Pejabat Pengurusan dan jiran yang disahkan dalam lingkungan 2 km menerima amaran, dan bulatan merah dipaparkan pada peta mereka.',
        'Nyatakan apa yang berlaku (kebakaran, perubatan, jenayah atau lain-lain), atau batalkan jika ia amaran palsu.',
      ],
    },
    {
      title: 'Maklumkan pejabat',
      steps: [
        'Sebelum ubah suai, hari berpindah, majlis di rumah atau kedatangan kontraktor, ketik Maklum pejabat di Utama.',
        'Pilih perkaranya, tarikh, dan tambah butirannya, seperti waktu kerja atau bila lif diperlukan.',
        'Pejabat menandakannya sebagai diambil maklum, kadangkala dengan balasan, dan anda diberitahu. Hanya pejabat yang melihatnya.',
      ],
    },
    {
      title: 'Sembang Umum',
      steps: [
        'Semua penduduk berada dalam Sembang Umum, yang disemat di atas Komuniti › Kumpulan.',
        'Ia ada topik, seperti Help & support atau Borak-borak. Ketik satu untuk bersembang dengan jiran.',
        'Topik Announcements hanya untuk Pejabat Pengurusan: bacanya untuk berita rasmi.',
      ],
    },
    {
      title: 'Kumpulan dan acara',
      steps: [
        'Sertai kumpulan yang sesuai, seperti pelari atau ibu bapa, dan buat hantaran, bertanya atau undi Membantu.',
        'Di Acara, ketik Hadir untuk menempah tempat. Di acara, imbas kod QR untuk daftar masuk dan dapatkan mata.',
        'Mahu menganjurkan sesuatu? Cipta acara; pejabat boleh meluluskan mata untuknya.',
      ],
    },
    {
      title: 'Perkhidmatan',
      steps: [
        'Cari jiran yang mengajar tuisyen, membaiki, membersih, memasak, menjaga anak dan lain-lain, atau minta bantuan sendiri.',
        'Hantar mesej untuk bersetuju tentang butirannya; bayaran antara anda dan mereka.',
        'Selepas kerja selesai, nilai tawaran mereka dengan 1 hingga 5 bintang untuk membantu orang lain memilih.',
      ],
    },
    {
      title: 'Kongsi & Pinjam',
      steps: [
        'Senaraikan barang yang boleh dipinjamkan, diberi atau ditukar.',
        'Untuk meminjam, pilih tarikh dan hantar permintaan. Pemilik meluluskan, anda mengambilnya, kemudian memulangkannya.',
        'Pada hari pemulangan, anda berdua menerima peringatan pada waktu pagi.',
      ],
    },
    {
      title: 'Kemudahan',
      steps: [
        'Tempah gelanggang, dewan, gim, tapak BBQ atau bilik majlis secara percuma, slot 1 jam dari 7 pagi hingga 11 malam, sehingga 7 hari lebih awal.',
        'Setiap isi rumah boleh menempah sehingga 2 jam sehari. Pas tempahan anda ada kod QR dan boleh dimasukkan ke dalam kalendar.',
        'Perlukan pemain? Hidupkan Cari pemain dan jiran boleh menyertai permainan anda.',
        'Tidak dapat hadir? Batalkan sekurang-kurangnya 2 jam lebih awal supaya orang lain boleh menggunakan slot itu.',
      ],
    },
    {
      title: 'Bayar parkir',
      steps: [
        'Ketik Bayar parkir, pilih pusat beli-belah dan masukkan nombor plat kereta anda.',
        'Semak jumlahnya, pilih cara bayaran dan ketik Bayar.',
        'Anda kemudian mempunyai 20 minit untuk keluar dari tempat letak kereta.',
        'Dalam prototaip ini bayaran hanyalah demo: tiada wang sebenar dicaj.',
      ],
    },
    {
      title: 'Ganjaran dan mata',
      steps: [
        'Kumpul mata dengan mendaftar masuk di acara: 150 di acara pejabat, 100 di acara penduduk yang diluluskan.',
        'Tukar mata kepada baucar di Elmina Lakeside Mall dalam Ganjaran.',
        'Di kaunter, leret untuk menggunakan baucar; ia sah selama 30 hari.',
      ],
    },
  ],
  rules: [
    { title: 'Bersikap baik', body: 'Berbeza pendapat dengan sopan. Tiada penghinaan, ugutan, kebencian atau gangguan.' },
    {
      title: 'Jaga privasi rumah',
      body: 'Jangan sekali-kali menyiarkan nombor unit, nombor plat kereta atau foto kanak-kanak orang lain tanpa bertanya dahulu.',
    },
    { title: 'Tiada jualan dalam sembang', body: 'Gunakan Perkhidmatan atau Kongsi & Pinjam, bukan berjual dalam kumpulan atau Sembang Umum.' },
    {
      title: 'Kecemasan sahaja',
      body: 'Butang kecemasan untuk bahaya sebenar. Amaran palsu menakutkan jiran dan boleh menyebabkan akaun anda digantung sementara.',
    },
    { title: 'Satu laporan bagi setiap masalah', body: 'Ketik Saya juga dan jangan laporkan masalah yang sama sekali lagi.' },
    { title: 'Tempahan yang adil', body: '2 jam sehari bagi setiap isi rumah; batalkan jika tidak dapat hadir.' },
    {
      title: 'Hormati keputusan pejabat',
      body: 'Pejabat Pengurusan menjaga kejiranan dan aplikasi ini; ikut arahannya dalam Sembang Umum dan pada laporan.',
    },
  ],
  rulesAfter:
    'Jika peraturan dilanggar, Pejabat Pengurusan akan menghantar peringatan dahulu. Jika berulang, hantaran boleh digantung, dan bagi kes yang serius atau berulang, pejabat boleh membuang akaun tersebut.',
  faq: [
    {
      q: 'Siapa boleh melihat nombor unit saya?',
      a: 'Hanya Pejabat Pengurusan. Jiran melihat nama dan kawasan kejiranan anda, tidak sekali-kali unit, nombor telefon atau nombor plat kereta anda.',
    },
    {
      q: 'Kenapa saya belum boleh membuat hantaran?',
      a: 'Pejabat Pengurusan menyemak setiap akaun baharu dengan unitnya dahulu. Sebelum itu anda boleh melihat-lihat, tetapi hantaran, undian, tempahan, pinjaman, mesej dan amaran menunggu kelulusan.',
    },
    {
      q: 'Adakah bayaran parkir menggunakan wang sebenar?',
      a: 'Tidak. Serumpun ialah prototaip: bayaran parkir menunjukkan cara ia berfungsi, dan tiada wang dicaj.',
    },
    {
      q: 'Bila patut saya menggunakan butang kecemasan?',
      a: 'Hanya untuk bahaya sebenar, seperti kebakaran, kecemasan perubatan atau pecah masuk. Hubungi 999 dahulu jika ada yang dalam bahaya; butang itu kemudian memberi amaran kepada pejabat dan jiran dalam lingkungan 2 km.',
    },
    {
      q: 'Bagaimana mendapatkan amaran pada skrin kunci?',
      a: 'Pergi ke Saya › Amaran kecemasan pada telefon ini dan hidupkannya, kemudian benarkan pemberitahuan. Pada iPhone, tambah Serumpun ke Skrin Utama dahulu (Kongsi › Tambah ke Skrin Utama, iOS 16.4 atau lebih baharu) dan bukanya dari situ.',
    },
    {
      q: 'Bagaimana mata dan baucar berfungsi?',
      a: 'Daftar masuk di acara dengan kod QR, dari sejam sebelum ia bermula hingga tiga jam selepasnya: 150 mata di acara pejabat, 100 di acara penduduk yang diluluskan. Tukar mata kepada baucar dalam Ganjaran; baucar sah selama 30 hari.',
    },
    {
      q: 'Bagaimana menempah kemudahan?',
      a: 'Utama › Kemudahan, pilih tempat, hari dan slot 1 jam yang kosong, kemudian sahkan. Sehingga 2 jam sehari bagi setiap isi rumah, sehingga 7 hari lebih awal.',
    },
    {
      q: 'Apa yang berlaku kepada laporan saya?',
      a: 'Pejabat menerimanya, membaikinya dan menandakannya selesai, dengan kemas kini pada setiap langkah. Anda kemudian menyatakan sama ada ia benar-benar sudah dibaiki; jika belum, ia dibuka semula.',
    },
    {
      q: 'Bagaimana menukar butang di Utama?',
      a: 'Ketik Sunting di sebelah Kegemaran saya. Buang butang dengan −, tambah dengan +, tekan dan seret untuk mengalihkannya, kemudian ketik Simpan. Anda boleh menyimpan sehingga 7; selebihnya di bawah Lagi.',
    },
    {
      q: 'Bolehkah saya membesarkan teks?',
      a: 'Boleh. Saya › Saiz teks ada Kecil, Biasa, Besar dan Sangat besar.',
    },
    {
      q: 'Siapa boleh membuat hantaran dalam Sembang Umum?',
      a: 'Setiap penduduk yang disahkan boleh menghantar mesej dalam topiknya. Hanya Pejabat Pengurusan menghantar dalam topik Announcements, dan hanya pejabat yang menambah atau membuang topik.',
    },
    {
      q: 'Bagaimana mencari kedai di Elmina Lakeside Mall?',
      a: 'Buka Direktori mal, cari kedai itu atau pilih kategori, dan ketik untuk melihat lokasinya pada pelan susun atur.',
    },
  ],
  terms: {
    updated: '18 Oktober 2026',
    draftNote:
      'Ini ialah draf yang ditulis untuk prototaip Serumpun, dibuat untuk Sime Darby Property University Hackathon 2026. Ia bukan nasihat undang-undang dan belum menjadi perjanjian yang mengikat.',
    sections: [
      {
        title: 'Tentang terma ini',
        steps: [
          'Terma ini menerangkan cara anda boleh menggunakan Serumpun, aplikasi untuk penduduk kejiranan Sime Darby Property dan Pejabat Pengurusannya. Dengan mendaftar akaun, anda bersetuju dengannya.',
        ],
      },
      {
        title: 'Siapa boleh menggunakan Serumpun',
        steps: [
          'Penduduk kejiranan yang telah menggunakan Serumpun, dan kakitangan Pejabat Pengurusannya.',
          'Setiap akaun untuk seorang sahaja; rahsiakan kata laluan anda.',
        ],
      },
      {
        title: 'Akaun dan pengesahan anda',
        steps: [
          'Semasa mendaftar, anda memberikan nama, kejiranan, kawasan dan nombor unit. Pejabat Pengurusan menyemaknya sebelum meluluskan akaun, dan boleh menolak atau menggantung akaun yang tidak tulen.',
        ],
      },
      {
        title: 'Menggunakan Serumpun dengan adil',
        steps: [
          'Ikut Peraturan komuniti. Jangan siarkan apa-apa yang menyalahi undang-undang, membenci, mengelirukan atau melanggar privasi orang lain, dan jangan gunakan aplikasi ini untuk berjual.',
        ],
      },
      {
        title: 'Apa yang anda siarkan',
        steps: [
          'Anda bertanggungjawab atas hantaran, mesej, foto dan laporan anda. Pejabat Pengurusan boleh membuang apa-apa yang melanggar terma ini atau Peraturan komuniti.',
        ],
      },
      {
        title: 'Privasi anda',
        steps: [
          'Kami mengendalikan data peribadi anda selaras dengan Akta Perlindungan Data Peribadi 2010 Malaysia. Nombor unit dan nombor telefon anda hanya dilihat oleh Pejabat Pengurusan; jiran melihat nama dan kawasan kejiranan anda.',
          'Lokasi anda hanya digunakan pada telefon anda, untuk peta dan Jalan Selamat, dan untuk menghantar amaran kecemasan yang anda buat. Nombor plat kereta yang anda simpan untuk parkir hanya untuk akaun anda.',
          'Apabila kad isi rumah anda diketuk di pembaca, lawatan direkodkan dengan unit, tempat dan masa sahaja, bukan nama anda. Pembaca juga tidak menunjukkan nama.',
        ],
      },
      {
        title: 'Bukan perkhidmatan kecemasan',
        steps: [
          'Serumpun bukan perkhidmatan kecemasan. Jika ada yang dalam bahaya, hubungi 999 dahulu. Amaran mungkin lewat atau tidak sampai.',
        ],
      },
      {
        title: 'Bayaran dalam prototaip ini',
        steps: [
          'Bayaran parkir dalam versi ini hanyalah demonstrasi. Tiada wang dicaj dan tiada butiran pembayaran dikumpul.',
        ],
      },
      {
        title: 'Mata dan baucar',
        steps: [
          'Mata tidak bernilai tunai dan tidak boleh dipindahkan. Baucar tertakluk kepada syarat setiap rakan niaga dan tamat selepas 30 hari.',
        ],
      },
      {
        title: 'Tanggungjawab kami',
        steps: [
          'Kami berusaha memastikan Serumpun tepat dan sentiasa tersedia, tetapi ia disediakan seadanya. Maklumat daripada jiran dan rakan niaga, seperti amaran, perkhidmatan dan butiran pusat beli-belah, mungkin sudah lapuk.',
        ],
      },
      {
        title: 'Perubahan dan hubungan',
        steps: [
          'Kami mungkin mengemas kini terma ini dan akan memaklumkannya dalam aplikasi. Ada soalan? Hubungi Pejabat Pengurusan kejiranan anda.',
        ],
      },
    ],
  },
};

export const HELP: Record<Lang, HelpContent> = { en, ms };

/** The FAQ search: the words typed appear in the question or its answer, in any case. An empty search shows them all. */
export function faqMatches(item: FaqItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === '' || item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
}
