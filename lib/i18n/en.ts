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
  'signup.unitNo.hint': 'Only the Management Office sees this.',
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
} satisfies Record<string, string>;

export default en;
