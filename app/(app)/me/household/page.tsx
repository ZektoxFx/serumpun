import type { Metadata } from 'next';
import { AppHeader } from '@/components/app/AppHeader';
import { ApproveMove } from '@/components/card/ApproveMove';
import { CancelInvite } from '@/components/card/CancelInvite';
import { InviteSheet } from '@/components/card/InviteSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tag } from '@/components/ui/Tag';
import { canApproveMove, INVITE_ROLES, isCardFull, isManager, loadHousehold } from '@/lib/card/household';
import { DEMO_PIN } from '@/lib/card/pin';
import { loadMyCard } from '@/lib/card/summary';
import { clockTime } from '@/lib/domain/time';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireMember } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'household.heading') };
}

const box = 'rounded-2xl border border-line bg-surface p-4 shadow-card';
const boxHeading = 'text-xs font-extrabold uppercase tracking-wide text-muted';

/**
 * Who is on the household card and in what role, and the family invited to join it. The Owner, and a Co-owner whose IC the
 * office has checked, can invite; what each may is worked out in lib/card/household.ts, and create_invite decides again.
 * `?invite=co_owner` (from "Add a Co-owner?" on Me) opens the invite sheet on that role. A full card (its phones and open
 * invites reach the limit) says so in place of the button, and `?invite=` opens nothing.
 *
 * A person whose new phone waits for their card shows "New phone waiting". A manager who may (canApproveMove) can approve it
 * for a lost phone, with their own PIN; the old phone, when it is not lost, moves the card itself in Me.
 */
export default async function HouseholdPage({ searchParams }: PageProps<'/me/household'>) {
  const profile = await requireMember();
  const lang = await getLang();
  const supabase = await createClient();
  const now = new Date();
  // Row-level security: the caller's own card, its people and its invites.
  const card = await loadMyCard(supabase, profile.id);
  if (!card) {
    return (
      <>
        <AppHeader title={t(lang, 'household.heading')} back="/me" />
        <main className="px-4 py-4">
          <EmptyState title={t(lang, 'card.error.no_card')} />
        </main>
      </>
    );
  }
  const [{ people, invites, me, choices }, claims, waiting] = await Promise.all([
    loadHousehold(supabase, card.id, profile.id, now),
    supabase.auth.getClaims(),
    // Members can't read each other's keys (row-level security shows a person only their own phone's), so who has a new phone
    // waiting is read with the service role, for this card's phones only. Only the people come back, never a key.
    createAdminClient()
      .from('card_phones')
      .select('user_id, phone_keys!inner(state)')
      .eq('card_id', card.id)
      .eq('phone_keys.state', 'waiting')
      .overrideTypes<{ user_id: string | null }[], { merge: false }>(),
  ]);
  if (waiting.error) throw new Error(`card keys lookup failed: ${waiting.error.message}`);
  const moving = new Set(waiting.data.map((phone) => phone.user_id));
  // A demo account is shared by every visitor, so its PIN is shown on the pad. `app_metadata` is set by the seed only.
  const demo = claims.data?.claims.app_metadata?.demo;
  const asked = (await searchParams).invite;

  return (
    <>
      <AppHeader title={t(lang, 'household.title', { unit: card.unit })} back="/me" />
      <main className="grid gap-3 px-4 py-4">
        <section aria-labelledby="people" className={box}>
          <h2 id="people" className={boxHeading}>
            {t(lang, 'household.people', { n: card.phones, max: card.phoneLimit })}
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {people.map((person) => (
              <li key={person.userId} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid min-w-0">
                    <span className="break-words text-base">
                      <span className="font-bold">{person.name}</span>
                      {person.userId === me.userId && <span className="text-muted-2"> · {t(lang, 'household.you')}</span>}
                    </span>
                    {person.role === 'co_owner' && !person.icChecked && (
                      <span className="text-sm text-muted-2">{t(lang, 'household.icPending')}</span>
                    )}
                    {moving.has(person.userId) && (
                      <span className="text-sm font-bold text-amber-text">{t(lang, 'household.move.waiting')}</span>
                    )}
                  </span>
                  <Tag className="shrink-0 whitespace-nowrap">{t(lang, `household.role.${person.role}`)}</Tag>
                </div>
                {moving.has(person.userId) && canApproveMove(me, person) && (
                  <div className="mt-2">
                    <ApproveMove member={person.userId} name={person.name} cardId={card.id} demoPin={demo ? DEMO_PIN : null} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {isManager(me) && (
            <div className="mt-3">
              <InviteSheet
                cardId={card.id}
                demoPin={demo ? DEMO_PIN : null}
                choices={choices}
                initialRole={INVITE_ROLES.find((role) => role === asked)}
                full={isCardFull(card, invites.length)}
              />
            </div>
          )}
          <p className="mt-3 text-sm text-muted-2">{t(lang, 'household.rules')}</p>
        </section>

        {invites.length > 0 && (
          <section aria-labelledby="invites" className={box}>
            <h2 id="invites" className={boxHeading}>
              {t(lang, 'household.invites')}
            </h2>
            <ul className="mt-2 divide-y divide-line">
              {invites.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 break-words text-base">
                    {t(lang, 'household.invite.until', {
                      name: invite.name,
                      role: t(lang, `household.role.${invite.role}`),
                      time: clockTime(new Date(invite.expiresAt), now, lang),
                    })}
                  </span>
                  {(invite.createdBy === me.userId || isManager(me)) && <CancelInvite invite={invite.id} name={invite.name} />}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
