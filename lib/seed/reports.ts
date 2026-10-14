import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReportCategory, ReportStatus, ReportTeam } from '@/lib/domain/reports';
import { startOfMytMonth } from '@/lib/domain/time';
import type { People, PersonKey } from './people';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type SeedReport = {
  category: ReportCategory;
  title: string;
  place: string;
  lat: number;
  lng: number;
  by: PersonKey;
  /** Hours since it was reported. */
  ago: number;
  status: ReportStatus;
  team?: ReportTeam;
  private?: true;
  description?: string;
  /** The Me-too count shown, and the neighbours with accounts among them (the rest have no demo account). */
  metoo?: number;
  metooBy?: PersonKey[];
  /** The Management Office's steps after "submitted": [status, hours after the report, message]. */
  steps?: [ReportStatus, number, string?][];
  /** "Fixed" / "Not fixed" after the latest fix, 2 hours apart. The reporter's answer is also a timeline step. */
  answers?: [PersonKey, boolean][];
};

// Around Elmina Valley Central Park, near the seeded alerts. Aisyah sent #1042 (her street) and the private security
// report, so she follows both; she said Me too on the pothole (the office moves it in the demo) and on the grass, which
// waits for her Fixed / Not fixed. Daniel has not said Me too on #1042, so he can tap it live.
export const REPORTS: SeedReport[] = [
  {
    category: 'streetlight', title: 'Streetlight not working', place: 'Jalan Elmina Valley 3/2', lat: 3.17643, lng: 101.51628,
    by: 'aisyah', ago: 50, status: 'in_progress', team: 'facilities',
    description: 'The lamp outside No. 20 has been off for three nights. The street is very dark after 7 pm.',
    metoo: 13, metooBy: ['meiLing', 'ahmad', 'farah', 'arif', 'priya', 'weiMing', 'siti', 'hafiz'],
    steps: [['acknowledged', 5.3], ['in_progress', 25, 'Contractor booked for Friday morning to replace the lamp.']],
  },
  {
    category: 'road', title: 'Pothole at Lakeside roundabout', place: 'Lakeside roundabout, Persiaran Tamarind', lat: 3.1822, lng: 101.5122,
    by: 'ravi', ago: 26, status: 'acknowledged', team: 'roads',
    description: 'Deep pothole on the inner lane. Motorcycles swerve around it.',
    metoo: 27, metooBy: ['aisyah', 'daniel', 'priya', 'kavitha', 'siti', 'weiMing', 'hafiz', 'jason', 'nurul', 'arif', 'farah', 'ahmad'],
    steps: [['acknowledged', 3, 'The Roads team will inspect it this week.']],
  },
  {
    category: 'tree', title: 'Fallen branch on jogging track', place: 'Central Park jogging track', lat: 3.17975, lng: 101.515,
    by: 'ahmad', ago: 2, status: 'submitted',
    metoo: 3, metooBy: ['siti', 'jason', 'hafiz'],
  },
  {
    category: 'rubbish', title: 'Overflowing bin, Central Park', place: 'Central Park, by the playground', lat: 3.1799, lng: 101.5164,
    by: 'meiLing', ago: 54, status: 'confirmed', team: 'cleaning',
    metoo: 9, metooBy: ['priya', 'ahmad', 'ravi', 'farah', 'weiMing', 'siti', 'hafiz', 'kavitha', 'daniel'],
    steps: [['acknowledged', 1], ['resolved', 6, 'Bin emptied, and a second bin added by the playground.']],
    answers: [
      ['priya', true], ['ahmad', true], ['ravi', true], ['farah', true], ['weiMing', true],
      ['siti', true], ['hafiz', true], ['kavitha', true], ['meiLing', true],
    ],
  },
  {
    category: 'drain', title: 'Blocked drain, Valley 5', place: 'Jalan Elmina Valley 5/1', lat: 3.1742, lng: 101.5195,
    by: 'hafiz', ago: 5, status: 'submitted',
    metoo: 6, metooBy: ['kavitha', 'nurul', 'arif', 'jason'],
  },
  {
    category: 'park', title: 'Broken swing at the playground', place: 'Central Park playground', lat: 3.1801, lng: 101.516,
    by: 'kavitha', ago: 27, status: 'acknowledged', team: 'landscape',
    metoo: 4, metooBy: ['siti', 'priya', 'nurul'],
    steps: [['acknowledged', 4, 'Swing taped off. The Landscape team will replace the chain.']],
  },
  {
    category: 'walkway', title: 'Cracked walkway, Persiaran Elmina', place: 'Persiaran Elmina, by the bus stop', lat: 3.1785, lng: 101.5115,
    by: 'weiMing', ago: 98, status: 'in_progress', team: 'facilities',
    metoo: 8, metooBy: ['ravi', 'jason', 'kavitha', 'nurul', 'arif'],
    steps: [['acknowledged', 20], ['in_progress', 50, 'Contractor is replacing the broken tiles this week.']],
  },
  {
    category: 'security', title: 'Stranger checking house gates at night', place: 'Jalan Elmina Valley 3/2', lat: 3.1765, lng: 101.5161,
    by: 'aisyah', ago: 20, status: 'acknowledged', team: 'security', private: true,
    description: 'Around 2 am a man walked along the street trying each gate. He left when a dog barked.',
    steps: [['acknowledged', 2, 'Our guards will patrol your street every night this week.']],
  },
  {
    category: 'animals', title: "Neighbour's dog barks all night", place: 'Jalan Elmina Valley 3/4', lat: 3.1753, lng: 101.5171,
    by: 'daniel', ago: 9, status: 'submitted', private: true,
    description: 'It barks from 11 pm until morning most nights. We have asked them politely.',
  },
  {
    category: 'drain', title: 'Drain overflows after rain', place: 'Jalan Elmina Green 1/1', lat: 3.183, lng: 101.519,
    by: 'siti', ago: 146, status: 'reopened', team: 'cleaning',
    metoo: 5, metooBy: ['ravi', 'jason', 'nurul'],
    steps: [['acknowledged', 6], ['resolved', 70, 'Drain cleared of leaves and silt.']],
    answers: [['jason', true], ['siti', false]],
  },
  {
    category: 'tree', title: 'Overgrown grass at Elmina Green field', place: 'Elmina Green field', lat: 3.1838, lng: 101.5168,
    by: 'nurul', ago: 72, status: 'resolved', team: 'landscape',
    metoo: 3, metooBy: ['aisyah', 'jason', 'ravi'],
    steps: [['acknowledged', 8], ['resolved', 52, 'Grass cut along the whole field.']],
    answers: [['jason', true]],
  },
  {
    category: 'animals', title: 'Stray dogs near the playground', place: 'Central Park playground', lat: 3.1803, lng: 101.5157,
    by: 'farah', ago: 18, status: 'acknowledged', team: 'security',
    metoo: 11, metooBy: ['meiLing', 'priya', 'kavitha', 'siti', 'nurul', 'arif'],
    steps: [['acknowledged', 3, "We have called the council's animal control unit."]],
  },
  {
    category: 'road', title: 'Faded zebra crossing near the school', place: 'Persiaran Elmina, by the school', lat: 3.1812, lng: 101.5135,
    by: 'priya', ago: 120, status: 'confirmed', team: 'roads',
    metoo: 6, metooBy: ['kavitha', 'weiMing', 'siti', 'ahmad'],
    steps: [['acknowledged', 24], ['in_progress', 60], ['resolved', 90, 'Crossing repainted.']],
    answers: [['kavitha', true], ['weiMing', false], ['siti', true], ['priya', true]],
  },
  {
    category: 'streetlight', title: 'Two lamps out on the north loop', place: 'Central Park north loop', lat: 3.18186, lng: 101.51863,
    by: 'jason', ago: 1, status: 'submitted',
    metoo: 2, metooBy: ['weiMing', 'nurul'],
  },
  {
    category: 'rubbish', title: 'Bulky waste dumped by the field', place: 'Elmina Valley 2 field', lat: 3.1748, lng: 101.5122,
    by: 'arif', ago: 96, status: 'confirmed', team: 'cleaning',
    metoo: 4, metooBy: ['hafiz', 'nurul'],
    steps: [['acknowledged', 12], ['resolved', 52, 'Waste removed by the Cleaning team.']],
    answers: [['arif', true]],
  },
];

