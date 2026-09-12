import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGatewayStorage, GatewayUploadVerificationError } from './swarm-gateway.js';
import { MAX_STORAGE_BYTES } from './swarm-id.js';

const bytes = new TextEncoder().encode('ciphertext fixture, with Unicode 🪄');
const reference = 'ab'.repeat(32);
const sha = async (value: Uint8Array) => `0x${Buffer.from(await crypto.subtle.digest('SHA-256', Uint8Array.from(value))).toString('hex')}` as `0x${string}`;
const health = () => Response.json({ gateway: true });
const uploaded = () => Response.json({ reference });

test('accountless upload omits browser credentials and authenticates exact bytes with a separate GET', async () => {
  const calls: string[] = [];
  const input = Uint8Array.from(bytes);
  const storage = createGatewayStorage({}, { fetch: async (url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store'); assert.equal(init?.referrerPolicy, 'no-referrer');
    assert.ok(init?.signal);
    if (String(url).endsWith('/gateway')) return health();
    if (init?.method === 'POST') {
      assert.deepEqual(init.headers, { 'Content-Type': 'application/octet-stream', 'Swarm-Postage-Batch-Id': '0'.repeat(64) });
      assert.deepEqual(init.body, bytes); input.fill(0); assert.deepEqual(init.body, bytes);
      return uploaded();
    }
    return new Response(bytes);
  } });
  assert.equal(storage.state.canUpload, false);
  await storage.initialize();
  const state = storage.state; state.canUpload = false;
  assert.equal(storage.state.canUpload, true);
  assert.deepEqual(await storage.upload(input), { reference, sha256: await sha(bytes) });
  assert.deepEqual(calls, [
    'GET https://api.gateway.ethswarm.org/gateway',
    'POST https://api.gateway.ethswarm.org/bytes',
    `GET https://api.gateway.ethswarm.org/bytes/${reference}`,
  ]);
  storage.destroy();
});

test('retrieval propagation retries never repeat the successful upload', async () => {
  let posts = 0, gets = 0;
  const storage = createGatewayStorage({}, { retrievalRetryDelaysMs: [1, 1], fetch: async (url, init) => {
    if (String(url).endsWith('/gateway')) return health();
    if (init?.method === 'POST') { posts++; return uploaded(); }
    gets++; return gets === 1 ? new Response(null, { status: 404 }) : new Response(bytes);
  } });
  await storage.initialize(); await storage.upload(bytes);
  assert.equal(posts, 1); assert.equal(gets, 2); storage.destroy();
});

test('failed verification preserves public reference/digest and supports a later authenticated read', async () => {
  let recover = false, posts = 0;
  const storage = createGatewayStorage({}, { retrievalRetryDelaysMs: [], fetch: async (url, init) => {
    if (String(url).endsWith('/gateway')) return health();
    if (init?.method === 'POST') { posts++; return uploaded(); }
    return recover ? new Response(bytes) : new Response(null, { status: 503 });
  } });
  await storage.initialize();
  let saved;
  try { await storage.upload(bytes); assert.fail('must reject'); }
  catch (error) {
    assert.ok(error instanceof GatewayUploadVerificationError);
    saved = error.storageRef; assert.ok(error.message.includes(reference));
  }
  recover = true; assert.deepEqual(await storage.download(saved), bytes);
  assert.equal(posts, 1); storage.destroy();
});

test('wrong digest fails without propagation retry and never returns a successful upload', async () => {
  let gets = 0;
  const storage = createGatewayStorage({}, { retrievalRetryDelaysMs: [1], fetch: async (url, init) => {
    if (String(url).endsWith('/gateway')) return health();
    if (init?.method === 'POST') return uploaded();
    gets++; return new Response('corrupted');
  } });
  await storage.initialize();
  await assert.rejects(storage.upload(bytes), error => error instanceof GatewayUploadVerificationError && /document digest/.test(String(error.cause)));
  assert.equal(gets, 1); storage.destroy();
});

test('health failures are retryable and concurrent initialization is shared', async () => {
  for (const failure of [new Response(null, { status: 503 }), Response.json({ gateway: false })]) {
    let calls = 0;
    const storage = createGatewayStorage({}, { fetch: async () => ++calls === 1 ? failure : health() });
    const results = await Promise.allSettled([storage.initialize(), storage.initialize()]);
    assert.ok(results.every(result => result.status === 'rejected')); assert.equal(calls, 1);
    assert.equal(storage.state.canUpload, false);
    await storage.connect(); assert.equal(storage.state.mode, 'subsidised'); storage.destroy();
  }
});

