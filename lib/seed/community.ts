import type { SupabaseClient } from '@supabase/supabase-js';
import type { GroupCategory, GroupColour, ListingKind, PostType, ServiceCategory, ServiceKind } from '@/lib/domain/community';
import { mytDate } from '@/lib/domain/time';
import type { People, PersonKey } from './people';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type SeedComment = { by: PersonKey; hoursAgo: number; body: string; helpful?: number; helpfulBy?: PersonKey[] };
type SeedPost = { by: PersonKey; type: PostType; hoursAgo: number; body: string; comments?: SeedComment[] };
type SeedGroup = {
  name: string;
  category: GroupCategory;
  colour: GroupColour;
  /** The count shown; the people below are the members behind it who have accounts. */
  members: number;
  description: string;
  rules: string;
  /** The admin first: who, days since they joined, hours since they last opened the group (null: not since joining). */
  people: [PersonKey, number, number | null][];
  posts: SeedPost[];
};

// Spec §8.4: the five groups of the demo, with the canvas colours and member counts.
const GROUPS: SeedGroup[] = [
  {
    name: 'Elmina Mommies',
    category: 'family',
    colour: 'red',
    members: 128,
    description: 'Mums (and dads!) of Elmina sharing tips, playdates and hand-me-downs.',
    rules: 'Be kind, we are all learning.\nNo selling: lend, give away or swap instead.\nKeep children’s photos and addresses private.',
    // Aisyah joined 2.5 hours ago (still "today" for a reset any time after 2:30 am) and has not opened it since: the 5
    // posts of the others are new to her.
    people: [['meiLing', 400, 2], ['priya', 300, 5], ['siti', 250, 1], ['kavitha', 200, 30], ['farah', 150, 12], ['nurul', 60, 3], ['aisyah', 2.5 / 24, null]],
    posts: [
      {
        by: 'aisyah', type: 'question', hoursAgo: 2,
        body: 'Any good paediatrician near Elmina that opens on Sunday? My 2-year-old has had a fever since last night.',
        comments: [
          {
            by: 'meiLing', hoursAgo: 1.75, body: 'The clinic at Elmina Lakeside opens 9–1 on Sundays. Call first, the queue gets long!',
            helpful: 9, helpfulBy: ['siti', 'priya', 'kavitha', 'nurul', 'farah'],
          },
          { by: 'siti', hoursAgo: 1.25, body: 'Klinik Kanak-kanak Elmina pun buka pagi Ahad, tapi kena buat temujanji dulu.', helpful: 2, helpfulBy: ['meiLing', 'nurul'] },
          { by: 'priya', hoursAgo: 0.75, body: 'Hope your little one feels better soon ❤️' },
        ],
      },
      { by: 'meiLing', type: 'general', hoursAgo: 8, body: 'Reminder: free flu jabs for children under 5 at Klinik Kesihatan Elmina all of next week. Bring the pink book!' },
      { by: 'farah', type: 'general', hoursAgo: 10, body: 'Sesi bercerita percuma untuk kanak-kanak di dewan komuniti Elmina Green, Ahad ini jam 10 pagi. Bawa tikar sendiri 📚' },
      {
        by: 'priya', type: 'share_lend', hoursAgo: 20,
        body: 'Lending our stroller, barely used. Happy to lend it for a few weeks if you have a newborn or visitors with a baby coming 🍼',
        comments: [{ by: 'siti', hoursAgo: 18, body: 'So kind of you, Priya!' }],
      },
      {
        by: 'nurul', type: 'question', hoursAgo: 30, body: 'Ada sesiapa tahu kelas berenang untuk budak 4 tahun di sekitar Elmina? Hujung minggu lebih baik.',
        comments: [
          { by: 'siti', hoursAgo: 28, body: 'Cuba Aqua Kids di Elmina Lakeside, ada kelas pagi Sabtu.', helpful: 4, helpfulBy: ['nurul', 'kavitha'] },
          { by: 'meiLing', hoursAgo: 26, body: 'Anak saya belajar di sana, jurulatihnya sangat sabar 👍', helpful: 1, helpfulBy: ['nurul'] },
        ],
      },
      { by: 'kavitha', type: 'general', hoursAgo: 50, body: 'Who is coming to the toddler playdate on Saturday? It is pinned above 👆 Would be lovely to see new faces.' },
    ],
  },
  {
    name: 'Elmina Morning Runners',
    category: 'fitness',
    colour: 'orange',
    members: 64,
    description: 'Easy group runs around the lake, all paces welcome. Saturdays at 6:30 am.',
    rules: 'Wait for the last runner at every turn.\nWear something bright before sunrise.\nNo headphones at road crossings.',
    people: [['ahmad', 400, 6], ['meiLing', 300, 20], ['jason', 140, 30], ['daniel', 90, 26], ['aisyah', 60, 1], ['arif', 35, 3]],
    posts: [
      { by: 'arif', type: 'general', hoursAgo: 2, body: 'Saturday’s Fun Run is pinned above 👆 We warm up together at 6:45 by the lake. All paces welcome!' },
      {
        by: 'jason', type: 'question', hoursAgo: 48, body: 'Any tips on running shoes for flat feet? My knees hurt after 5K.',
        comments: [
          {
            by: 'ahmad', hoursAgo: 46, body: 'Get a stability shoe and have your gait checked at Active Sports in the mall. Made a big difference for me.',
            helpful: 3, helpfulBy: ['jason', 'meiLing'],
          },
          { by: 'arif', hoursAgo: 40, body: 'Also try shorter strides. My knees thanked me.', helpful: 1, helpfulBy: ['jason'] },
        ],
      },
      { by: 'meiLing', type: 'general', hoursAgo: 96, body: 'Larian pagi tadi best! 12 orang datang walaupun hujan renyai 🏃‍♀️' },
    ],
  },
  {
    name: 'Central Park Briskwalkers',
    category: 'fitness',
    colour: 'ink',
    members: 41,
    description: 'A brisk 45-minute loop of Central Park every evening at 7 pm.',
    rules: 'We start on time.\nWalk at most two abreast on the paths.\nTell the group if you spot a hazard on the route.',
    people: [['kavitha', 200, 10], ['ravi', 300, 48], ['weiMing', 280, 72], ['siti', 250, 30], ['aisyah', 120, 24]],
    posts: [
      { by: 'kavitha', type: 'general', hoursAgo: 72, body: 'Tonight’s loop starts 7 pm sharp at the fountain. Bring a torch, the east path lights are still out.' },
      {
        by: 'ravi', type: 'question', hoursAgo: 120, body: 'Ada sesiapa nak jalan pagi juga? Saya kerja syif malam minggu ni.',
        comments: [{ by: 'siti', hoursAgo: 118, body: 'Saya boleh! Jumpa 6.30 pagi di pintu masuk barat?', helpful: 1, helpfulBy: ['ravi'] }],
      },
    ],
  },
  {
    name: 'Sunday Futsal Dads',
    category: 'sports',
    colour: 'amber',
    members: 37,
    description: 'Five-a-side every Sunday at 5 pm on the Elmina futsal court. Dads of every level.',
    rules: 'Play fair, it is a friendly game.\nBring a light and a dark shirt.\nTell the group by Saturday night if you cannot make it.',
    people: [['hafiz', 250, 2], ['daniel', 200, 40], ['ahmad', 240, 30], ['jason', 100, 8], ['ravi', 180, 50]],
    posts: [
      { by: 'hafiz', type: 'general', hoursAgo: 6, body: 'Sunday 5 pm, we still need 2 more players! The friendly match is pinned above 👆' },
      { by: 'ahmad', type: 'share_lend', hoursAgo: 72, body: 'Boleh pinjam: bola futsal dan 10 bib. Mesej saya kalau perlukan.' },
    ],
  },
  {
    name: 'Elmina Toddler Playdates',
    category: 'family',
    colour: 'purple',
    members: 52,
    description: 'Playdates for little ones aged 1 to 4, most Saturdays at the Central Park playground.',
    rules: 'Parents stay with their children.\nAsk about allergies before sharing snacks.\nNo photos of other people’s children without asking.',
    people: [['siti', 280, 5], ['priya', 200, 30], ['kavitha', 150, 40], ['nurul', 60, 20]],
    posts: [
      { by: 'siti', type: 'general', hoursAgo: 120, body: 'Welcome, new parents! We meet at the Central Park playground most Saturdays at 10 am.' },
      {
        by: 'nurul', type: 'question', hoursAgo: 48, body: 'Taman permainan mana paling selamat untuk budak 2 tahun?',
        comments: [{ by: 'priya', hoursAgo: 44, body: 'The one in Central Park has soft flooring and lots of shade.', helpful: 2, helpfulBy: ['nurul', 'siti'] }],
      },
    ],
  },
];

