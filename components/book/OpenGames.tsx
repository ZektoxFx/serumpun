import Link from 'next/link';
import { MessageButton } from '@/components/app/MessageButton';
import { JoinGameButton } from '@/components/book/JoinGameButton';
import { buttonClasses } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { SPORT_ICON, slotRange, slotStartUtc, spotsLabel, spotsLeft, type OpenGame } from '@/lib/domain/booking';
import { eventDay } from '@/lib/domain/events';
import { t, type Lang } from '@/lib/i18n';
import type { SessionProfile } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * Open games (spec §8.9, Find players): neighbours' coming games that still need players, soonest first, plus the ones
 * the reader joined, each with Join and a message to its host. Home passes `limit` and shows nothing when there are
 * none; Book a Court shows them all (the `#open-games` that Home's "See all" opens), or how to start one.
 */
export async function OpenGames({ profile, lang, limit }: { profile: SessionProfile; lang: Lang; limit?: number }) {
  const supabase = await createClient();
  const found = await supabase.rpc('open_games');
  if (found.error) throw new Error(`open games lookup failed: ${found.error.message}`);
  const data = (found.data ?? []) as OpenGame[];
  if (limit !== undefined && data.length === 0) return null;
  const games = data.slice(0, limit);
  const canAct = profile.status === 'verified';

  return (
    // scroll-mt clears the sticky header when "See all" scrolls here.
    <section id="open-games" aria-labelledby="open-games-title" className="grid scroll-mt-20 gap-2">
      <h2 id="open-games-title" className="px-1 text-xs font-extrabold uppercase tracking-wide text-muted">
        {t(lang, 'book.games.title')}
      </h2>
      {games.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-3.5 text-sm text-muted-2">{t(lang, 'book.games.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {games.map((game) => (
            <GameCard key={game.booking_id} game={game} lang={lang} canAct={canAct} />
          ))}
        </ul>
      )}
      {games.length < data.length && (
        <Link href="/book#open-games" className={buttonClasses('outline')}>
          {t(lang, 'book.games.seeAll', { n: data.length })}
        </Link>
      )}
    </section>
  );
}

/** The spots left (the pass's tag), the court, when, the host, Join and "Message <host>". */
function GameCard({ game, lang, canAct }: { game: OpenGame; lang: Lang; canAct: boolean }) {
  const left = spotsLeft(game.needed, game.joined);
  const when = `${eventDay(slotStartUtc(game.date, game.start_hour), lang)} · ${slotRange(game.date, game.start_hour, lang)}`;
  return (
    <li className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3.5 shadow-card">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-tint-orange text-2xl">
          {SPORT_ICON[game.sport]}
        </span>
        <p className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <Tag variant={left > 0 ? 'amber' : 'green'}>{spotsLabel(left, lang)}</Tag>
          <span className="break-words font-bold">{game.court_label}</span>
          <span className="text-sm text-muted-2">{when}</span>
          <span className="break-words text-sm text-muted-2">
            {game.host_name} · {game.host_neighbourhood}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <JoinGameButton bookingId={game.booking_id} title={`${game.court_label}, ${when}`} joined={game.i_joined} canAct={canAct} />
        <MessageButton
          contextType="game"
          contextId={game.booking_id}
          label={t(lang, 'messages.messageOwner', { name: game.host_name })}
          canAct={canAct}
        />
      </div>
    </li>
  );
}
