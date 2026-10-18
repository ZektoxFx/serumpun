import { AppHeader } from '@/components/app/AppHeader';
import { getSessionProfile } from '@/lib/supabase/auth';

/** A help page's header: back to Me when signed in, else to the sign-up form, whose Terms link opens these pages. */
export async function HelpHeader({ title }: { title: string }) {
  const profile = await getSessionProfile();
  return <AppHeader title={title} back={profile ? '/me' : '/signup'} />;
}
