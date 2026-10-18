import type { Metadata } from 'next';
import { NewTopicForm, TopicManager } from '@/components/dashboard/TopicManager';
import type { PublicTopic } from '@/lib/domain/topics';
import { t } from '@/lib/i18n';
import { getLang } from '@/lib/i18n/server';
import { requireManagement } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await getLang(), 'general.title') };
}

/** Dashboard › General chat: add a topic, rename one or make it office-only, open it to answer, or remove it. */
export default async function GeneralChatDashboardPage() {
  await requireManagement();
  const lang = await getLang();
  const supabase = await createClient();
  const { data: topics, error } = await supabase
    .from('public_topics')
    .select('id, emoji, title, office_only, system_key')
    .order('sort_order')
    .order('title')
    .overrideTypes<Pick<PublicTopic, 'id' | 'emoji' | 'title' | 'office_only' | 'system_key'>[], { merge: false }>();
  if (error) throw new Error(`topics lookup failed: ${error.message}`);

  return (
    <main className="grid gap-6 p-4 sm:p-6 xl:grid-cols-2 xl:items-start">
      <div className="grid gap-1 xl:col-span-2">
        <h1 className="text-2xl font-extrabold">{t(lang, 'general.title')}</h1>
        <p className="text-sm text-muted-2">{t(lang, 'dashboard.general.intro')}</p>
      </div>
      <section aria-labelledby="new-topic" className="grid min-w-0 gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <h2 id="new-topic" className="text-base font-extrabold">
          {t(lang, 'dashboard.general.new')}
        </h2>
        <NewTopicForm />
      </section>
      <section aria-labelledby="topic-list" className="grid min-w-0 gap-3">
        <h2 id="topic-list" className="text-base font-extrabold">
          {t(lang, 'dashboard.general.topics')}
        </h2>
        <TopicManager topics={topics} />
      </section>
    </main>
  );
}
