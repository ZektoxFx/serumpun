import type { ReactNode } from 'react';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

/**
 * Every resident page, with a banner while the Management Office has not verified the user. Each page still calls
 * requireMember itself: a layout does not stop its page from rendering, and rejected applicants must not get one.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await requireMember();
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
