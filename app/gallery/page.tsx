// TEMPORARY verification page for Task 1. Deleted before the final commit.
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { QR } from '@/components/ui/QR';
import { GalleryClient } from './Client';

export default async function Gallery() {
  const lang = await getLang();
  return (
    <main className="mx-auto max-w-md">
      <header className="bg-brand-gradient px-4 pb-6 pt-10 text-white">
        <h1 id="server-i18n" className="text-2xl font-extrabold">{t(lang, 'home.greeting.morning', { name: 'Aisyah' })}</h1>
        <p className="text-sm opacity-90">lang={lang} · {t(lang, 'landing.tagline')}</p>
      </header>
      <div className="flex justify-center p-4">
        <QR value="https://serumpun.example/checkin/demo?c=abc123" label="Check-in QR code" />
      </div>
      <GalleryClient />
    </main>
  );
}
