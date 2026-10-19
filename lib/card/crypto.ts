/**
 * Passes and tap notes for the household access card. WebCrypto only, so the township server, the reader and the
 * resident's phone all run this one file. Nothing here reads the clock: whoever checks a pass judges its `exp`.
 *
 * Wire format. Every part is base64url without padding; ECDSA P-256 with SHA-256; a signature is WebCrypto's raw r||s.
 *   pass         = <payload json>.<township signature over the ASCII of the payload part>
 *   presentation = <pass>.<note json>.<phone signature over the ASCII of "<pass>.<note json>">
 * The note signature covers the pass text, so a note cannot be moved onto another pass.
 */

export const PLACES = ['facilities', 'gym', 'pool'] as const;
export type Place = (typeof PLACES)[number];
export type PublicJwk = { kty: 'EC'; crv: 'P-256'; x: string; y: string };
export type PassPayload = {
  v: 1; card: string; unit: string; township: string; phone: string; key: PublicJwk;
  places: Place[]; suspended: boolean; leaseEnd: string | null; iat: number; exp: number; // iat, exp: seconds
};
export type TapNote = { place: Place | null; facility: string | null; at: number; nonce: string }; // at: ms; place null = the QR
export const PASS_TTL_SECONDS = 86_400;

const CURVE = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGNATURE = { name: 'ECDSA', hash: 'SHA-256' };
const utf8 = new TextEncoder();

function toB64u(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Throws on anything outside the base64url alphabet, so padding, `+`, `/` and whitespace are all refused. */
function fromB64u(text: string) {
  if (!/^[\w-]*$/.test(text)) throw new Error('not base64url');
  return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
}

const encodeJson = (value: unknown) => toB64u(utf8.encode(JSON.stringify(value)));
const decodeJson = (text: string): unknown => JSON.parse(new TextDecoder().decode(fromB64u(text)));

async function sign(key: CryptoKey, signed: string): Promise<string> {
  return toB64u(new Uint8Array(await crypto.subtle.sign(SIGNATURE, key, utf8.encode(signed))));
}

/** Whether `signature` is `jwk`'s signature over `signed`. Throws on a malformed key or signature; the readers below turn that into null. */
async function verifies(jwk: PublicJwk, signature: string, signed: string): Promise<boolean> {
  const { kty, crv, x, y } = jwk;
  const key = await crypto.subtle.importKey('jwk', { kty, crv, x, y }, CURVE, false, ['verify']);
  return crypto.subtle.verify(SIGNATURE, key, fromB64u(signature), utf8.encode(signed));
}

/** A phone signs whatever it likes, so a note is rebuilt field by field instead of trusted as parsed. */
function parseNote(value: unknown): TapNote | null {
  if (typeof value !== 'object' || value === null) return null;
  const { place, facility, at, nonce } = value as { [K in keyof TapNote]?: unknown };
  const valid =
    (place === null || PLACES.includes(place as Place)) &&
    (facility === null || typeof facility === 'string') &&
    Number.isFinite(at) &&
    typeof nonce === 'string';
  return valid ? ({ place, facility, at, nonce } as TapNote) : null;
}

/** The township's private key as base64url of its JWK's JSON: the one value kept in CARD_SIGNING_KEY. */
export async function generateSigningKey(): Promise<string> {
  const { privateKey } = await crypto.subtle.generateKey(CURVE, true, ['sign', 'verify']);
  return encodeJson(await crypto.subtle.exportKey('jwk', privateKey));
}

export async function importSigningKey(encoded: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', decodeJson(encoded) as JsonWebKey, CURVE, false, ['sign']);
}

/** The public half only: `d` and the rest of the private JWK never leave this function. */
export function publicJwkFromSigningKey(encoded: string): PublicJwk {
  const { kty, crv, x, y } = decodeJson(encoded) as PublicJwk;
  return { kty, crv, x, y };
}

export async function signPass(payload: PassPayload, key: CryptoKey): Promise<string> {
  const body = encodeJson(payload);
  return `${body}.${await sign(key, body)}`;
}

export async function verifyPass(token: string, publicKey: PublicJwk): Promise<PassPayload | null> {
  try {
    const [body, signature, ...extra] = token.split('.');
    if (signature === undefined || extra.length || !(await verifies(publicKey, signature, body))) return null;
    return decodeJson(body) as PassPayload;
  } catch {
    return null;
  }
}

export async function signNote(pass: string, note: TapNote, phoneKey: CryptoKey): Promise<string> {
  const signed = `${pass}.${encodeJson(note)}`;
  return `${signed}.${await sign(phoneKey, signed)}`;
}

/** The pass must carry the township's signature, and the note the signature of the phone key written inside that pass. */
export async function readPresentation(
  presentation: string,
  publicKey: PublicJwk,
): Promise<{ pass: PassPayload; note: TapNote } | null> {
  try {
    const parts = presentation.split('.');
    if (parts.length !== 4) return null;
    const [body, passSignature, noteBody, noteSignature] = parts;
    const token = `${body}.${passSignature}`;
    const pass = await verifyPass(token, publicKey);
    if (!pass || !(await verifies(pass.key, noteSignature, `${token}.${noteBody}`))) return null;
    const note = parseNote(decodeJson(noteBody));
    return note ? { pass, note } : null;
  } catch {
    return null;
  }
}