test('POST HTTP failures and native key-bearing/malformed references cannot reach retrieval', async () => {
  for (const response of [new Response(null, { status: 429 }), Response.json({ reference: reference.repeat(2) }), Response.json({ reference: '../secret' })]) {
    let gets = 0;
    const storage = createGatewayStorage({}, { fetch: async (url, init) => {
      if (String(url).endsWith('/gateway')) return health();
      if (init?.method === 'POST') return response;
      gets++; return new Response(bytes);
    } });
    await storage.initialize(); await assert.rejects(storage.upload(bytes), /HTTP 429|32-byte/);
    assert.equal(gets, 0); storage.destroy();
  }
});

test('size and readiness validation rejects before upload', async () => {
  let calls = 0;
  const storage = createGatewayStorage({}, { fetch: async () => { calls++; return health(); } });
  await assert.rejects(storage.upload(bytes), /not ready/);
  await storage.initialize();
  await assert.rejects(storage.upload(new Uint8Array()), /byte size/);
  await assert.rejects(storage.upload(new Uint8Array(MAX_STORAGE_BYTES + 1)), /byte size/);
  assert.equal(calls, 1); storage.destroy();
});

test('destroy aborts in-flight initialization and cannot resurrect readiness even when fetch ignores abort', async () => {
  let release!: (value: Response) => void, signal: AbortSignal | undefined;
  const storage = createGatewayStorage({}, { fetch: async (_url, init) => {
    signal = init?.signal ?? undefined;
    return new Promise(resolve => { release = resolve; });
  } });
  const pending = storage.initialize(); storage.destroy();
  assert.equal(signal?.aborted, true); release(health());
  await assert.rejects(pending, /closed/); assert.equal(storage.state.canUpload, false);
});

test('timeout aborts the health request and reconnect can recover', async () => {
  let recover = false;
  const storage = createGatewayStorage({}, { timeoutMs: 5, fetch: async (_url, init) => {
    if (recover) return health();
    return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  await assert.rejects(storage.initialize(), /aborted/); assert.equal(storage.state.canUpload, false);
  recover = true; await storage.connect(); assert.equal(storage.state.canUpload, true); storage.destroy();
});

test('cancelled initialization cannot overwrite a newer ready state', async () => {
  let release!: (value: Response) => void, calls = 0;
  const storage = createGatewayStorage({}, { fetch: async () => {
    if (++calls === 1) return new Promise(resolve => { release = resolve; });
    return health();
  } });
  const stale = storage.initialize();
  await storage.disconnect(); await storage.connect();
  assert.equal(storage.state.canUpload, true);
  release(new Response(null, { status: 503 }));
  await assert.rejects(stale);
  assert.equal(storage.state.canUpload, true); storage.destroy();
});

test('destroy aborts the POST without retrying the potentially completed upload', async () => {
  let started!: () => void, posts = 0;
  const postStarted = new Promise<void>(resolve => { started = resolve; });
  const storage = createGatewayStorage({}, { fetch: async (url, init) => {
    if (String(url).endsWith('/gateway')) return health();
    posts++; started();
    return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  await storage.initialize(); const uploading = storage.upload(bytes);
  await postStarted; storage.destroy();
  await assert.rejects(uploading, /aborted/); assert.equal(posts, 1);
});

test('destroy cancels post-upload retrieval and retains the recovery reference', async () => {
  let started!: () => void; const downloadStarted = new Promise<void>(resolve => { started = resolve; });
  const storage = createGatewayStorage({}, { fetch: async (url, init) => {
    if (String(url).endsWith('/gateway')) return health();
    if (init?.method === 'POST') return uploaded();
    started(); return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  await storage.initialize(); const uploading = storage.upload(bytes);
  await downloadStarted; storage.destroy();
  await assert.rejects(uploading, error => error instanceof GatewayUploadVerificationError && error.storageRef.reference === reference);
  assert.equal(storage.state.canUpload, false);
});

test('download remains accountless without initialized upload readiness', async () => {
  const storage = createGatewayStorage({}, { fetch: async () => new Response(bytes) });
  assert.deepEqual(await storage.download({ reference, sha256: await sha(bytes) }), bytes);
  storage.destroy();
  await assert.rejects(storage.download({ reference, sha256: await sha(bytes) }), /closed/);
});

test('gateway endpoints reject credentials and insecure or query-bearing configuration', () => {
  for (const gatewayUrl of ['http://example.com', 'https://u:p@example.com', 'https://example.com/?key=x', 'https://example.com/#x'])
    assert.throws(() => createGatewayStorage({ gatewayUrl }), /HTTPS/);
});
