'use client';

import type { ReactNode } from 'react';
import { HeroChip } from '@/components/app/HeroChip';
import { Glyph } from '@/components/ui/Glyph';
import type { CardSummary } from '@/lib/card/summary';
import { useT } from '@/lib/i18n';

// Literal navy on purpose, as in HeroChip: the gradient is the same in both themes, while the navy tokens flip in dark mode.
const chip = 'inline-flex max-w-full items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold';

/** The contactless mark. The team drew no icon for it, so it is drawn here: four arcs opening to the right. */
function ContactlessMark() {
  return (
    <svg viewBox="0 0 20 24" className="h-7 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M5.1 9.1a5 5 0 0 1 0 5.8M8.4 6.8a9 9 0 0 1 0 10.4M11.6 4.5a13 13 0 0 1 0 15M14.9 2.2a17 17 0 0 1 0 19.6" />
    </svg>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <span className="grid content-start gap-0.5 rounded-xl bg-white px-3 py-2 text-[#001C3C]">
      <span className="text-xs font-extrabold uppercase tracking-wider opacity-70">{label}</span>
      <span className="text-sm font-extrabold">{value}</span>
    </span>
  );
}

/**
 * The card: the Serumpun gradient, the unit, what the card opens and how many phones it holds. Never a name. Small text
 * cannot sit on the gradient (see HeroChip), so every label is a white chip with navy text and only the unit is written
 * straight on it, large and bold. It is all spans, so the closed card can be one button.
 * `status` is why the card will not open doors ("Suspended · …", "Lease ended"); `note` is a line for the foot.
 */
export function CardFace({
  summary,
  status,
  note,
}: {
  summary: Pick<CardSummary, 'unit' | 'places' | 'phones' | 'phoneLimit'>;
  status: string | null;
  note?: ReactNode;
}) {
  const t = useT();
  const places = summary.places.length ? summary.places.map((place) => t(`reader.place.${place}`)).join(' · ') : t('card.places.none');
  return (
    <span className="grid gap-3 rounded-2xl bg-brand-gradient p-4 text-white shadow-fab ring-1 ring-white/40">
      <span className="flex items-start justify-between gap-3">
        <HeroChip className="uppercase tracking-wider">{t('card.title')}</HeroChip>
        <ContactlessMark />
      </span>
      <span className="text-xl font-extrabold leading-tight">{summary.unit}</span>
      <span className="grid grid-cols-[1fr_auto] gap-2">
        <Field label={t('card.places')} value={places} />
        <Field label={t('card.phones')} value={t('card.phones.count', { n: summary.phones, max: summary.phoneLimit })} />
      </span>
      {(status || note) && (
        <span className="flex flex-wrap gap-2">
          {status && (
            <span className={`${chip} bg-[#001C3C] text-white`}>
              <Glyph emoji="⚠️" /> {status}
            </span>
          )}
          {note && <span className={`${chip} bg-white text-[#001C3C]`}>{note}</span>}
        </span>
      )}
    </span>
  );
}
