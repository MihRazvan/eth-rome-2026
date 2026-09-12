import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSwarmStorage, MAX_STORAGE_BYTES, type SwarmClientLike, type StorageRef } from './swarm-id.js';
const bytes = new TextEncoder().encode('already encrypted envelope bytes');
const ref = 'ab'.repeat(32);
const sha = async (input: Uint8Array) => `0x${Buffer.from(await crypto.subtle.digest('SHA-256', Uint8Array.from(input))).toString('hex')}` as `0x${string}`;
function fixture() {
  let changed = () => {}; let uploads = 0; let destroyed = 0;
  const client: SwarmClientLike = {
    connectionInfo: { identity: null, canUpload: false, uploadMode: 'unavailable' },
    async initialize() {}, async connect() { client.connectionInfo = { identity: { id: 'one' }, canUpload: true, uploadMode: 'user-stamp' }; changed(); },
    async disconnect() { client.connectionInfo = { identity: null, canUpload: false, uploadMode: 'unavailable' }; changed(); },
    destroy() { destroyed++; },
    async uploadData(input, options, request) {
      uploads++; assert.deepEqual(input, bytes); assert.deepEqual(options, { encrypt: false }); assert.equal(request.timeout, 30_000);
      return { reference: { toHex: () => ref } };
    },
  };
  const storage = createSwarmStorage({}, { loadClient: async config => { changed = config.onConnectionChange; return client; } });
  return { storage, client, changed: () => changed(), uploads: () => uploads, destroyed: () => destroyed };
}
test('imports in Node without eagerly importing browser SDK; gates postage and preserves ordinary encrypted bytes', async () => {
  const f = fixture(); await f.storage.initialize();
  await assert.rejects(f.storage.upload(bytes), /postage/); assert.equal(f.uploads(), 0);
  await f.storage.connect(); assert.deepEqual(await f.storage.upload(bytes), { reference: ref, sha256: await sha(bytes) });
  f.client.connectionInfo.canUpload = false; f.client.connectionInfo.uploadMode = 'unavailable';
  f.client.connectionInfo.uploadUnavailableReason = 'stamper-failed'; f.changed();
  assert.equal(f.storage.state.reason, 'stamper-failed'); await assert.rejects(f.storage.upload(bytes), /postage/);
  f.storage.destroy(); assert.equal(f.destroyed(), 1);
});
test('an identity change during upload rejects the result even when upload already happened', async () => {
  const f = fixture(); await f.storage.initialize(); await f.storage.connect();
  f.client.uploadData = async () => { f.client.connectionInfo.identity = { id: 'two' }; f.changed(); return { reference: ref }; };
  await assert.rejects(f.storage.upload(bytes), /changed/); f.storage.destroy();
});
test('rejects key-bearing native references, empty and oversized envelopes', async () => {
  const f = fixture(); await f.storage.initialize(); await f.storage.connect();
  for (const input of [new Uint8Array(), new Uint8Array(MAX_STORAGE_BYTES + 1)]) await assert.rejects(f.storage.upload(input), /byte size/);
  f.client.uploadData = async () => ({ reference: ref.repeat(2) });
  await assert.rejects(f.storage.upload(bytes), /32-byte/); f.storage.destroy();
});
test('initialization is shared and destroy during module load cannot resurrect a client', async () => {
  let release!: () => void; let destroys = 0; let loads = 0;
  const deferred = new Promise<void>(resolve => { release = resolve; });
  const f = fixture(); const storage = createSwarmStorage({}, { loadClient: async () => {
    loads++; await deferred; return { ...f.client, destroy() { destroys++; } };
  } });
  const a = storage.initialize(); const b = storage.initialize(); storage.destroy(); release();
  await assert.rejects(a, /closed/); await assert.rejects(b, /closed/);
  assert.equal(loads, 1); assert.equal(destroys, 1); assert.equal(storage.state.connected, false);
});
test('disconnect clears capability and blocks later uploads', async () => {
  const f = fixture(); await f.storage.initialize(); await f.storage.connect(); await f.storage.disconnect();
  assert.equal(f.storage.state.canUpload, false); await assert.rejects(f.storage.upload(bytes), /postage/); f.storage.destroy();
});
test('independent retrieval works without an identity, uses no credentials and authenticates exact chain digest', async () => {
  let calls = 0;
  const storage = createSwarmStorage({ gatewayUrl: 'https://independent.example/gateway/' }, { fetch: async (url, init) => {
    calls++; assert.equal(url, `https://independent.example/gateway/bytes/${ref}`);
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error'); assert.equal(init?.referrerPolicy, 'no-referrer');
    return new Response(bytes);
  } });
  assert.deepEqual(await storage.download({ reference: ref, sha256: await sha(bytes) }), bytes);
  await assert.rejects(storage.download({ reference: ref, sha256: `0x${'00'.repeat(32)}` }), /onchain document digest/);
  assert.equal(calls, 2); storage.destroy();
});
test('retrieval rejects invalid addresses before fetch and cannot follow credential-bearing URLs', async () => {
  for (const gatewayUrl of ['http://localhost:1635', 'https://user:pass@example.com', 'https://example.com/?key=x', 'https://example.com/#x'])
    assert.throws(() => createSwarmStorage({ gatewayUrl }), /HTTPS/);
  let calls = 0; const storage = createSwarmStorage({}, { fetch: async () => { calls++; return new Response(bytes); } });
  const good: StorageRef = { reference: ref, sha256: await sha(bytes) };
  for (const bad of [{ ...good, reference: '../keys' }, { ...good, reference: ref.repeat(2) }, { ...good, sha256: '00' as `0x${string}` }])
    await assert.rejects(storage.download(bad), /Invalid/);
  assert.equal(calls, 0); storage.destroy();
});
test('streaming limit applies even when content-length is missing or false', async () => {
  const good: StorageRef = { reference: ref, sha256: await sha(bytes) };
  for (const header of [undefined, '1', String(MAX_STORAGE_BYTES + 1)]) {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(MAX_STORAGE_BYTES + 1)); }, cancel() { cancelled = true; } });
    const storage = createSwarmStorage({}, { fetch: async () => new Response(stream, { headers: header ? { 'content-length': header } : {} }) });
    await assert.rejects(storage.download(good), /byte size/); assert.equal(cancelled, true); storage.destroy();
  }
});
test('destroy aborts an independent retrieval that is waiting for response bytes', async () => {
  let began!: () => void; const started = new Promise<void>(resolve => { began = resolve; });
  const storage = createSwarmStorage({}, { fetch: async (_url, init) => {
    began(); return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  const download = storage.download({ reference: ref, sha256: await sha(bytes) });
  await started; storage.destroy(); await assert.rejects(download, /aborted/);
});
test('vendored browser artifact matches its manifest and contains no Axios input', async () => {
  const { readFile } = await import('node:fs/promises');
  const manifest = JSON.parse(await readFile(new URL('./vendor/swarm-id/manifest.json', import.meta.url), 'utf8'));
  const bundle = await readFile(new URL('./vendor/swarm-id/client.js', import.meta.url));
  assert.equal((await sha(bundle)).slice(2), manifest.outputSha256);
  assert.equal(manifest.axiosInputs, 0);
  assert.equal(manifest.inputs.some((item: { path: string }) => /^axios@/.test(item.path)), false);
});
test('actual Chromium loads the rebuilt adapter and canonical unauthenticated Swarm ID iframe', {
  skip: process.env.REVIEW_PASS_SWARM_LIVE_PROBE !== '1', timeout: 45_000,
}, async () => {
  const { build } = await import('esbuild');
  const { createServer } = await import('node:http');
  const { chromium } = await import('@playwright/test');
  const built = await build({ entryPoints: [new URL('./swarm-id.ts', import.meta.url).pathname],
    bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false });
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/adapter.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/adapter.js' ? built.outputFiles[0].contents : '<!doctype html><title>Read-only storage probe</title>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}`);
    const result = await page.evaluate(async () => {
      // @ts-expect-error Browser-served test module.
      const { createSwarmStorage: create } = await import('/adapter.js');
      const storage = create(); await storage.initialize(); const state = storage.state; storage.destroy(); return state;
    });
    assert.deepEqual(result, { connected: false, canUpload: false, mode: 'unavailable', reason: 'not-connected' });
  } finally { await browser.close(); server.close(); }
});
