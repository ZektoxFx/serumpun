import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';

// Placeholder until the landing page arrives in Task 3.
export default async function Home() {
  const lang = await getLang();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="bg-brand-gradient px-6 pb-10 pt-16 text-white">
        <h1 className="text-4xl font-extrabold tracking-tight">Serumpun</h1>
        <p className="mt-2 text-lg font-semibold">{t(lang, 'landing.tagline')}</p>
      </header>
    </main>
  );
}
