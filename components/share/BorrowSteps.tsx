import { BORROW_STEPS, type BorrowStatus } from '@/lib/domain/community';
import { t, type Lang } from '@/lib/i18n';

/**
 * The four steps of borrowing (brainstorm "Share & Lend"): the steps reached carry a tick, the next one is coloured. A
 * declined or cancelled request shows no steps, only its status.
 */
export function BorrowSteps({ status, lang }: { status: BorrowStatus; lang: Lang }) {
  const reached = BORROW_STEPS.indexOf(status as (typeof BORROW_STEPS)[number]);
  if (reached < 0) return null;
  return (
    <ol aria-label={t(lang, 'share.steps')} className="grid grid-cols-4 gap-1">
      {BORROW_STEPS.map((step, i) => {
        const done = i <= reached;
        const next = i === reached + 1;
        return (
          <li key={step} className="flex flex-col items-center gap-1 text-center">
            <span
              aria-hidden="true"
              className={`grid size-8 place-items-center rounded-full text-sm font-extrabold ${
                done ? 'bg-tint-green text-green-text' : next ? 'bg-red text-white' : 'bg-chip text-muted-2'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
            <span className={`text-xs leading-tight ${next ? 'font-extrabold text-text' : 'text-muted-2'}`}>
              {t(lang, `share.step.${step}`)}
              {(done || next) && <span className="sr-only">, {t(lang, done ? 'share.step.done' : 'share.step.now')}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