/** Upcoming events of lib/seed/events.ts that belong to a group (ruling R6), pinned on its page. */
const EVENT_GROUPS = {
  'Elmina Fun Run 5K': 'Elmina Morning Runners',
  'Toddler playdate': 'Elmina Mommies',
  'Futsal friendly match': 'Sunday Futsal Dads',
} as const;

type SeedService = {
  by: PersonKey;
  kind: ServiceKind;
  category: ServiceCategory;
  title: string;
  daysAgo: number;
  price?: string;
  availability?: string;
  budget?: string;
  neededInDays?: number;
};

// Plan Task 14: the three cards of the approved canvas first (newest), then ten more, so every category has one. Tan Wei Ming is the canvas's
// "Mr Tan". The canvas cards have no availability or date, so they look exactly as approved.
const SERVICES: SeedService[] = [
  { by: 'farah', kind: 'offer', category: 'tutoring', title: 'Maths & Science tuition, Form 1–3', daysAgo: 1, price: 'RM40 / hour' },
  { by: 'ravi', kind: 'offer', category: 'repairs', title: 'Aircon servicing & small repairs', daysAgo: 2, price: 'From RM80' },
  { by: 'weiMing', kind: 'request', category: 'repairs', title: 'Need someone to fix a leaking sink this week', daysAgo: 1, budget: 'RM50–80' },
  { by: 'kavitha', kind: 'offer', category: 'pet_care', title: 'Dog walking and pet sitting', daysAgo: 4, price: 'RM15 / walk', availability: 'Mornings and evenings' },
  { by: 'hafiz', kind: 'offer', category: 'repairs', title: 'Plumbing: leaking taps and blocked drains', daysAgo: 6, price: 'From RM50', availability: 'Weekends' },
  { by: 'nurul', kind: 'offer', category: 'cleaning', title: 'House cleaning, 3-hour sessions', daysAgo: 8, price: 'RM60 / session', availability: 'Weekday mornings' },
  { by: 'jason', kind: 'offer', category: 'tutoring', title: 'Guitar lessons for beginners', daysAgo: 12, price: 'RM50 / hour', availability: 'Weekday evenings' },
  { by: 'priya', kind: 'request', category: 'pet_care', title: 'Cat sitter needed for 3 days next week', daysAgo: 2, budget: 'RM30 / day', neededInDays: 7 },
  { by: 'ahmad', kind: 'request', category: 'other', title: 'Two people to help move a sofa', daysAgo: 3, budget: 'RM100', neededInDays: 4 },
  { by: 'arif', kind: 'request', category: 'tutoring', title: 'Looking for an SPM English tutor', daysAgo: 5, budget: 'RM40 / hour' },
  { by: 'siti', kind: 'offer', category: 'food', title: 'Home-cooked nasi lemak, weekday lunch orders', daysAgo: 3, price: 'RM8 / pack', availability: 'Order by 9 am' },
  { by: 'meiLing', kind: 'offer', category: 'childcare', title: 'After-school babysitting, ages 4–10', daysAgo: 5, price: 'RM15 / hour', availability: 'Weekdays, 2–6 pm' },
  { by: 'hafiz', kind: 'request', category: 'eldercare', title: "Companion for my mother's clinic visits", daysAgo: 4, budget: 'RM30 / visit', neededInDays: 5 },
];

