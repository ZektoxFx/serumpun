import { PIN_LOCK_MS, PIN_TRIES, afterDemoTry, cardErrorKey, demoLocked, isPinFormat, type DemoLock } from '@/lib/card/pin';
import { t } from '@/lib/i18n';

it('accepts exactly six digits', () => {
  expect(isPinFormat('123456')).toBe(true);
  for (const pin of ['12345', '1234567', '12a456', ' 123456', '']) expect(isPinFormat(pin), pin).toBe(false);
});
it('locks a demo browser for 15 minutes after 5 wrong tries', () => {
  const now = 1_000_000;
  let lock: DemoLock = { fails: 0, until: null };
  for (let i = 0; i < 5; i++) lock = afterDemoTry(lock, false, now);
  expect(lock.until).toBe(now + 900_000);
  expect(demoLocked(lock, now + 899_999)).toBe(true);
  expect(demoLocked(lock, now + 900_000)).toBe(false);
});
it('clears the wrong tries after a right PIN', () => {
  expect(afterDemoTry({ fails: 3, until: null }, true, 0)).toEqual({ fails: 0, until: null });
});
it('names every card error in both languages', () => {
  for (const code of ['no_card', 'card_full', 'bad_key']) {
    expect(cardErrorKey(code), code).not.toBe('common.error');
    expect(t('ms', cardErrorKey(code))).not.toBe(t('en', cardErrorKey(code)));
  }
  expect(cardErrorKey('__proto__')).toBe('common.error');
  expect(cardErrorKey(undefined)).toBe('common.error');
});

// Beyond the brief: the demo lock behaves as the server's lock does for a real account.
it('ignores tries while locked, so neither a right PIN nor a wrong one changes the lock', () => {
  const locked: DemoLock = { fails: 0, until: 2_000 };
  expect(afterDemoTry(locked, true, 1_999)).toEqual(locked);
  expect(afterDemoTry(locked, false, 1_999)).toEqual(locked);
});
it('gives five fresh tries once the lock has run out', () => {
  let lock: DemoLock = { fails: 0, until: null };
  for (let i = 0; i < PIN_TRIES; i++) lock = afterDemoTry(lock, false, 0);
  for (let i = 1; i < PIN_TRIES; i++) lock = afterDemoTry(lock, false, PIN_LOCK_MS);
  expect(demoLocked(lock, PIN_LOCK_MS)).toBe(false);
  expect(demoLocked(afterDemoTry(lock, false, PIN_LOCK_MS), PIN_LOCK_MS)).toBe(true);
});
