import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/app/AppHeader';
import { Tile } from '@/components/app/Tile';
import { NEW_SERVICES, SERVICE_GROUPS, SERVICES } from '@/lib/domain/nav';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'more.title') };
}

/** Home › More: every service, in its group (Township, Community, Mall & parking), and the way to Edit favourites. */
export default async function MorePage() {
  await requireMember();
  const lang = await getLang();
  return (
    <>
      <AppHeader title={t(lang, 'more.title')} back="/home" />
      <main className="grid gap-5 px-4 py-4">
        <Link href="/more/edit" className="justify-self-end px-1 text-sm font-bold text-red-text">
          {t(lang, 'more.edit.title')} ›
        </Link>
        {SERVICE_GROUPS.map((group) => (
          <section key={group} aria-labelledby={`group-${group}`} className="grid gap-2">
            <h2 id={`group-${group}`} className="px-1 text-xs font-extrabold uppercase tracking-wide text-muted">
              {t(lang, `more.group.${group}`)}
            </h2>
            <ul className="grid grid-cols-4 gap-2">
              {SERVICES.filter((s) => s.group === group).map((service) => (
                <li key={service.key} className="flex">
                  <Tile
                    href={service.href}
                    icon={service.icon}
                    label={t(lang, service.label)}
                    badge={NEW_SERVICES.includes(service.key) ? t(lang, 'service.new') : undefined}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
