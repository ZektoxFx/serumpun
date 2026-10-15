import type { Metadata } from 'next';
import { AppHeader } from '@/components/app/AppHeader';
import { NewReportForm } from '@/components/reports/NewReportForm';
import { parsePrefill } from '@/lib/domain/reports';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireMember } from '@/lib/supabase/auth';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'create.report') };
}

/** A new report. A map alert's "Send to Management Office" arrives with its category, place and id in the query. */
export default async function NewReportPage({ searchParams }: PageProps<'/reports/new'>) {
  const profile = await requireMember();
  const lang = await getLang();
  return (
    <>
      <AppHeader title={t(lang, 'report.new.title')} back="/home" />
      <main className="px-4 py-4">
        <NewReportForm
          centre={{ lat: profile.township.centre_lat, lng: profile.township.centre_lng }}
          canPost={profile.status === 'verified'}
          userId={profile.id}
          prefill={parsePrefill(await searchParams)}
        />
      </main>
    </>
  );
}
