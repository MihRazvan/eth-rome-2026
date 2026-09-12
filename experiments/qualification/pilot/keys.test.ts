import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  loadOrCreateDeviceKey, getDevicePublicKey, encryptForRecipients, decryptForRecipient,
  rotateDeviceKey, listDeviceKeys, loadDeviceKey, MAX_DOCUMENT_BYTES, MAX_DEVICE_KEYS,
  type DeviceKey, type DocumentContext, type RecipientBinding, type RecipientEnvelope, type Hex,
} from './keys.js';

const ownerA: Hex = `0x${'11'.repeat(20)}`;
const ownerB: Hex = `0x${'22'.repeat(20)}`;
const outsider: Hex = `0x${'33'.repeat(20)}`;
const ctx: DocumentContext = { chainId: 43113, escrow: `0x${'ab'.repeat(20)}`, jobId: '7', purpose: 'review-result', version: 1 };
const now = 1000;
const plaintext = new TextEncoder().encode('Confidential assessment: accept with corrections.');
const bind = async (device: DeviceKey, owner = ownerA, version = '1'): Promise<RecipientBinding> =>
  ({ owner, publicKey: await getDevicePublicKey(device), version, expiresAt: now + 100 });
const flip = (value: Hex): Hex => `${value.slice(0, -2)}${value.endsWith('00') ? '01' : '00'}` as Hex;
const copy = <T>(value: T): T => structuredClone(value);
beforeEach(() => { globalThis.indexedDB = new IDBFactory(); });

async function fixture() {
  const a = await loadOrCreateDeviceKey('recipient-a');
  const b = await loadOrCreateDeviceKey('recipient-b');
  const bindings = [await bind(a), await bind(b, ownerB)];
  const envelope = await encryptForRecipients(plaintext, ctx, bindings, { now });
  return { a, b, bindings, envelope };
}

test('IndexedDB reload preserves a nonextractable key and concurrent first loads converge', async () => {
  const keys = await Promise.all(Array.from({ length: 5 }, () => loadOrCreateDeviceKey('same-profile')));
  assert.equal(new Set(keys.map(k => k.keyId)).size, 1);
  const reloaded = await loadOrCreateDeviceKey('same-profile');
  assert.notEqual(reloaded.privateKey, keys[0].privateKey); // Actual structured clone, no memory cache.
  assert.equal(reloaded.keyId, keys[0].keyId);
  assert.equal(reloaded.privateKey.extractable, false);
  await assert.rejects(crypto.subtle.exportKey('pkcs8', reloaded.privateKey));
  assert.equal((await getDevicePublicKey(reloaded)).length, 132);
  assert.equal((await listDeviceKeys('same-profile')).length, 1);
  globalThis.indexedDB = new IDBFactory();
  assert.notEqual((await loadOrCreateDeviceKey('same-profile')).keyId, reloaded.keyId);
});

test('both intended recipients decrypt a JSON roundtrip; outsider and wrong device fail', async () => {
  const { a, b, envelope } = await fixture();
  const transmitted = JSON.parse(JSON.stringify(envelope));
  assert.deepEqual(await decryptForRecipient(transmitted, ctx, ownerA, a), plaintext);
  assert.deepEqual(await decryptForRecipient(transmitted, ctx, ownerB, b), plaintext);
  await assert.rejects(decryptForRecipient(transmitted, ctx, outsider, b), /No envelope/);
  await assert.rejects(decryptForRecipient(transmitted, ctx, ownerA, b), /does not match/);
  assert.equal(JSON.stringify(envelope).includes('privateKey'), false);
  assert.equal(JSON.stringify(envelope).includes(new TextDecoder().decode(plaintext)), false);
  const second = await encryptForRecipients(plaintext, ctx, [await bind(a)], { now });
  assert.notEqual(second.ciphertext, envelope.ciphertext);
});

test('context and every recipient header bind the entire document', async () => {
  const { a, envelope } = await fixture();
  for (const changed of [{ ...ctx, chainId: 1 }, { ...ctx, jobId: '8' }, { ...ctx, escrow: outsider }]) {
    await assert.rejects(decryptForRecipient(envelope, changed, ownerA, a), /context mismatch/);
    const forged = copy(envelope); forged.context = changed;
    await assert.rejects(decryptForRecipient(forged, changed, ownerA, a), /authentication failed/);
  }
  const mutations: Array<(e: RecipientEnvelope) => void> = [
    e => { e.ciphertext = flip(e.ciphertext); }, e => { e.iv = flip(e.iv); },
    e => { e.recipients[0].wrappedKey = flip(e.recipients[0].wrappedKey); },
    e => { e.recipients[0].encapsulatedKey = flip(e.recipients[0].encapsulatedKey); },
    e => { e.recipients[0].version = '2'; }, e => { e.recipients[0].expiresAt++; },
    e => { e.recipients[1].version = '2'; }, e => { e.recipients[1].owner = outsider; },
    e => { e.recipients.pop(); },
  ];
  for (const mutate of mutations) {
    const forged = copy(envelope); mutate(forged);
    await assert.rejects(decryptForRecipient(forged, ctx, ownerA, a), /authentication failed/);
  }
  const reordered = copy(envelope); reordered.recipients.reverse();
  await assert.rejects(decryptForRecipient(reordered, ctx, ownerA, a), /unordered/);
  assert.deepEqual(await decryptForRecipient(envelope, { ...ctx, escrow: `0x${'AB'.repeat(20)}` }, ownerA, a), plaintext);
});

