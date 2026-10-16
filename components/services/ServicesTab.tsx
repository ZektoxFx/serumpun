import Link from 'next/link';
import { MessageButton } from '@/components/app/MessageButton';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tag } from '@/components/ui/Tag';
import { PUBLIC_SERVICE_COLUMNS, SERVICE_ICON, type PublicService, type ServiceCategory } from '@/lib/domain/community';
import { eventDay, mytDateTime } from '@/lib/domain/events';
import { t, type Lang } from '@/lib/i18n';
import type { SessionProfile } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

/** The chips under the switch (canvas): every category but "other", which only shows under All. */
const CHIPS: readonly ServiceCategory[] = ['tutoring', 'repairs', 'home_help', 'pet_care'];

/**
 * Community › Services (the approved canvas artboard): what neighbours offer, or ask for (`?view=requested`), by
 * category (`?cat=`), newest first, with Message on an offer and "I can help" on a request. Payment is arranged between
 * neighbours.
 */
export async function ServicesTab({
  profile,
  lang,
  params,
}: {
  profile: SessionProfile;
  lang: Lang;
  params: Record<string, string | string[] | undefined>;
}) {
  const requested = params.view === 'requested';
  const cat = CHIPS.find((c) => c === params.cat) ?? null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_services')
    .select(PUBLIC_SERVICE_COLUMNS)
    .order('created_at', { ascending: false })
    .overrideTypes<PublicService[], { merge: false }>();
  if (error) throw new Error(`services lookup failed: ${error.message}`);
  const offers = data.filter((s) => s.kind === 'offer');
  const requests = data.filter((s) => s.kind === 'request');
  const shown = (requested ? requests : offers).filter((s) => cat === null || s.category === cat);

  const href = (next: { requested?: boolean; cat?: ServiceCategory | null }) => {
    const query = new URLSearchParams({ tab: 'services' });
    if (next.requested) query.set('view', 'requested');
    if (next.cat) query.set('cat', next.cat);
    return `/community?${query}`;
  };
  const segment = (on: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-sm font-extrabold ${on ? 'bg-surface text-text shadow-card' : 'text-muted-2'}`;
  const chip = (on: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-4 text-sm font-bold ${
      on ? 'bg-ink text-on-ink' : 'border border-line bg-surface text-text'
    }`;

  return (
    <main className="grid grid-cols-1 gap-3 px-4 py-4">
      <nav aria-label={t(lang, 'service.views')} className="flex rounded-xl bg-chip p-1">
        <Link href={href({ cat })} aria-current={requested ? undefined : 'page'} className={segment(!requested)}>
          {t(lang, 'service.offered', { n: offers.length })}
        </Link>
        <Link href={href({ requested: true, cat })} aria-current={requested ? 'page' : undefined} className={segment(requested)}>
          {t(lang, 'service.requested', { n: requests.length })}
        </Link>
      </nav>

      <nav aria-label={t(lang, 'service.categories')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Link href={href({ requested })} aria-current={cat === null ? 'page' : undefined} className={chip(cat === null)}>
          {t(lang, 'event.all')}
        </Link>
        {CHIPS.map((c) => (
          <Link key={c} href={href({ requested, cat: c })} aria-current={cat === c ? 'page' : undefined} className={chip(cat === c)}>
            <span aria-hidden="true">{SERVICE_ICON[c]}</span> {t(lang, `service.category.${c}`)}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <EmptyState icon="🤝" title={t(lang, 'service.empty')} description={t(lang, 'service.emptyHint')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((s) => (
            <li key={s.id}>
              <ServiceCard service={s} lang={lang} canAct={profile.status === 'verified'} />
            </li>
          ))}
        </ul>
      )}
      <Link href="/community/services/new" className={`${buttonClasses('outline')} mt-1`}>
        <span aria-hidden="true">＋</span> {t(lang, 'create.service')}
      </Link>
      <p className="text-center text-xs text-muted-2">{t(lang, 'service.payment')}</p>
    </main>
  );
}

/** A card of the canvas: tag, title, who and where, the price (offers) or budget (requests), and the button. */
function ServiceCard({ service: s, lang, canAct }: { service: PublicService; lang: Lang; canAct: boolean }) {
  const offer = s.kind === 'offer';
  const who = [s.provider_name, s.provider_neighbourhood];
  if (!offer && s.conversation_count > 0) who.push(t(lang, 'service.helpers', { n: s.conversation_count }));
  const when = s.availability_text ?? (s.needed_by && t(lang, 'service.neededBy', { date: eventDay(mytDateTime(s.needed_by, '12:00')!, lang) }));
  return (
    <article className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-3.5 shadow-card">
      <Tag variant={offer ? 'info' : 'orange'} className="self-start">
        <span aria-hidden="true">{offer ? SERVICE_ICON[s.category] : '🙋'}</span>{' '}
        {offer ? t(lang, `service.category.${s.category}`) : t(lang, 'service.request')}
      </Tag>
      <h2 className="break-words text-base font-bold leading-snug">{s.title}</h2>
      <p className="break-words text-sm text-muted-2">{who.join(' · ')}</p>
      {when && <p className="break-words text-sm text-muted-2">{when}</p>}
      {s.description && <p className="whitespace-pre-line break-words text-sm">{s.description}</p>}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {offer ? (
          <span className={s.price_text ? 'text-[15px] font-extrabold text-red-text' : 'text-sm text-muted-2'}>
            {s.price_text ?? t(lang, 'service.askPrice')}
          </span>
        ) : (
          <span className="text-sm text-muted-2">{s.budget_text ? t(lang, 'service.budget', { budget: s.budget_text }) : t(lang, 'service.budgetOpen')}</span>
        )}
        {s.is_mine ? (
          <Tag>{t(lang, 'service.yours')}</Tag>
        ) : (
          <MessageButton
            contextType="service"
            contextId={s.id}
            label={t(lang, offer ? 'service.message' : 'service.canHelp')}
            canAct={canAct}
            variant={offer ? 'ink' : 'primary'}
          />
        )}
      </div>
    </article>
  );
}