// The scorecard's bulk: plain reports fixed earlier this month by background residents, enough for "48 resolved this
// month, 2.4 days to fix, 92% say fixed" on any day of the month (tests/reports.test.ts checks this).
const BULK = 44;
const BACKGROUND: PersonKey[] = ['meiLing', 'priya', 'ahmad', 'ravi', 'farah', 'weiMing', 'siti', 'hafiz', 'kavitha', 'jason', 'nurul', 'arif'];
const FIX_DAYS = [1.2, 3.1, 2.0, 2.8, 1.6, 3.2, 2.3, 1.9, 2.9, 2.6, 2.8]; // averages 2.4
const AREAS = ['Elmina Green 1', 'Elmina Gardens 2', 'Elmina Valley 2', 'Elmina Valley 3', 'Elmina Valley 5'];
const BULK_KIND: Record<ReportCategory, [what: string, team: ReportTeam, fix: string]> = {
  streetlight: ['Lamp out', 'facilities', 'Lamp replaced.'],
  road: ['Pothole', 'roads', 'Pothole patched.'],
  tree: ['Overgrown hedge', 'landscape', 'Hedge trimmed back.'],
  rubbish: ['Rubbish not collected', 'cleaning', 'Collected by the Cleaning team.'],
  drain: ['Clogged drain', 'cleaning', 'Drain cleared.'],
  park: ['Broken bench', 'landscape', 'Bench repaired.'],
  walkway: ['Uneven paving', 'facilities', 'Paving relaid.'],
  security: ['Guardhouse barrier stuck', 'security', 'Barrier motor replaced.'],
  animals: ['Stray cats in the bin area', 'security', 'Animal control has visited.'],
};
const CATEGORIES = Object.keys(BULK_KIND) as ReportCategory[];

