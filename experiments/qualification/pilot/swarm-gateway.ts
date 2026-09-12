/** Accountless Swarm transport. The gateway supplies postage; callers encrypt
 * private documents before passing bytes here. No identity, stamp signer, cookie,
 * or document decryption key is sent. Readiness is transport availability only.
 */
import { createSwarmStorage, MAX_STORAGE_BYTES, type StorageRef, type StorageState } from './swarm-id.js';

async function boundedJSON(response: Response): Promise<unknown> {
  const limit = 16 * 1024;
  const declared = response.headers.get('content-length');
  if (!response.body) throw new Error('Storage gateway returned an empty response');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    await response.body.cancel();
    throw new Error('Storage gateway response exceeds the allowed byte size');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > limit) throw new Error('Storage gateway response exceeds the allowed byte size');
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export class GatewayUploadVerificationError extends Error {
  constructor(readonly storageRef: StorageRef, options?: ErrorOptions) {
    super(`Document uploaded but independent retrieval is not verified. Keep reference ${storageRef.reference} and SHA-256 ${storageRef.sha256}; retry retrieval before uploading again.`, options);
    this.name = 'GatewayUploadVerificationError';
  }
}

export function createGatewayStorage(
  options: { gatewayUrl?: string; onState?: (state: StorageState) => void } = {},
  dependencies: { fetch?: typeof globalThis.fetch; timeoutMs?: number; retrievalRetryDelaysMs?: readonly number[] } = {},
) {
  const gateway = new URL(options.gatewayUrl ?? 'https://api.gateway.ethswarm.org');
  if (gateway.protocol !== 'https:' || gateway.username || gateway.password || gateway.search || gateway.hash)
    throw new Error('Storage requires an HTTPS gateway without credentials or query parameters');
  const base = gateway.href.replace(/\/$/, '');
  const fetchBytes = dependencies.fetch ?? globalThis.fetch.bind(globalThis);
  const timeout = dependencies.timeoutMs ?? 30_000;
  const retries = dependencies.retrievalRetryDelaysMs ?? [1_000, 3_000];
  const retrieval = createSwarmStorage({ gatewayUrl: base }, { fetch: fetchBytes });
  const controllers = new Set<AbortController>();
  let destroyed = false;
  let revision = 0;
  let initializing: Promise<void> | undefined;
  let state: StorageState = unavailable();
  function unavailable(): StorageState { return { connected: false, canUpload: false, mode: 'unavailable', reason: 'not-connected' }; }
  function publish(next: StorageState) { state = next; options.onState?.({ ...next }); }
  function alive(expected = revision) {
    if (destroyed) throw new Error('Storage client is closed');
    if (expected !== revision) throw new Error('Storage request was cancelled; retry');
  }
  async function request<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const expected = revision;
    alive(expected);
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const result = await operation(controller.signal);
      alive(expected);
      if (controller.signal.aborted) throw new Error('Storage request timed out or was cancelled');
      return result;
    } finally { clearTimeout(timer); controllers.delete(controller); }
  }
  const anonymous = { credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' } as const;
  function initialize(): Promise<void> {
    alive();
    if (initializing) return initializing;
    const expected = revision;
    initializing = request(async signal => {
      const response = await fetchBytes(`${base}/gateway`, { ...anonymous, signal });
      if (!response.ok) throw new Error(`Document storage is unavailable (HTTP ${response.status}); retry`);
      const status = await boundedJSON(response);
      if (!status || typeof status !== 'object' || !('gateway' in status) || status.gateway !== true)
        throw new Error('Document storage gateway is unavailable; retry');
    }).then(() => {
      alive(expected);
      publish({ connected: true, canUpload: true, mode: 'subsidised' });
    }).catch(error => {
      if (!destroyed && expected === revision) publish(unavailable());
      throw error;
    }).finally(() => { if (expected === revision) initializing = undefined; });
    return initializing;
  }
  function cancel() {
    revision++;
    initializing = undefined;
    for (const controller of controllers) controller.abort();
    controllers.clear();
    publish(unavailable());
  }
  async function pause(ms: number) {
    await request(signal => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(done, ms);
      function done() { signal.removeEventListener('abort', abort); resolve(); }
      function abort() { clearTimeout(timer); reject(new Error('Storage request was cancelled')); }
      signal.addEventListener('abort', abort, { once: true });
    }));
  }
  return {
    get state(): StorageState { return { ...state }; },
    initialize,
    connect: initialize,
    async disconnect() { alive(); cancel(); },
    async upload(input: Uint8Array): Promise<StorageRef> {
      alive();
      if (!(input instanceof Uint8Array) || input.byteLength === 0 || input.byteLength > MAX_STORAGE_BYTES)
        throw new Error('Encrypted upload exceeds the allowed byte size');
      if (!state.canUpload) throw new Error('Document storage is not ready; retry storage');
      const expected = revision;
      const bytes = Uint8Array.from(input);
      const sha256 = `0x${Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
      alive(expected);
      const reference = await request(async signal => {
        const response = await fetchBytes(`${base}/bytes`, {
          ...anonymous, signal, method: 'POST', body: bytes,
          headers: { 'Content-Type': 'application/octet-stream', 'Swarm-Postage-Batch-Id': '0'.repeat(64) },
        });
        if (!response.ok) throw new Error(`Document upload failed (HTTP ${response.status}); retry when storage is available`);
        const result = await boundedJSON(response);
        if (!result || typeof result !== 'object' || !('reference' in result) ||
            typeof result.reference !== 'string' || !/^[a-f0-9]{64}$/i.test(result.reference))
          throw new Error('Expected a normal 32-byte Swarm reference');
        return result.reference.toLowerCase() as string;
      });
      const storageRef = { reference, sha256 };
      // Never repeat POST automatically: propagation retries are reads only.
      for (let attempt = 0; ; attempt++) {
        try {
          alive(expected);
          await retrieval.download(storageRef);
          alive(expected);
          return storageRef;
        } catch (error) {
          if (destroyed || expected !== revision || attempt >= retries.length ||
              /document digest|byte size|Invalid authenticated/.test(String(error)))
            throw new GatewayUploadVerificationError(storageRef, { cause: error });
          try { await pause(retries[attempt]); }
          catch (cause) { throw new GatewayUploadVerificationError(storageRef, { cause }); }
        }
      }
    },
    async download(ref: StorageRef) { alive(); return retrieval.download(ref); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancel();
      retrieval.destroy();
    },
  };
}
