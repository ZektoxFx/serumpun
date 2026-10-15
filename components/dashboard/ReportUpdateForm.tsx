'use client';

import { startTransition, useActionState, useId, useState } from 'react';
import { updateReport, type DashboardResult } from '@/app/dashboard/actions';
import { PhotoInput, uploadPhoto } from '@/components/app/PhotoInput';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { MANAGEMENT_NEXT, REPORT_TEAMS, type ReportStatus, type ReportTeam } from '@/lib/domain/reports';
import { useT } from '@/lib/i18n';

type Report = { id: string; status: ReportStatus; team: ReportTeam | null; is_private: boolean };

/**
 * "Update this report": the next step (only those MANAGEMENT_NEXT allows, or keep the current one), the team, a message
 * to residents and an after-photo. After each save the fields start again from the report as it now stands.
 */
export function ReportUpdateForm({ report, officeId }: { report: Report; officeId: string }) {
  const t = useT();
  const heading = useId();
  const [round, setRound] = useState(0);
  const [saved, setSaved] = useState(false);
  return (
    <section aria-labelledby={heading} className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <h3 id={heading} className="text-base font-extrabold">
        {t('dashboard.update.title')}
      </h3>
      <UpdateFields
        key={`${report.status}:${report.team}:${round}`}
        report={report}
        officeId={officeId}
        onSaved={() => {
          setSaved(true);
          setRound((n) => n + 1);
        }}
        onEdit={() => setSaved(false)}
      />
      <div role="status">{saved && <p className="text-sm font-bold text-green-text">{t('dashboard.update.saved')}</p>}</div>
    </section>
  );
}

function UpdateFields({
  report,
  officeId,
  onSaved,
  onEdit,
}: {
  report: Report;
  officeId: string;
  onSaved: () => void;
  onEdit: () => void;
}) {
  const t = useT();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [result, save, pending] = useActionState(async (_: DashboardResult, formData: FormData): Promise<DashboardResult> => {
    try {
      // A private report's after-photo goes in this office user's own private folder (update_report_status checks it).
      if (photo) formData.set('photo', await uploadPhoto(photo, report.is_private ? officeId : undefined));
    } catch {
      return { ok: false, error: 'photo.error.upload' };
    }
    try {
      const done = await updateReport(formData);
      if (done?.ok) onSaved();
      return done;
    } catch {
      return { ok: false, error: 'common.error' };
    }
  }, null);

  return (
    <form
      // Not `action={save}`: React resets a form after every action, which would wipe the message when a save fails.
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => save(new FormData(event.currentTarget)));
      }}
      onChange={onEdit}
      className="grid gap-3"
    >
      <input type="hidden" name="id" value={report.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('dashboard.update.status')}>
          {(control) => (
            <select {...control} name="status" defaultValue={report.status}>
              <option value={report.status}>{t('dashboard.update.keep', { status: t(`report.status.${report.status}`) })}</option>
              {MANAGEMENT_NEXT[report.status].map((next) => (
                <option key={next} value={next}>
                  {t(`report.step.${next}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('dashboard.update.team')}>
          {(control) => (
            <select {...control} name="team" defaultValue={report.team ?? ''}>
              {!report.team && <option value="">{t('dashboard.update.noTeam')}</option>}
              {REPORT_TEAMS.map((team) => (
                <option key={team} value={team}>
                  {t(`report.team.${team}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label={t('dashboard.update.message')} hint={t('dashboard.update.messageHint')}>
        {(control) => <textarea {...control} name="message" rows={3} maxLength={500} />}
      </Field>
      <PhotoInput onChange={setPhoto} />
      {result && !result.ok && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(result.error)}
        </p>
      )}
      <Button type="submit" variant="ink" disabled={pending} className="justify-self-start">
        {t('dashboard.update.save')}
      </Button>
    </form>
  );
}