test('rotation preserves historical decryption, and registry version gaps are valid', async () => {
  const { a, envelope } = await fixture();
  const next = await rotateDeviceKey(a.namespace);
  assert.notEqual(a.keyId, next.keyId);
  assert.equal((await loadOrCreateDeviceKey(a.namespace)).keyId, next.keyId);
  await assert.rejects(decryptForRecipient(envelope, ctx, ownerA, next), /historical recipient key/);
  const previous = await loadDeviceKey(a.namespace, a.keyId);
  // Stored binding expired in 1970: history must remain decryptable today.
  assert.deepEqual(await decryptForRecipient(envelope, ctx, ownerA, previous), plaintext);
  const latest = await encryptForRecipients(plaintext, ctx, [await bind(next, ownerA, '3')], { now });
  assert.deepEqual(await decryptForRecipient(latest, ctx, ownerA, next), plaintext);
  await assert.rejects(decryptForRecipient(latest, ctx, ownerA, previous), /does not match/);
  const history = await listDeviceKeys(a.namespace);
  assert.deepEqual(history.map(k => k.current), [false, true]);
  await assert.rejects(loadDeviceKey(a.namespace, `0x${'00'.repeat(32)}`), /not found/);
});

test('encryption rejects expiry, invalid curve points, duplicate owners and invalid integer encodings', async () => {
  const a = await loadOrCreateDeviceKey('validation'); const good = await bind(a);
  const cases: RecipientBinding[][] = [[], Array.from({ length: 9 }, () => good), [good, { ...good }],
    [{ ...good, expiresAt: now }], [{ ...good, expiresAt: -1 }], [{ ...good, expiresAt: 1.5 }],
    [{ ...good, version: '0' }], [{ ...good, version: '01' }], [{ ...good, version: (1n << 64n).toString() }],
    [{ ...good, publicKey: `0x04${'00'.repeat(64)}` }], [{ ...good, publicKey: `0x02${'00'.repeat(64)}` }],
    [{ ...good, owner: `0x${'00'.repeat(20)}` }],
  ];
  for (const bindings of cases) await assert.rejects(encryptForRecipients(plaintext, ctx, bindings, { now }));
  for (const changed of [{ ...ctx, jobId: '01' }, { ...ctx, jobId: (1n << 256n).toString() }, { ...ctx, chainId: 0 }])
    await assert.rejects(encryptForRecipients(plaintext, changed, [good], { now }));
  await assert.rejects(encryptForRecipients(plaintext, ctx, [good], { now: NaN }));
});

test('payload and envelope bounds reject malformed data before crypto', async () => {
  const { a, envelope } = await fixture();
  await assert.rejects(encryptForRecipients(new Uint8Array(MAX_DOCUMENT_BYTES + 1), ctx, [await bind(a)], { now }), /2 MiB/);
  for (const size of [0, MAX_DOCUMENT_BYTES]) {
    const data = new Uint8Array(size); if (size) data[size - 1] = 42;
    const encrypted = await encryptForRecipients(data, ctx, [await bind(a)], { now });
    assert.deepEqual(await decryptForRecipient(encrypted, ctx, ownerA, a), data);
  }
  for (const malformed of [null, {}, { ...envelope, extra: 'ignored?' }, { ...envelope, ciphertext: '0x' },
    { ...envelope, iv: '0x00' }, { ...envelope, recipients: [] }, { ...envelope, version: 2 },
    { ...envelope, ciphertext: `0x${'00'.repeat(MAX_DOCUMENT_BYTES + 17)}` }])
    await assert.rejects(decryptForRecipient(malformed, ctx, ownerA, a));
});

test('inputs are snapshotted before async crypto and namespaces fail closed', async () => {
  const a = await loadOrCreateDeviceKey('snapshot'); const binding = await bind(a);
  const source = new Uint8Array(plaintext); const c = { ...ctx };
  const pending = encryptForRecipients(source, c, [binding], { now });
  source.fill(0); c.jobId = '99'; binding.owner = outsider;
  assert.deepEqual(await decryptForRecipient(await pending, ctx, ownerA, a), plaintext);
  for (const ns of ['', ' space', 'a'.repeat(257)]) await assert.rejects(loadOrCreateDeviceKey(ns), /namespace/);
  const original = globalThis.indexedDB;
  Object.defineProperty(globalThis, 'indexedDB', { value: undefined, writable: true, configurable: true });
  await assert.rejects(loadOrCreateDeviceKey('unavailable'), /no volatile fallback/);
  globalThis.indexedDB = original;
});