type SeedListing = {
  by: PersonKey;
  kind: ListingKind;
  emoji: string;
  title: string;
  description: string;
  daysAgo: number;
  swapFor?: string;
  /** A lend item is there for this many more days. */
  availableDays?: number;
};

// Plan Task 15: the six cards of the approved canvas (newest first), then six more. The canvas's "Nur" is Nurul Huda: the
// demo's Nur is still waiting for approval, and only verified residents list items.
const LISTINGS: SeedListing[] = [
  { by: 'ahmad', kind: 'lend', emoji: '🪜', title: 'Aluminium ladder (6 ft)', description: 'Good condition', daysAgo: 4, availableDays: 30 },
  { by: 'priya', kind: 'lend', emoji: '👶', title: 'Baby stroller', description: 'Barely used, folds flat', daysAgo: 5, availableDays: 45 },
  { by: 'meiLing', kind: 'give', emoji: '📚', title: 'Form 3 textbooks', description: 'Science, Maths and Sejarah, in good condition', daysAgo: 6 },
  {
    by: 'nurul', kind: 'swap', emoji: '🪴', title: 'Monstera ↔ herbs', description: 'A healthy Monstera cutting in a small pot',
    swapFor: 'Basil, mint or curry leaf cuttings', daysAgo: 7,
  },
  { by: 'ravi', kind: 'lend', emoji: '🛠️', title: 'Cordless drill', description: 'With two batteries and a set of bits', daysAgo: 8, availableDays: 60 },
  { by: 'daniel', kind: 'lend', emoji: '🏸', title: 'Badminton rackets', description: 'Two rackets and a tube of shuttlecocks', daysAgo: 9, availableDays: 60 },
  { by: 'siti', kind: 'give', emoji: '🧸', title: 'Baby clothes, 6–12 months', description: 'A bag of about 20 pieces, washed', daysAgo: 10 },
  { by: 'kavitha', kind: 'lend', emoji: '⛺', title: 'Camping tent for four', description: 'Easy to set up, with pegs and a ground sheet', daysAgo: 11, availableDays: 90 },
  { by: 'hafiz', kind: 'lend', emoji: '🔧', title: 'Pressure washer', description: 'Great for cars and porches', daysAgo: 12, availableDays: 60 },
  { by: 'jason', kind: 'swap', emoji: '🎮', title: 'Board games to swap', description: 'Monopoly and Scrabble, complete', swapFor: 'Any family board game', daysAgo: 13 },
  { by: 'farah', kind: 'give', emoji: '📖', title: "Children's storybooks", description: 'Bahasa Melayu and English, ages 4 to 8', daysAgo: 14 },
  { by: 'arif', kind: 'lend', emoji: '🚲', title: "Kids' bicycle (16 inch)", description: 'With training wheels', daysAgo: 15, availableDays: 30 },
];

