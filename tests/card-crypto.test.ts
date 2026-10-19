import {
  generateSigningKey, importSigningKey, publicJwkFromSigningKey, readPresentation, signNote, signPass, verifyPass,
  type PassPayload, type PublicJwk, type TapNote,
} from '@/lib/card/crypto';

async function phone() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { privateKey: pair.privateKey, jwk: { kty, crv, x, y } as PublicJwk };
}
const payload = (key: PublicJwk): PassPayload => ({
  v: 1, card: 'card-18', unit: 'No. 18, Jalan Elmina Valley 3/2', township: 'elmina', phone: 'phone-1', key,
  places: ['facilities', 'gym', 'pool'], suspended: false, leaseEnd: null, iat: 1_792_000_000, exp: 1_792_086_400,
});
const NOTE: TapNote = { place: 'pool', facility: null, at: 1_792_000_100_000, nonce: 'n-1' };

describe('passes', () => {
  it('verify with the township key and give back their payload', async () => {
    const encoded = await generateSigningKey();
    const p = payload((await phone()).jwk);
    const token = await signPass(p, await importSigningKey(encoded));
    expect(await verifyPass(token, publicJwkFromSigningKey(encoded))).toEqual(p);
  });
  it('expose only the public half of the township key', async () => {
    expect(Object.keys(publicJwkFromSigningKey(await generateSigningKey())).sort()).toEqual(['crv', 'kty', 'x', 'y']);
  });
  it('fail when their payload is changed', async () => {
    const encoded = await generateSigningKey();
    const p = payload((await phone()).jwk);
    const [, sig] = (await signPass(p, await importSigningKey(encoded))).split('.');
    const forged = `${Buffer.from(JSON.stringify({ ...p, suspended: true })).toString('base64url')}.${sig}`;
    expect(await verifyPass(forged, publicJwkFromSigningKey(encoded))).toBeNull();
  });
  it('fail against another township key', async () => {
    const token = await signPass(payload((await phone()).jwk), await importSigningKey(await generateSigningKey()));
    expect(await verifyPass(token, publicJwkFromSigningKey(await generateSigningKey()))).toBeNull();
  });
});

describe('tap notes', () => {
  it('verify against the phone key inside the pass', async () => {
    const encoded = await generateSigningKey();
    const device = await phone();
    const p = payload(device.jwk);
    const presentation = await signNote(await signPass(p, await importSigningKey(encoded)), NOTE, device.privateKey);
    expect(await readPresentation(presentation, publicJwkFromSigningKey(encoded))).toEqual({ pass: p, note: NOTE });
  });
  it('fail when another phone signed them', async () => {
    const encoded = await generateSigningKey();
    const pass = await signPass(payload((await phone()).jwk), await importSigningKey(encoded));
    const presentation = await signNote(pass, NOTE, (await phone()).privateKey);
    expect(await readPresentation(presentation, publicJwkFromSigningKey(encoded))).toBeNull();
  });
  it('cannot be moved onto another pass', async () => {
    const encoded = await generateSigningKey();
    const key = await importSigningKey(encoded);
    const device = await phone();
    const passA = await signPass(payload(device.jwk), key);
    const passB = await signPass({ ...payload(device.jwk), card: 'card-7' }, key);
    const [, , noteB64, noteSig] = (await signNote(passA, NOTE, device.privateKey)).split('.');
    expect(await readPresentation(`${passB}.${noteB64}.${noteSig}`, publicJwkFromSigningKey(encoded))).toBeNull();
  });
  it('come back null, never throw, for junk', async () => {
    const pub = publicJwkFromSigningKey(await generateSigningKey());
    for (const junk of ['', 'a.b.c', 'x.y.z.w', '!!!.???.***.###']) expect(await readPresentation(junk, pub)).toBeNull();
  });
  // Beyond the brief: a phone signs whatever it likes, so a correctly signed note that is not shaped like a TapNote must not get through.
  it('refuse a signed note that is not shaped like a note, and drop fields they do not know', async () => {
    const encoded = await generateSigningKey();
    const device = await phone();
    const pass = await signPass(payload(device.jwk), await importSigningKey(encoded));
    const pub = publicJwkFromSigningKey(encoded);
    const read = async (note: unknown) => readPresentation(await signNote(pass, note as TapNote, device.privateKey), pub);
    const bad = [null, 'pool', { place: 'pool' }, { ...NOTE, place: 'sauna' }, { ...NOTE, at: '1' }, { ...NOTE, at: null }, { ...NOTE, nonce: 7 }];
    for (const note of bad) expect(await read(note)).toBeNull();
    expect((await read({ ...NOTE, admin: true }))?.note).toEqual(NOTE);
  });
});
