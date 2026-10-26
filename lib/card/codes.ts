/**
 * The office's codes at the counter and the family's invite codes: 8 characters from 32 that can't be misread (no I, O,
 * 0 or 1), shown as K7Q4-M29X. That is 40 random bits, enough for a fast hash: the database keeps only a code's SHA-256,
 * and finds a code by it. Web Crypto only, so the browser can use this file too.
 */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A fresh code. Each character is one crypto random byte modulo 32: 256 is a multiple of 32, so none is likelier. */
export function newCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => CODE_ALPHABET[byte % 32]).join('');
}

/**
 * A code as typed, in capitals and without spaces or hyphens, or null. A look-alike (O for 0, I for 1) is refused,
 * never changed. It arrives from the browser, so anything that is not text is null too.
 */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const code = input.replace(/[\s-]/g, '');
  // Tested before upper-casing, and without the u flag, so only ASCII letters pass: ß is not read as SS, nor ſ as S.
  return /^[A-HJ-NP-Z2-9]{8}$/i.test(code) ? code.toUpperCase() : null;
}

/** 'K7Q4M29X' as people read it: 'K7Q4-M29X'. */
export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** The SHA-256 of a code, in lower-case hex: what `card_codes.code_hash` keeps. */
export async function hashCode(code: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
