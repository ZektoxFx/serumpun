// English strings. Flat keys, `{name}` placeholders. Every later task appends its own keys here
// and in ms.ts (ms.ts is typed from this file, so a missing translation fails `tsc`).
const en = {
  // Landing / app
  'landing.tagline': 'Your township, together',

  // Bottom navigation
  'nav.home': 'Home',
  'nav.map': 'Map',
  'nav.create': 'Create',
  'nav.community': 'Community',
  'nav.me': 'Me',
  'nav.label': 'Main menu',

  // Create sheet (the + button)
  'create.report': 'Report an issue',
  'create.alert': 'Drop a map alert',
  'create.post': 'Post in a group',
  'create.service': 'Offer or request a service',
  'create.item': 'List an item',
  'create.event': 'Create an event',

  // Community tabs
  'community.tab.groups': 'Groups',
  'community.tab.events': 'Events',
  'community.tab.services': 'Services',
  'community.tab.share': 'Share & Lend',

  // Common buttons
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.send': 'Send',
  'common.join': 'Join',
  'common.message': 'Message',

  // Home greeting (picked by Malaysia time of day)
  'home.greeting.morning': 'Good morning, {name}',
  'home.greeting.afternoon': 'Good afternoon, {name}',
  'home.greeting.evening': 'Good evening, {name}',

  // Home
  'home.status.verified': 'Verified resident ✓',
  'home.status.pending': 'Waiting for approval',
  'home.report.body': 'Goes straight to the Management Office',
  'home.tile.map': 'Live Map',
  'home.tile.book': 'Book Court',
  'home.tile.rewards': 'Rewards',
  'home.tile.issues': 'Issue Board',
  'home.happening': 'Happening now',
  'home.happening.empty': 'All quiet right now',
  'home.happening.emptyHint': 'Alerts, notices from the Management Office and events nearby will show up here.',

  // Points (the ★ is drawn next to the number, not part of the text)
  'points.count': '{n} points',

  // Header icons
  'messages.title': 'Messages',

  // Notifications
  'notifications.title': 'Notifications',
  'notifications.bellUnread': 'Notifications, {n} unread',
  'notifications.markAll': 'Mark all read',
  'notifications.unread': 'Unread',
  'notifications.empty': 'No notifications yet',
  'notifications.emptyHint': 'Updates on your reports, bookings and account will show up here.',

  // Me
  'me.points': 'Your points',
  'me.rewards': 'Rewards →',
  'me.vouchers': 'My vouchers',
  'me.reports': 'My reports',
  'me.bookings': 'My bookings',
  'me.listings': 'My listings',
  'me.pointsHistory': 'Points history',
  'me.darkMode': 'Dark mode',
  'me.township': 'Township',

  // Landing page
  'landing.demo.title': 'Try the demo',
  'landing.demo.aisyah': 'Try as Aisyah (resident)',
  'landing.demo.nur': 'Try as Nur (waiting for approval)',
  'landing.demo.office': 'Try as Management Office',
  'landing.demo.error': 'The demo sign-in did not work. Please try again.',
  'landing.signIn.title': 'Sign in',
  'landing.newHere': 'New to Serumpun?',
  'landing.createAccount': 'Create an account',

  // Accounts
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.signIn': 'Sign in',
  'auth.signOut': 'Sign out',
  'auth.error.signIn': 'Email or password is incorrect.',

  // Sign-up
  'signup.title': 'Create your account',
  'signup.intro': 'The Management Office checks your house or unit number before you can post.',
  'signup.township': 'Township',
  'signup.comingSoon': '{name} (coming soon)',
  'signup.neighbourhood': 'Neighbourhood',
  'signup.neighbourhood.hint': 'For example, Elmina Valley 3',
  'signup.unitNo': 'House / unit no.',
  'signup.unitNo.hint': 'The Management Office uses this to verify you.',
  'signup.demoNotice':
    'This is a public demo: anyone can try the Management Office view. Please use a made-up name and address.',
  'signup.fullName': 'Full name',
  'signup.password.hint': 'At least 8 characters.',
  'signup.submit': 'Create account',
  'signup.haveAccount': 'Already have an account?',
  'signup.error.required': 'Please fill this in.',
  'signup.error.email': 'Enter a valid email address.',
  'signup.error.emailTaken': 'This email already has an account. Sign in instead.',
  'signup.error.password': 'Use 8 to 72 characters.',
  'signup.error.townshipSoon': 'Serumpun is not open in this township yet.',

  // Account status and roles
  'pending.banner':
    'Your account is waiting for approval from the Management Office. You can look around; posting opens once you are verified.',
  'rejected.title': 'Your application was not approved',
  'rejected.body': 'Please contact the Management Office.',
  'role.resident': 'Resident',
  'role.management': 'Management Office',

  // Language switch
  'lang.label': 'Language',
  'lang.en': 'English',
  'lang.ms': 'Bahasa Malaysia',

  // Relative times (lib/domain/time.ts)
  'time.justNow': 'just now',
  'time.minutes': '{n} min ago',
  'time.hours': '{n} h ago',
  'time.days': '{n} d ago',

  // Notification titles: the database stores these keys in notifications.title_key
  'notify.account.verified': 'Your account is approved. Welcome to Serumpun!',
  'notify.account.rejected': 'Your sign-up was not approved. Please contact the Management Office.',

  'common.error': 'Something went wrong. Please try again.',
  // Every create/act screen shows this to a pending resident, with its submit disabled (Task 4 ruling).
  'common.pendingCantAct': 'You can do this once the Management Office approves your account.',

  // Alert types and severities (lib/domain/alerts.ts)
  'alert.type.accident': 'Accident',
  'alert.type.snake': 'Snake / wild animal',
  'alert.type.suspicious': 'Suspicious person',
  'alert.type.stray_dogs': 'Stray dogs',
  'alert.type.flood': 'Flood / big puddle',
  'alert.type.fallen_tree': 'Fallen tree',
  'alert.type.walkway_blocked': 'Walkway blocked',
  'alert.type.streetlight': 'Streetlight out',
  'alert.type.police': 'Police / roadblock',
  'severity.high': 'High',
  'severity.medium': 'Medium',
  'severity.low': 'Low',

  // Named places (lib/domain/places.ts)
  'place.centralPark': 'Elmina Valley Central Park',
  'place.joggingTrack': 'Central Park jogging track',
  'place.carPark': 'Central Park car park',
  'place.mall': 'Elmina Lakeside Mall',
  'place.persiaranTamarind': 'Persiaran Tamarind',
  'place.persiaranElmina': 'Persiaran Elmina',
  'place.persiaranGarcinia': 'Persiaran Garcinia',
  'place.valley3': 'Elmina Valley 3',

  // Live Map
  'map.label': 'Map of alerts. Use the arrow keys to move it.',
  'map.loading': 'Loading the map…',
  'map.picker': 'Pin location. Use the arrow keys to move the map under the pin.',
  'map.search': 'Search alerts',
  'map.search.placeholder': 'Search alerts in {township}',
  'map.search.clear': 'Clear search',
  'map.zoomIn': 'Zoom in',
  'map.zoomOut': 'Zoom out',
  'map.locate': 'Show where I am',
  'map.recentre': 'Back to {township}',
  'map.drop.open': 'Drop alert',
  'map.readOnly': 'View only: you can post and vote once you are approved.',
  'map.shown': '{shown} of {total} alerts',
  'map.quiet': 'All quiet: no alerts right now',
  'map.clear': 'Clear',
  'map.posted': 'Posted. Neighbours nearby can see it now.',
  'map.pin.confirmed': '{type}, {severity} severity, last confirmed {time}',
  'map.pin.reported': '{type}, {severity} severity, reported {time}',
  'map.pin.official': '{type}, {severity} severity, notice from the Management Office',

  // Live Map: an alert's sheet
  'map.alert.near': 'Near {place}',
  'map.alert.fromYou': '{distance} from you',
  'map.alert.official': 'Management Office',
  'map.alert.firstReported': 'First reported',
  'map.alert.byNeighbour': 'by a verified neighbour',
  'map.alert.byYou': 'by you',
  'map.alert.byOffice': 'by the Management Office',
  'map.alert.lastConfirmed': 'Last confirmed',
  'map.alert.notYet': 'Not yet',
  'map.alert.confirmedOne': '1 neighbour so far',
  'map.alert.confirmedMany': '{n} neighbours so far',
  'map.alert.noOne': 'No neighbour has confirmed it',
  'map.alert.goneVotes': '“Gone” votes: {n} of 3',
  'map.alert.stays': 'Stays until',
  'map.alert.staysValue': 'The office removes it',
  'map.alert.staysHint': 'Official notice',
  'map.alert.stillThere': 'Still there',
  'map.alert.gone': 'Gone',
  'map.alert.yourVote.still_there': 'You said it is still there. You can change your vote.',
  'map.alert.yourVote.gone': 'You said it is gone. You can change your vote.',
  'map.alert.yours': 'You posted this alert. Neighbours confirm it or mark it gone.',
  'map.alert.escalate': 'Lasting problem? Send to Management Office',

  // Live Map: dropping an alert
  'map.drop.atYou': 'At your current location',
  'map.drop.atPin': 'Where the pin is',
  'map.drop.movePin': 'Move pin',
  'map.drop.pinDone': 'Done',
  'map.drop.pinHint': 'Drag the map until the pin sits on the spot.',
  'map.drop.noGps': 'We could not get your location, so place the pin yourself.',
  'map.drop.type': 'What did you see?',
  'map.drop.severity': 'How serious is it?',
  'map.drop.note': 'Note (optional)',
  'map.drop.noteHint': 'Keep it short. No names or house numbers.',
  'map.drop.fine': 'Neighbours see the alert but not who posted it. It fades after 2 hours unless someone confirms it.',
  'map.drop.post': 'Post to map',

  // Live Map: filters
  'map.filter.title': 'Filter alerts',
  'map.filter.distance': 'Distance from me',
  'map.filter.anyDistance': 'Whole township',
  'map.filter.noLocation': 'The distance filter works once this site may use your location.',
  'map.filter.severity': 'Severity',
  'map.filter.type': 'Type',
  'map.filter.chip.distance': 'Distance',
  'map.filter.within': 'Within {distance}',
  'map.filter.show': 'Show {n} alerts',
  'map.filter.showOne': 'Show 1 alert',
  'map.filter.showNone': 'No alerts match',
  'map.filter.reset': 'Reset',

  // Live Map: what the alert RPCs refuse (alertErrorKey)
  'map.error.type': 'Pick what kind of alert it is.',
  'map.error.severity': 'Pick how serious it is.',
  'map.error.outOfArea': 'That spot is too far from your township. Move the pin closer.',
  'map.error.photo': 'Photos cannot be added to alerts yet.',
  'map.error.vote': 'Choose Still there or Gone.',
  'map.error.notFound': 'This alert is no longer on the map.',
  'map.error.ownAlert': 'You posted this alert, so your neighbours confirm it.',
  'map.error.officialPin': 'Management Office notices cannot be voted on.',
  'map.error.notActive': 'This alert has already faded or been cleared.',
  'map.error.notManagement': 'Only the Management Office can do this.',
} satisfies Record<string, string>;

export default en;