/** One report as the seed describes it: absolute times in ms; `steps` are the office's. */
type Built = Omit<SeedReport, 'ago' | 'steps' | 'answers'> & {
  created: number;
  steps: { status: ReportStatus; at: number; message?: string }[];
  answers: { who: PersonKey; fixed: boolean; at: number }[];
};

/**
 * Every row the reporting seed inserts, in insertion order. ref_no follows that order from 1001 (wipe_demo_data restarts
 * it), and the #1042 streetlight is the 42nd report, so each reseed gives the same numbers.
 */
export function reportRows(now: Date, people: People) {
  const iso = (ms: number) => new Date(ms).toISOString();

  function rows(b: Built) {
    const id = crypto.randomUUID();
    const by = people.ids[b.by];
    const reporterAnswer = b.answers.find((a) => a.who === b.by);
    const steps = [
      { status: 'submitted', at: b.created, author: by, message: null as string | null },
      ...b.steps.map((s) => ({ status: s.status, at: s.at, author: people.ids.office, message: s.message ?? null })),
      ...(reporterAnswer ? [{ status: reporterAnswer.fixed ? 'confirmed' : 'reopened', at: reporterAnswer.at, author: by, message: null }] : []),
    ];
    const metooBy = (b.metooBy ?? []).map((who, i) => ({ who, at: b.created + (i + 1) * 7 * MINUTE }));
    const fixed = b.steps.findLast((s) => s.status === 'resolved');
    return {
      report: {
        id,
        township_id: people.townshipId,
        category: b.category,
        title: b.title,
        description: b.description ?? null,
        lat: b.lat,
        lng: b.lng,
        location_text: b.place,
        is_private: b.private ?? false,
        created_by: by,
        status: b.status,
        team: b.team ?? null,
        metoo_count: b.metoo ?? 0,
        created_at: iso(b.created),
        updated_at: iso(Math.max(...steps.map((s) => s.at), ...b.answers.map((a) => a.at), ...metooBy.map((m) => m.at))),
        resolved_at: b.status === 'resolved' || b.status === 'confirmed' ? iso(fixed!.at) : null,
      },
      metoo: metooBy.map((m) => ({ report_id: id, user_id: people.ids[m.who], created_at: iso(m.at) })),
      updates: steps.map((s) => ({ report_id: id, author_id: s.author, status: s.status, message: s.message, created_at: iso(s.at) })),
      confirmations: b.answers.map((a) => ({ report_id: id, user_id: people.ids[a.who], fixed: a.fixed, created_at: iso(a.at) })),
    };
  }

  // Resolved inside this Malaysian month (however young it is), each answered between its fix and now.
  const monthStart = startOfMytMonth(now).getTime();
  const bulk: Built[] = Array.from({ length: BULK }, (_, i) => {
    const category = CATEGORIES[i % CATEGORIES.length];
    const [what, team, fix] = BULK_KIND[category];
    const area = AREAS[i % AREAS.length];
    const resolved = monthStart + ((now.getTime() - monthStart) * 0.9 * (i + 0.5)) / BULK;
    const created = resolved - FIX_DAYS[i % FIX_DAYS.length] * DAY;
    const answerAt = (k: number) => resolved + ((now.getTime() - resolved) * k) / 4;
    const [by, first, second] = [BACKGROUND[i % 12], BACKGROUND[(i + 1) % 12], BACKGROUND[(i + 5) % 12]];
    // Four reporters in five confirm; now and then a neighbour says it is not fixed (one "not fixed" never reopens).
    const confirmed = i % 5 !== 4;
    const answers = [{ who: first, fixed: true, at: answerAt(1) }];
    if (i % 2 === 0) answers.push({ who: second, fixed: i % 6 !== 0, at: answerAt(2) });
    if (confirmed) answers.push({ who: by, fixed: true, at: answerAt(3) });
    return {
      category, title: `${what}, ${area}`, place: `Jalan ${area}/${(i % 6) + 1}`,
      lat: 3.1797 + (((i * 37) % 21) - 10) * 0.0004, lng: 101.5156 + (((i * 53) % 21) - 10) * 0.0004,
      by, status: confirmed ? 'confirmed' : 'resolved', team, metoo: 2 + (i % 5), metooBy: [first, second], created,
      steps: [{ status: 'resolved', at: resolved, message: fix }], answers,
    };
  });

  const story: Built[] = REPORTS.map(({ ago, steps = [], answers = [], ...r }) => {
    const created = now.getTime() - ago * HOUR;
    const fixedAt = steps.findLast(([status]) => status === 'resolved')?.[1];
    return {
      ...r,
      created,
      steps: steps.map(([status, after, message]) => ({ status, at: created + after * HOUR, message })),
      answers: answers.map(([who, fixed], k) => ({ who, fixed, at: created + (fixedAt! + 2 * (k + 1)) * HOUR })),
    };
  });

  const all = [...bulk.slice(0, 41), story[0], ...bulk.slice(41), ...story.slice(1)].map(rows);
  return {
    reports: all.map((r) => r.report),
    metoo: all.flatMap((r) => r.metoo),
    updates: all.flatMap((r) => r.updates),
    confirmations: all.flatMap((r) => r.confirmations),
  };
}

/** 15 reports across every status and category, plus the month's resolved ones. Inserted in order (see reportRows). */
export async function seedReports(admin: SupabaseClient, now: Date, people: People): Promise<void> {
  const { reports, metoo, updates, confirmations } = reportRows(now, people);
  const tables: [string, Record<string, unknown>[]][] = [
    ['reports', reports],
    ['report_metoo', metoo],
    ['report_updates', updates],
    ['report_confirmations', confirmations],
  ];
  for (const [table, rows] of tables) {
    const { error } = await admin.from(table).insert(rows);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  // ref_no follows insertion order: make sure the demo's report really is #1042.
  const { data: hero } = await admin.from('reports').select('ref_no').eq('id', reports[41].id).single();
  if (hero?.ref_no !== 1042) throw new Error(`reports: the streetlight got #${hero?.ref_no}, not #1042`);
  console.log(`reports: ${reports.length} with ${metoo.length} Me toos, ${updates.length} updates, ${confirmations.length} answers`);
}
