'use client';

import { useId, useState, useTransition } from 'react';
import { checkParkingAction, payParkingAction } from '@/app/(app)/parking/actions';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import type { Mall } from '@/lib/domain/malls';
import { PAY_METHODS, formatRM, normalisePlate, type PayMethod } from '@/lib/domain/parking';
import { clockTime } from '@/lib/domain/time';
import { useLang, useT, type MessageKey } from '@/lib/i18n';
import type { ParkingQuote } from '@/lib/parking';

const METHOD_ICON: Record<PayMethod, string> = { duitnow_qr: '▦', fpx: '🏦', apple_pay: '', google_pay: 'G' };
const METHOD_TINT: Record<PayMethod, string> = {
  duitnow_qr: 'bg-[#ED1C6F] text-white',
  fpx: 'bg-[#1d4ed8] text-white',
  apple_pay: 'bg-black text-white',
  google_pay: 'bg-white text-[#4285F4] ring-1 ring-line',
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type Due = Extract<ParkingQuote, { kind: 'due' }>;
type Receipt = { ref: string; exitBy: string; totalSen: number; method: PayMethod };

/**
 * Pay parking, the flow the user described: the plate → the amount pops up with ways to pay under it → "Thank you! You
 * have 20 minutes to exit the parking lot." A demo: nothing is charged, and every step says so.
 */
export function PayParking({ mall, plates }: { mall: Mall; plates: string[] }) {
  const t = useT();
  const lang = useLang();
  const id = useId();
  const [plate, setPlate] = useState(plates[0] ?? '');
  const [due, setDue] = useState<Due | null>(null);
  const [paidUntil, setPaidUntil] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>('duitnow_qr');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [checking, startChecking] = useTransition();
  const [paying, setPaying] = useState(false);
  const time = (iso: string) => clockTime(new Date(iso), new Date(), lang);

  function check() {
    setError(null);
    setPaidUntil(null);
    startChecking(async () => {
      const done = await checkParkingAction(mall.slug, plate).catch(() => ({ ok: false as const, error: 'common.error' as const }));
      if (!done.ok) return setError(done.error);
      setPlate(done.quote.plate);
      if (done.quote.kind === 'paid') setPaidUntil(done.quote.exitBy);
      else setDue(done.quote);
    });
  }

  async function pay() {
    if (!due || paying) return;
    setPaying(true);
    setError(null);
    // The pretend bank takes a moment, like a real one.
    const [done] = await Promise.all([
      payParkingAction(mall.slug, due.sessionId, method).catch(() => ({ ok: false as const, error: 'common.error' as const })),
      wait(1000),
    ]);
    setPaying(false);
    if (!done.ok) return setError(done.error);
    setDue(null);
    setReceipt({ ref: done.ref, exitBy: done.exitBy, totalSen: done.totalSen, method });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor={id} className="px-1 text-xs font-extrabold uppercase tracking-wide text-muted">
          {t('parking.pay.plate')}
        </label>
        <input
          id={id}
          value={plate}
          onChange={(event) => setPlate(event.target.value.toUpperCase())}
          onBlur={() => setPlate((p) => normalisePlate(p))}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={14}
          placeholder="WXY 1234"
          className="min-h-14 rounded-xl border-2 border-red bg-surface px-4 text-2xl font-extrabold tracking-widest text-text placeholder:text-muted"
        />
        {plates.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-2">{t('parking.pay.saved')}</span>
            {plates.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlate(p)}
                aria-pressed={normalisePlate(plate) === p}
                className="min-h-9 rounded-full border border-line-strong bg-surface px-3 text-sm font-bold aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink"
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && !due && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t(error)}
        </p>
      )}
      {paidUntil && (
        <p role="status" className="rounded-2xl bg-tint-green px-4 py-3 font-bold text-green-text">
          ✓ {t('parking.pay.alreadyPaid', { time: time(paidUntil) })}
        </p>
      )}
      <Button size="lg" onClick={check} disabled={checking || plate.trim() === ''}>
        {t('parking.pay.check')}
      </Button>
      <p className="text-center text-sm text-muted-2">{t('parking.pay.demo')}</p>

      <Sheet open={due !== null} onClose={() => !paying && setDue(null)} title={`🅿️ ${mall.name}`}>
        {due && (
          <div className="grid gap-3 pb-2">
            <p className="text-sm text-muted-2">
              <span className="font-extrabold text-text">{due.plate}</span> ·{' '}
              {t('parking.pay.entered', { time: time(due.enteredAt), h: Math.floor(due.minutes / 60), m: due.minutes % 60 })}
            </p>
            <p className="text-4xl font-extrabold">{formatRM(due.totalSen)}</p>
            {due.taxSen > 0 && <p className="-mt-2 text-sm text-muted-2">{t('parking.pay.tax', { n: Math.round(mall.rate.taxRate * 100) })}</p>}
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted">{t('parking.pay.with')}</legend>
              {PAY_METHODS.map((m) => (
                <label
                  key={m}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 font-bold ${method === m ? 'border-2 border-red bg-tint-red' : 'border-line'}`}
                >
                  <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="size-4 accent-red" />
                  <span aria-hidden="true" className={`grid size-8 place-items-center rounded-lg text-sm font-extrabold ${METHOD_TINT[m]}`}>
                    {METHOD_ICON[m]}
                  </span>
                  {t(`parking.pay.method.${m}`)}
                </label>
              ))}
            </fieldset>
            {error && (
              <p role="alert" className="text-sm font-bold text-red-text">
                {t(error)}
              </p>
            )}
            <Button size="lg" onClick={pay} disabled={paying}>
              {paying ? t('parking.pay.processing') : t('parking.pay.pay', { amount: formatRM(due.totalSen) })}
            </Button>
            <p className="text-center text-sm text-muted-2">{t('parking.pay.demo')}</p>
          </div>
        )}
      </Sheet>

      <Sheet open={receipt !== null} onClose={() => setReceipt(null)} title={t('parking.pay.thanks')}>
        {receipt && (
          <div role="status" className="grid justify-items-center gap-2 pb-2 text-center">
            <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-tint-green text-3xl font-extrabold text-green-text">
              ✓
            </span>
            <p className="text-lg font-extrabold">{t('parking.pay.exitIn', { n: mall.graceMinutes })}</p>
            <p className="text-sm text-muted-2">
              {t('parking.pay.exitBy', { time: time(receipt.exitBy), amount: formatRM(receipt.totalSen), method: t(`parking.pay.method.${receipt.method}`) })}
            </p>
            <p className="text-xs text-muted-2">{t('parking.pay.ref', { ref: receipt.ref })}</p>
            <Button size="lg" className="mt-2 w-full" onClick={() => setReceipt(null)}>
              {t('parking.pay.done')}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
