import { Glyph } from '@/components/ui/Glyph';
import type { TimelineStep } from '@/lib/domain/reports';
import { clockTime } from '@/lib/domain/time';
import { t, type Lang } from '@/lib/i18n';

const DOT: Record<TimelineStep['state'], string> = {
  done: 'bg-green-text',
  current: 'bg-orange ring-4 ring-orange/25',
  next: 'bg-line-strong',
};

/**
 * A report's progress (buildTimeline): each step with its time, the Management Office's messages and after-photos under
 * it, and the steps still to come. No hooks, so the resident's report page and the dashboard's panel both render it on
 * the server. `urls` maps photo paths to links (photoUrls).
 */
export function ReportTimeline({
  steps,
  lang,
  now,
  urls,
  headingId,
}: {
  steps: TimelineStep[];
  lang: Lang;
  now: Date;
  urls: Map<string, string | null>;
  headingId: string;
}) {
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted">
        {t(lang, 'report.progress')}
      </h3>
      <ol className="ml-2 border-l-2 border-line pl-5">
        {steps.map((step, i) => (
          <li key={i} aria-current={step.state === 'current' ? 'step' : undefined} className="relative pb-4 last:pb-0">
            <span aria-hidden="true" className={`absolute -left-[28px] top-1 size-3.5 rounded-full border-2 border-surface ${DOT[step.state]}`} />
            <p className={`text-sm font-extrabold ${step.state === 'next' ? 'text-muted' : ''}`}>{t(lang, `report.step.${step.status}`)}</p>
            <p className="text-xs text-muted-2">
              {step.at
                ? clockTime(new Date(step.at), now, lang)
                : t(lang, step.status === 'confirmed' ? 'report.step.answers' : 'report.step.waiting')}
            </p>
            {step.notes.map((note, j) => {
              const photo = note.photo_path && urls.get(note.photo_path);
              return (
                <div key={j} className="mt-1.5 grid gap-2 rounded-xl bg-soft px-3 py-2 text-sm">
                  {note.message && (
                    <p className="break-words">
                      <Glyph emoji="📢" /> “{note.message}”
                      {note.by_management && <span className="text-muted-2"> — {t(lang, 'role.management')}</span>}
                    </p>
                  )}
                  {photo && (
                    // eslint-disable-next-line @next/next/no-img-element -- already shrunk to 1280 px before upload; private links are signed per view
                    <img src={photo} alt={t(lang, 'report.updatePhotoAlt')} className="max-h-48 w-full rounded-lg object-cover" />
                  )}
                  {note.at !== step.at && <p className="text-xs text-muted-2">{clockTime(new Date(note.at), now, lang)}</p>}
                </div>
              );
            })}
          </li>
        ))}
      </ol>
    </section>
  );
}
