import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReaderScreen } from '@/components/reader/ReaderScreen';
import { publicJwkFromSigningKey } from '@/lib/card/crypto';
import { DEMO_PIN } from '@/lib/card/pin';
import { loadMyCard } from '@/lib/card/summary';
import { SPORTS, type Sport } from '@/lib/domain/booking';
import { env } from '@/lib/env';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionProfile } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'reader.title') };
}

/**
 * The township's card reader for the demo (spec section 9). Public: a judge needs no account, so proxy.ts lets it through
 * and nothing here asks for a session. Visitors have no database access, so the service role reads only public labels
 * (the township and its facilities); the public key comes from the signing key's public half. The phone beside the
 * reader holds the card of whoever is signed in on this browser, read as that person.
 */
export default async function ReaderPage() {
  const admin = createAdminClient();
  const [lang, profile, township] = await Promise.all([
    getLang(),
    getSessionProfile(),
    admin.from('townships').select('id, name').eq('active', true).order('name').limit(1).maybeSingle(),
  ]);
  if (township.error) throw new Error(`township lookup failed: ${township.error.message}`);
  if (!township.data) notFound();
  const { data: facilities, error } = await admin
    .from('facilities')
    .select('id, sport, court_label')
    .eq('township_id', township.data.id)
    .order('court_label')
    .overrideTypes<{ id: string; sport: Sport; court_label: string }[], { merge: false }>();
  if (error) throw new Error(`facilities lookup failed: ${error.message}`);
  const supabase = await createClient();
  const card = profile && (await loadMyCard(supabase, profile.id));
  // A demo account is shared by every visitor, so its PIN is shown on the pad, as in Me.
  const demo = card && (await supabase.auth.getClaims()).data?.claims.app_metadata?.demo;

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{t(lang, 'reader.title')}</h1>
        <p className="text-sm text-muted-2">{township.data.name}</p>
      </header>
      <ReaderScreen
        townshipId={township.data.id}
        // The kinds in the booking page's order (courts, hall, gym, BBQ pit, room), by name within each.
        facilities={facilities.toSorted((a, b) => SPORTS.indexOf(a.sport) - SPORTS.indexOf(b.sport))}
        publicKey={publicJwkFromSigningKey(env.cardSigningKey)}
        card={card}
        demoPin={demo ? DEMO_PIN : null}
      />
    </main>
  );
}
