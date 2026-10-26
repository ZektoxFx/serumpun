/**
 * A Malaysian mobile number as the database keeps it (+601…), or null for anything else: a landline, a foreign number,
 * or one too short or too long. People type it as 012-345 6789, +60 12-345 6789 or 60123456789, so only the digits and
 * a leading + count. It arrives from the browser, so anything that is not text is null too.
 */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const typed = input.trim();
  const digits = typed.replace(/\D/g, '');
  // A local number (012…) trades its leading 0 for the country code; one typed with + or 60 has the code already.
  const e164 = !typed.startsWith('+') && digits.startsWith('0') ? `+60${digits.slice(1)}` : `+${digits}`;
  return /^\+601[0-9]{8,9}$/.test(e164) ? e164 : null;
}

/** A number from `normalizePhone` the Malaysian way: +60 12-345 6789, or +60 11-2345 6789 for the longer 011 numbers. */
export function formatPhone(e164: string): string {
  const rest = e164.slice(3); // after +60
  return `+60 ${rest.slice(0, 2)}-${rest.slice(2, -4)} ${rest.slice(-4)}`;
}
