'use client';

import { useId, useState } from 'react';
import { faqMatches, type FaqItem } from '@/lib/content/help';
import { useT } from '@/lib/i18n';

/** The FAQ: a search field over questions that open in place (native disclosure, so keyboards and readers just work). */
export function FaqList({ items }: { items: FaqItem[] }) {
  const t = useT();
  const id = useId();
  const [query, setQuery] = useState('');
  const shown = items.filter((item) => faqMatches(item, query));

  return (
    <div className="grid gap-3">
      <label htmlFor={id} className="sr-only">
        {t('help.faq.search')}
      </label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`🔎 ${t('help.faq.search')}`}
        className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-base text-text placeholder:text-muted"
      />
      {shown.length === 0 ? (
        <p role="status" className="py-6 text-center text-muted-2">
          {t('help.faq.empty')}
        </p>
      ) : (
        <ul className="grid gap-2">
          {shown.map((item) => (
            <li key={item.q}>
              <details className="group rounded-2xl border border-line bg-surface shadow-card open:border-line-strong">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 font-bold focus-visible:outline-offset-[-2px] [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-90 motion-reduce:transition-none">
                    ›
                  </span>
                </summary>
                <p className="px-4 pb-4 text-muted-2">{item.a}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