/** The groups' rows, relative to `now`. Counters are what the RPCs would have left, except the larger shown counts. */
export function communityRows(now: Date, people: People) {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const groups = [];
  const members = [];
  const posts = [];
  const comments = [];
  const helpful = [];

  for (const g of GROUPS) {
    const id = crypto.randomUUID();
    const [admin, adminDays] = g.people[0];
    groups.push({
      id,
      township_id: people.townshipId,
      name: g.name,
      category: g.category,
      description: g.description,
      rules: g.rules,
      colour: g.colour,
      created_by: people.ids[admin],
      member_count: g.members,
      created_at: ago(adminDays * DAY),
    });
    for (const [who, days, visitHours] of g.people) {
      members.push({
        group_id: id,
        user_id: people.ids[who],
        role: who === admin ? 'admin' : 'member',
        joined_at: ago(days * DAY),
        last_visit_at: visitHours === null ? null : ago(visitHours * HOUR),
      });
    }
    for (const p of g.posts) {
      const postId = crypto.randomUUID();
      posts.push({
        id: postId,
        group_id: id,
        author_id: people.ids[p.by],
        type: p.type,
        body: p.body,
        comment_count: p.comments?.length ?? 0,
        created_at: ago(p.hoursAgo * HOUR),
      });
      for (const c of p.comments ?? []) {
        const commentId = crypto.randomUUID();
        comments.push({
          id: commentId,
          post_id: postId,
          author_id: people.ids[c.by],
          body: c.body,
          helpful_count: c.helpful ?? 0,
          created_at: ago(c.hoursAgo * HOUR),
        });
        for (const who of c.helpfulBy ?? []) {
          helpful.push({ comment_id: commentId, user_id: people.ids[who], created_at: ago((c.hoursAgo - 0.25) * HOUR) });
        }
      }
    }
  }
  // As create_service leaves them: an offer has no budget or date, a request no price or availability.
  const services = SERVICES.map((s) => ({
    id: crypto.randomUUID(),
    township_id: people.townshipId,
    kind: s.kind,
    category: s.category,
    title: s.title,
    description: null,
    price_text: s.price ?? null,
    availability_text: s.availability ?? null,
    budget_text: s.budget ?? null,
    needed_by: s.neededInDays === undefined ? null : mytDate(new Date(now.getTime() + s.neededInDays * DAY)),
    provider_id: people.ids[s.by],
    created_at: ago(s.daysAgo * DAY),
  }));
  // As create_listing leaves them: only a swap says what it wants, only a lend item has an end date.
  const dayFromNow = (days: number) => mytDate(new Date(now.getTime() + days * DAY));
  const listings = LISTINGS.map((l) => ({
    id: crypto.randomUUID(),
    township_id: people.townshipId,
    kind: l.kind,
    title: l.title,
    description: l.description,
    emoji: l.emoji,
    swap_for: l.swapFor ?? null,
    owner_id: people.ids[l.by],
    available_until: l.availableDays === undefined ? null : dayFromNow(l.availableDays),
    created_at: ago(l.daysAgo * DAY),
  }));
  // Aisyah borrows Ahmad's ladder (their chat in lib/seed/messages.ts): he has said yes, she picks it up tomorrow.
  const borrows = [
    {
      listing_id: listings.find((l) => l.title === 'Aluminium ladder (6 ft)')!.id,
      borrower_id: people.ids.aisyah,
      from_date: dayFromNow(1),
      to_date: dayFromNow(3),
      status: 'approved',
      created_at: ago(71 * HOUR),
      updated_at: ago(70 * HOUR),
    },
  ];
  return { groups, members, posts, comments, helpful, eventGroups: EVENT_GROUPS, services, listings, borrows };
}

