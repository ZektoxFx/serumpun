import type { Metadata } from 'next';
import { HelpHeader } from '@/components/help/HelpHeader';
import { HELP } from '@/lib/content/help';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'help.terms') };
}

/** The terms of use: a draft for the prototype, said plainly at the top. */
export default async function TermsPage() {
  const lang = await getLang();
  const { terms } = HELP[lang];
  return (
    <>
      <HelpHeader title={t(lang, 'help.terms')} />
      <main className="grid gap-4 px-4 py-4">
        <p className="rounded-2xl bg-tint-amber px-4 py-3 text-sm font-bold text-amber-text">{terms.draftNote}</p>
        <p className="text-sm text-muted-2">{t(lang, 'help.terms.updated', { date: terms.updated })}</p>
        {terms.sections.map((section, i) => (
          <section key={section.title} className="grid gap-1.5">
            <h2 className="text-lg font-extrabold">
              {i + 1}. {section.title}
            </h2>
            {section.steps.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
