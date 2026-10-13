import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { getSessionProfile } from '@/lib/supabase/auth';

/** Every resident page: signed-in users only, and a banner while the Management Office has not verified them. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/');
  const lang = await getLang();
  return (
    <>
      {profile.status === 'pending' && (
        <div role="status" className="bg-tint-amber text-amber-text">
          <p className="mx-auto max-w-md px-4 py-3 text-sm font-bold">{t(lang, 'pending.banner')}</p>
        </div>
      )}
      {children}
    </>
  );
}
