import type { Metadata } from 'next';
import { HelpHeader } from '@/components/help/HelpHeader';
import { HELP } from '@/lib/content/help';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'help.rules') };
}

/** The community rules, numbered, and what happens when one is broken. */
export default async function RulesPage() {
  const lang = await getLang();
  const { rules, rulesAfter } = HELP[lang];
  return (
    <>
      <HelpHeader title={t(lang, 'help.rules')} />
      <main className="grid gap-3 px-4 py-4">
        <p className="text-muted-2">{t(lang, 'help.rules.intro')}</p>
        <ol className="grid gap-2">
          {rules.map((rule, i) => (
            <li key={rule.title} className="flex gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
              <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-sm font-extrabold text-on-ink">
                {i + 1}
              </span>
              <span className="grid gap-0.5">
                <span className="font-extrabold">{rule.title}</span>
                <span className="text-muted-2">{rule.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="rounded-2xl bg-tint-blue px-4 py-3 text-sm">{rulesAfter}</p>
      </main>
    </>
  );
}
