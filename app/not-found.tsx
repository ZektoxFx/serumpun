import Link from 'next/link';
import { buttonClasses } from '@/components/ui/Button';
import { Glyph } from '@/components/ui/Glyph';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

/** Every notFound() and every address that is no page: say so, and a way home ("/" sends each user to theirs). */
export default async function NotFound() {
  const lang = await getLang();
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
      <p aria-hidden="true" className="text-4xl">
        <Glyph emoji="🧭" />
      </p>
      <h1 className="text-lg font-extrabold">{t(lang, 'notFound.title')}</h1>
      <p className="text-sm text-muted-2">{t(lang, 'notFound.body')}</p>
      <Link href="/" className={buttonClasses('primary')}>
        {t(lang, 'error.home')}
      </Link>
    </main>
  );
}
