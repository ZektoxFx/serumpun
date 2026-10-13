import { signOut } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/Button';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/supabase/auth';

// Placeholder until Task 9 builds the dashboard. requireManagement sends everyone else away.
export default async function DashboardPage() {
  const profile = await requireManagement();
  const lang = await getLang();
  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-8 py-10">
      <h1 className="text-3xl font-extrabold">{t(lang, 'role.management')}</h1>
      <p className="text-muted-2">{profile.full_name}</p>
      <form action={signOut}>
        <Button variant="outline">{t(lang, 'auth.signOut')}</Button>
      </form>
    </main>
  );
}