/**
 * The five groups with their members, posts, comments and Helpful votes (pinning three upcoming events in their groups),
 * and the services offered and requested.
 */
export async function seedCommunity(admin: SupabaseClient, now: Date, people: People): Promise<void> {
  const { groups, members, posts, comments, helpful, eventGroups, services, listings, borrows } = communityRows(now, people);
  const tables: [string, Record<string, unknown>[]][] = [
    ['groups', groups],
    ['group_members', members],
    ['posts', posts],
    ['comments', comments],
    ['comment_helpful', helpful],
    ['services', services],
    ['listings', listings],
    ['borrow_requests', borrows],
  ];
  for (const [table, rows] of tables) {
    const { error } = await admin.from(table).insert(rows);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  // The events exist already (seedEvents runs first); they only learn their group.
  for (const [title, name] of Object.entries(eventGroups)) {
    const { error } = await admin
      .from('events')
      .update({ group_id: groups.find((g) => g.name === name)!.id })
      .eq('title', title);
    if (error) throw new Error(`events (${title}): ${error.message}`);
  }
  console.log(`groups: ${groups.length} with ${members.length} members, ${posts.length} posts and ${comments.length} comments`);
  console.log(`services: ${services.length}; listings: ${listings.length} with ${borrows.length} borrow`);
}
