import { formatPhone, normalizePhone } from '@/lib/domain/phone';

it('reads a Malaysian mobile number typed the usual ways', () => {
  for (const typed of ['012-345 6789', '0123456789', '+60 12-345 6789', '60123456789', ' +6012 345 6789 ']) expect(normalizePhone(typed), typed).toBe('+60123456789');
  expect(normalizePhone('011-2345 6789')).toBe('+601123456789');
});
it('refuses a landline, a short number, a foreign number, or anything that is not text', () => {
  for (const bad of ['03-1234 5678', '012-345 678', '+65 9123 4567', '', null, 60123456789]) expect(normalizePhone(bad), String(bad)).toBeNull();
});
it('shows a number the Malaysian way', () => {
  expect([formatPhone('+60123456789'), formatPhone('+601123456789')]).toEqual(['+60 12-345 6789', '+60 11-2345 6789']);
});
