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
} satisfies Record<string, string>;

export default en;
