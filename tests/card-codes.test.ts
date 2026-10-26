import { createHash } from 'node:crypto';
import { CODE_ALPHABET, formatCode, hashCode, newCode, normalizeCode } from '@/lib/card/codes';

afterEach(() => vi.restoreAllMocks());

it('makes 8-character codes from 32 characters with no I, O, 0 or 1', () => {
  expect(CODE_ALPHABET).toHaveLength(32);
  expect(CODE_ALPHABET).not.toMatch(/[IO01]/);
  const codes = Array.from({ length: 200 }, newCode);
  for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  expect(new Set(codes).size).toBe(200);
});
it('reads a code typed in lower case, with spaces, or without the hyphen', () => {
  for (const typed of ['K7Q4-M29X', 'k7q4m29x', ' k7q4 - m29x ']) expect(normalizeCode(typed), typed).toBe('K7Q4M29X');
});
it('refuses a wrong length, a look-alike character, or anything that is not text', () => {
  for (const bad of ['K7Q4-M29', 'K7Q4-M29XY', 'K7Q4-M2OX', 'K7Q4-M21X', '', 12345678, null]) expect(normalizeCode(bad), String(bad)).toBeNull();
});
it('shows and hashes a code as the database keeps it', async () => {
  expect(formatCode('K7Q4M29X')).toBe('K7Q4-M29X');
  expect(await hashCode('K7Q4M29X')).toBe(createHash('sha256').update('K7Q4M29X').digest('hex')); // node:crypto
});

// Beyond the brief: where the randomness comes from, and letters that are not code letters until upper-cased or folded.
it('picks each character from a crypto random byte, modulo 32', () => {
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((bytes) => {
    (bytes as Uint8Array).set([0, 31, 32, 63, 64, 224, 255, 8]);
    return bytes;
  });
  expect(newCode()).toBe('A9A9AA9J');
});
it('refuses a letter that only becomes a code letter once upper-cased or folded', () => {
  for (const bad of ['K7Q4-M2ß', 'K7Q4-M2ſX', 'K7Q4-M2KX']) expect(normalizeCode(bad), bad).toBeNull(); // ß is SS, ſ is S, the Kelvin sign is K
});
