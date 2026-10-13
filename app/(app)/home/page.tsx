import { signOut } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/Button';
import { greetingKey } from '@/lib/domain/time';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

// Placeholder until Task 4 builds Home: shows who is signed in.
export default async function HomePage() {
  const profile = await requireMember();
  const lang = await getLang();
  return (
    <main className="mx-auto grid max-w-md gap-4 px-6 py-8">
      <h1 className="text-2xl font-extrabold">
        {t(lang, `home.greeting.${greetingKey(new Date())}`, { name: profile.full_name })}
      </h1>
      <p className="text-muted-2">
        {t(lang, `role.${profile.role}`)} · {profile.neighbourhood}
      </p>
      <form action={signOut}>
        <Button variant="outline" className="w-full">
          {t(lang, 'auth.signOut')}
        </Button>
      </form>
    </main>
  );
}
