import type { Metadata } from 'next';
import { HelpHeader } from '@/components/help/HelpHeader';
import { HELP } from '@/lib/content/help';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'help.guidelines') };
}

/** How to use each feature, step by step. */
export default async function GuidelinesPage() {
  const lang = await getLang();
  return (
    <>
      <HelpHeader title={t(lang, 'help.guidelines')} />
      <main className="grid gap-3 px-4 py-4">
        {HELP[lang].guidelines.map((section) => (
          <section key={section.title} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <h2 className="text-lg font-extrabold">{section.title}</h2>
            <ol className="mt-2 grid list-decimal gap-1.5 pl-5">
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        ))}
      </main>
    </>
  );
}
