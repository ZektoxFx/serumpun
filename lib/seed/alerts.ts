import type { SupabaseClient } from '@supabase/supabase-js';
import type { AlertType, Severity } from '@/lib/domain/alerts';
import type { People, PersonKey } from './people';

const MINUTE = 60_000;
const ALERT_LIFE = 2 * 60 * MINUTE; // as in vote_alert: 2 hours after the last "still there"

type SeedAlert = {
  type: AlertType;
  severity: Severity;
  lat: number;
  lng: number;
  note: string;
  by: PersonKey;
  /** Minutes since it was first reported. */
  ago: number;
  official?: true;
  /** "Still there" votes, oldest first. The last one is the last confirmation, `confirmedAgo` minutes ago. */
  stillThere?: PersonKey[];
  confirmedAgo?: number;
  gone?: PersonKey[];
};

// Around Elmina Valley Central Park. Coordinates follow OpenStreetMap: the park's footpaths, Persiaran Elmina,
// Persiaran Tamarind by the mall, Persiaran Garcinia, and the Jalan Metafasa U16 streets south of the park that the
// demo calls "Elmina Valley 3". Each alert is still live at seed time (posted or confirmed under 2 hours ago).
const ALERTS: SeedAlert[] = [
  // The demo story's alert: on the park track between Elmina Valley 3 and the mall, which Safe Walk routes around.
  // Aisyah and Daniel have not voted on it, so either can tap "Still there" live.
  {
    type: 'stray_dogs', severity: 'medium', lat: 3.17841, lng: 101.51411, by: 'ahmad', ago: 48, confirmedAgo: 2,
    note: 'Pack of 5 stray dogs on the jogging track by the field. They chase joggers.',
    stillThere: ['meiLing', 'priya', 'ravi', 'farah', 'weiMing', 'siti', 'hafiz', 'kavitha'],
  },
  {
    type: 'streetlight', severity: 'low', lat: 3.17643, lng: 101.51628, by: 'aisyah', ago: 100, confirmedAgo: 25,
    note: 'Streetlight out on Jalan Elmina Valley 3/2. Very dark after 7 pm.',
    stillThere: ['farah', 'meiLing'],
  },
  {
    type: 'police', severity: 'low', lat: 3.18136, lng: 101.51555, by: 'ravi', ago: 35, confirmedAgo: 8,
    note: 'Police roadblock on Persiaran Elmina towards the highway. Expect a queue.',
    stillThere: ['jason', 'nurul', 'arif'],
  },
  {
    type: 'flood', severity: 'medium', lat: 3.18187, lng: 101.51114, by: 'priya', ago: 75, confirmedAgo: 12,
    note: 'Big puddle on Persiaran Tamarind by the Elmina Lakeside Mall car park entrance. Ankle deep.',
    stillThere: ['kavitha', 'siti', 'weiMing', 'hafiz'], gone: ['jason'],
  },
  {
    type: 'fallen_tree', severity: 'medium', lat: 3.18074, lng: 101.51772, by: 'siti', ago: 55, confirmedAgo: 20,
    note: "Fallen tree across the north footpath after last night's storm.",
    stillThere: ['arif', 'nurul'],
  },
  {
    type: 'snake', severity: 'high', lat: 3.17928, lng: 101.51627, by: 'kavitha', ago: 22, confirmedAgo: 9,
    note: 'Ular sawa dekat tasik, tepi laluan pejalan kaki. Jaga anak-anak!',
    stillThere: ['priya'],
  },
  {
    type: 'accident', severity: 'high', lat: 3.17783, lng: 101.51027, by: 'jason', ago: 14, confirmedAgo: 5,
    note: 'Minor accident on Persiaran Elmina by the lake. Left lane blocked.',
    stillThere: ['ravi', 'meiLing'],
  },
  {
    type: 'suspicious', severity: 'high', lat: 3.18161, lng: 101.51588, by: 'nurul', ago: 26,
    note: 'Man checking car doors at the Central Park car park. Grey cap, black backpack.',
  },
  {
    type: 'walkway_blocked', severity: 'medium', lat: 3.17528, lng: 101.51708, by: 'hafiz', ago: 40, confirmedAgo: 30,
    note: 'Lorry parked across the walkway on Jalan Elmina Valley 3/4.',
    stillThere: ['ahmad'],
  },
  {
    type: 'streetlight', severity: 'low', lat: 3.18186, lng: 101.51863, by: 'weiMing', ago: 65,
    note: 'Two lamps out on the north loop of the jogging track.',
  },
  // Official pins: no expiry and no votes. A water cut is no walking hazard, so it is low (Safe Walk skips low); the road
  // works divert the footpath, so they are medium.
  {
    type: 'water_cut', severity: 'low', lat: 3.17585, lng: 101.51665, by: 'office', ago: 300, official: true,
    note: 'Water supply disruption in Elmina Valley 3 for pipe repairs. A water tanker is at the playground.',
  },
  {
    type: 'road_works', severity: 'medium', lat: 3.17942, lng: 101.50514, by: 'office', ago: 2 * 24 * 60, official: true,
    note: 'Road works on Persiaran Garcinia. One lane closed and the footpath diverted.',
  },
];

/** 12 live alerts with their votes. Counts are set to match the votes, as vote_alert would have left them. */
export async function seedAlerts(admin: SupabaseClient, now: Date, people: People): Promise<void> {
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * MINUTE);
  const alerts = [];
  const votes = [];
  for (const a of ALERTS) {
    const voters = [...(a.stillThere ?? []), ...(a.gone ?? [])];
    // vote_alert refuses the poster and allows one vote each; 3 "gone" would have cleared the alert.
    if (voters.includes(a.by) || new Set(voters).size !== voters.length || (a.gone ?? []).length >= 3) {
      throw new Error(`seed alert ${a.type} by ${a.by}: impossible votes`);
    }
    const id = crypto.randomUUID();
    const reported = at(a.ago);
    const confirmed = a.stillThere?.length ? at(a.confirmedAgo!) : reported;
    alerts.push({
      id,
      township_id: people.townshipId,
      type: a.type,
      severity: a.severity,
      lat: a.lat,
      lng: a.lng,
      note: a.note,
      created_by: people.ids[a.by],
      is_official: a.official ?? false,
      confirm_count: a.stillThere?.length ?? 0,
      gone_count: a.gone?.length ?? 0,
      created_at: reported.toISOString(),
      last_confirmed_at: confirmed.toISOString(),
      expires_at: a.official ? null : new Date(confirmed.getTime() + ALERT_LIFE).toISOString(),
    });
    // "Still there" votes evenly spaced after the report, ending at the last confirmation; "gone" votes halfway.
    const span = confirmed.getTime() - reported.getTime();
    const stillThere = a.stillThere ?? [];
    for (const [i, who] of stillThere.entries()) {
      const when = new Date(reported.getTime() + (span * (i + 1)) / stillThere.length);
      votes.push({ alert_id: id, user_id: people.ids[who], vote: 'still_there', created_at: when.toISOString() });
    }
    for (const who of a.gone ?? []) {
      const when = new Date(reported.getTime() + span / 2);
      votes.push({ alert_id: id, user_id: people.ids[who], vote: 'gone', created_at: when.toISOString() });
    }
  }

  const { error: alertError } = await admin.from('alerts').insert(alerts);
  if (alertError) throw new Error(`alerts: ${alertError.message}`);
  const { error: voteError } = await admin.from('alert_votes').insert(votes);
  if (voteError) throw new Error(`alert_votes: ${voteError.message}`);
  console.log(`alerts: ${alerts.length} with ${votes.length} votes`);
}
