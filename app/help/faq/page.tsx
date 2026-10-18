import type { Metadata } from 'next';
import { FaqList } from '@/components/help/FaqList';
import { HelpHeader } from '@/components/help/HelpHeader';
import { HELP } from '@/lib/content/help';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'help.faq') };
}

/** Quick answers, with a search. */
export default async function FaqPage() {
  const lang = await getLang();
  return (
    <>
      <HelpHeader title={t(lang, 'help.faq')} />
      <main className="px-4 py-4">
        <FaqList items={HELP[lang].faq} />
      </main>
    </>
  );
}