test('bounded history rejects rotation without discarding any existing key', async () => {
  for (let i = 0; i < MAX_DEVICE_KEYS; i++) await rotateDeviceKey('full');
  const history = await listDeviceKeys('full');
  await assert.rejects(rotateDeviceKey('full'), /history is full/);
  assert.deepEqual(await listDeviceKeys('full'), history);
});

test('corrupted IndexedDB record is not silently replaced', async () => {
  await loadOrCreateDeviceKey('corrupt');
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('review-pass-device-keys-v1', 1);
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('namespaces', 'readwrite');
    tx.objectStore('namespaces').put(null, 'corrupt');
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  db.close();
  await assert.rejects(loadOrCreateDeviceKey('corrupt'), /Corrupt device key store/);
});

// Real Chromium uses its own native IndexedDB and WebCrypto. No chain, wallet, API or Bee needed.
test('real browser reload and separate recipient profiles preserve confidentiality', async () => {
  const { createServer } = await import('vite');
  const { chromium } = await import('playwright');
  const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error',
    plugins: [{ name: 'isolated-key-test-page', configureServer(vite) {
      vite.middlewares.use('/key-test', (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><title>Explicit key integration test</title><script type="module">import * as keys from "/experiments/qualification/pilot/keys.ts";window.keys=keys;</script>');
      });
    } }],
  });
  await server.listen();
  const address = server.httpServer!.address() as { port: number };
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch();
    const aContext = await browser.newContext(); const bContext = await browser.newContext(); const outsiderContext = await browser.newContext();
    const aPage = await aContext.newPage(); const bPage = await bContext.newPage(); const outsiderPage = await outsiderContext.newPage();
    const url = `http://127.0.0.1:${address.port}/key-test`;
    for (const page of [aPage, bPage, outsiderPage]) { page.on('pageerror', error => console.error(error.message)); page.on('response', response => { if (response.status() >= 400) console.error(response.status(), response.url()); }); await page.goto(url); await page.waitForFunction(() => Boolean((window as any).keys), undefined, { timeout: 10000 }); }
    const create = async (page: typeof aPage) => page.evaluate(async () => {
      const k = (window as any).keys; const device = await k.loadOrCreateDeviceKey('browser-recipient');
      return { keyId: device.keyId, publicKey: await k.getDevicePublicKey(device), extractable: device.privateKey.extractable };
    });
    const [a, b, outside] = await Promise.all([create(aPage), create(bPage), create(outsiderPage)]);
    assert.equal(a.extractable, false); assert.notEqual(a.keyId, b.keyId); assert.notEqual(a.keyId, outside.keyId);
    const bindings = [{ owner: ownerA, publicKey: a.publicKey, version: '1', expiresAt: now + 100 }, { owner: ownerB, publicKey: b.publicKey, version: '1', expiresAt: now + 100 }];
    const envelope = await aPage.evaluate(async ({ ctx, bindings, now }) =>
      (window as any).keys.encryptForRecipients(new TextEncoder().encode('Browser-confidential result'), ctx, bindings, { now }), { ctx, bindings, now });
    await aPage.reload(); await aPage.waitForFunction(() => Boolean((window as any).keys));
    assert.equal((await create(aPage)).keyId, a.keyId);
    const decrypt = (page: typeof aPage, owner: Hex) => page.evaluate(async ({ envelope, ctx, owner }) => {
      const k = (window as any).keys; const device = await k.loadOrCreateDeviceKey('browser-recipient');
      return new TextDecoder().decode(await k.decryptForRecipient(envelope, ctx, owner, device));
    }, { envelope, ctx, owner });
    assert.equal(await decrypt(aPage, ownerA), 'Browser-confidential result');
    assert.equal(await decrypt(bPage, ownerB), 'Browser-confidential result');
    await assert.rejects(decrypt(outsiderPage, ownerA), /does not match/);
    const rotatedId = await aPage.evaluate(async () => (await (window as any).keys.rotateDeviceKey('browser-recipient')).keyId);
    assert.notEqual(rotatedId, a.keyId);
    await aPage.reload(); await aPage.waitForFunction(() => Boolean((window as any).keys));
    const historical = await aPage.evaluate(async ({ envelope, ctx, ownerA, keyId }) => {
      const k = (window as any).keys; const device = await k.loadDeviceKey('browser-recipient', keyId);
      return new TextDecoder().decode(await k.decryptForRecipient(envelope, ctx, ownerA, device));
    }, { envelope, ctx, ownerA, keyId: a.keyId });
    assert.equal(historical, 'Browser-confidential result');
    assert.equal((await create(aPage)).keyId, rotatedId);
  } finally { await browser?.close(); await server.close(); }
});
