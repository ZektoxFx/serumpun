'use client';

import { startTransition, useActionState, useState, type ReactNode } from 'react';
import { giveCode, type UnitRecord } from '@/app/dashboard/units/actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { clockTime } from '@/lib/domain/time';
import { useLang, useT } from '@/lib/i18n';

type Answer = Awaited<ReturnType<typeof giveCode>> | null;

/** What the sheet starts from: the home's record as the office has it. The phone is worded the Malaysian way, or empty. */
type GiveCodeRecord = Pick<UnitRecord, 'name' | 'tenure' | 'phone' | 'leaseEnd'>;

function Check({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-red-text">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-red" />
      <span className="min-w-0 text-sm font-bold">{children}</span>
    </label>
  );
}

/**
 * The record, the two checks, and then the code. It mounts only while the sheet is open, so closing the sheet takes the
 * code off the screen: it is shown once, and giving again makes a new one.
 */
function GiveCodeForm({ unit, label, record }: { unit: string; label: string; record: GiveCodeRecord }) {
  const t = useT();
  const lang = useLang();
  const [tenure, setTenure] = useState(record.tenure);
  const [icSeen, setIcSeen] = useState(false);
  const [papersSeen, setPapersSeen] = useState(false);
  const [answer, give, pending] = useActionState(async (_: Answer, next: UnitRecord): Promise<Answer> => {
    try {
      return await giveCode(unit, next);
    } catch {
      return { error: 'common.error' };
    }
  }, null);
  const given = answer && 'code' in answer ? answer : null;
  const works = given && t('units.give.works', { time: clockTime(new Date(given.expiresAt), new Date(), lang) });

  return (
    <div className="grid gap-4 pb-2">
      <form
        // Not `action={give}`: React resets a form after every action, which would wipe the record when giving fails.
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          startTransition(() =>
            give({
              name: String(form.get('name') ?? ''),
              tenure,
              phone: String(form.get('phone') ?? ''),
              leaseEnd: tenure === 'tenant' ? String(form.get('leaseEnd') ?? '') || null : null,
              icSeen,
              papersSeen,
            }),
          );
        }}
        className="grid gap-4"
      >
        <Field label={t('units.give.name')}>
          {(control) => <input {...control} name="name" required maxLength={80} autoComplete="off" defaultValue={record.name} />}
        </Field>
        <div className="grid gap-1.5">
          <p className="text-sm font-bold">{t('units.give.tenure')}</p>
          <Segmented
            value={tenure}
            onChange={setTenure}
            label={t('units.give.tenure')}
            options={[
              { value: 'owner', label: t('units.tenure.owner') },
              { value: 'tenant', label: t('units.tenure.tenant') },
            ]}
          />
        </div>
        <Field label={t('units.give.phone')} hint={t('units.give.phoneHint')}>
          {(control) => <input {...control} name="phone" type="tel" inputMode="tel" required autoComplete="off" defaultValue={record.phone} />}
        </Field>
        {tenure === 'tenant' && (
          <Field label={t('units.give.leaseEnd')}>
            {(control) => <input {...control} name="leaseEnd" type="date" required defaultValue={record.leaseEnd ?? ''} />}
          </Field>
        )}
        <fieldset className="grid min-w-0 gap-2">
          <legend className="mb-2 text-sm font-bold">{t('units.give.checked')}</legend>
          <Check checked={icSeen} onChange={setIcSeen}>
            {t('units.give.icSeen')}
          </Check>
          <Check checked={papersSeen} onChange={setPapersSeen}>
            {t('units.give.papersSeen')}
          </Check>
        </fieldset>
        {answer && 'error' in answer && (
          <p role="alert" className="text-sm font-bold text-red-text">
            {t(answer.error)}
          </p>
        )}
        <Button type="submit" size="lg" disabled={!icSeen || !papersSeen || pending} className="w-full">
          {t('units.give.button')}
        </Button>
      </form>
      <div role="status">
        {given && (
          <div className="grid gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-soft p-4 text-center">
            <p className="font-mono text-3xl font-extrabold tracking-widest">{given.code}</p>
            <p className="text-sm text-muted-2">{works}</p>
            <Button type="button" variant="outline" onClick={() => window.print()}>
              {t('units.give.print')}
            </Button>
          </div>
        )}
      </div>
      {/* The slip: not on the screen, and the only thing a print shows (app/globals.css). Black on white whatever the theme. */}
      {given && (
        <div data-print-slip className="hidden bg-white text-center text-black print:block">
          <p className="text-3xl font-extrabold">Serumpun</p>
          <p className="mt-6 text-xl font-bold">{label}</p>
          <p className="my-8 font-mono text-6xl font-extrabold tracking-widest">{given.code}</p>
          <p className="text-xl">{t('units.give.slip')}</p>
          <p className="mt-3 text-lg">{works}</p>
        </div>
      )}
    </div>
  );
}

/** "Give code" opens a sheet for the home: its record to check, the two checks made at the counter, then the code and its slip. */
export function GiveCode({ unit, label, record }: { unit: string; label: string; record: GiveCodeRecord }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="whitespace-nowrap">
        {t('units.give.button')}
        <span className="sr-only"> {label}</span>
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} side="right" title={t('units.give.title', { unit: label })}>
        <GiveCodeForm unit={unit} label={label} record={record} />
      </Sheet>
    </>
  );
}
