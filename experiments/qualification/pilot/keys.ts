import { Aes256Gcm, CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } from '@hpke/core';

export type Hex = `0x${string}`;
export interface DocumentContext {
  chainId: number;
  escrow: Hex;
  jobId: string;
  purpose: 'review-result';
  version: 1;
}
/** The caller must obtain and authenticate CURRENT bindings from its configured registry. */
export interface RecipientBinding {
  owner: Hex;
  publicKey: Hex;
  version: string;
  /** Unix seconds, never milliseconds. */
  expiresAt: number;
}
export interface DeviceKey {
  readonly namespace: string;
  /** Public SHA-256 fingerprint, NOT the registry's monotonically increasing version. */
  readonly keyId: Hex;
  readonly createdAt: number;
  readonly publicKey: CryptoKey;
  readonly privateKey: CryptoKey;
}
export interface DeviceKeySummary {
  keyId: Hex;
  publicKey: Hex;
  createdAt: number;
  current: boolean;
}
interface RecipientWrap extends RecipientBinding { encapsulatedKey: Hex; wrappedKey: Hex }
export interface RecipientEnvelope {
  format: 'review-pass-recipient-document';
  version: 1;
  suite: 'P256-HKDF-SHA256-AES256GCM';
  context: DocumentContext;
  iv: Hex;
  ciphertext: Hex;
  recipients: RecipientWrap[];
}

export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
export const MAX_RECIPIENTS = 8;
export const MAX_DEVICE_KEYS = 32;
const DB_NAME = 'review-pass-device-keys-v1';
const STORE = 'namespaces';
const FORMAT = 'review-pass-recipient-document' as const;
const SUITE = 'P256-HKDF-SHA256-AES256GCM' as const;
const suite = new CipherSuite({ kem: new DhkemP256HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
const utf8 = new TextEncoder();
const hpkeInfo = utf8.encode('Review Pass | recipient content-key delivery | RFC9180 base | v1');
const json = (value: unknown) => utf8.encode(JSON.stringify(value));
const seconds = () => Math.floor(Date.now() / 1000);
const hex = (bytes: Uint8Array): Hex => `0x${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
function fail(reason: string): never { throw new Error(reason); }

function fields(value: unknown, names: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Object.keys(value).length !== names.length || !names.every(n => Object.hasOwn(value, n)))
    fail('Malformed document metadata');
  return value as Record<string, unknown>;
}
function boundedHex(value: unknown, min: number, max = min): Hex {
  if (typeof value !== 'string' || value.length < 2 + min * 2 || value.length > 2 + max * 2 ||
    !/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) fail('Malformed or oversized hexadecimal field');
  return value.toLowerCase() as Hex;
}
function bytes(value: Hex): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array((value.length - 2) / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(value.slice(2 + i * 2, 4 + i * 2), 16);
  return out;
}
function address(value: unknown): Hex {
  const result = boundedHex(value, 20);
  if (result === `0x${'0'.repeat(40)}`) fail('Zero address is not a recipient or escrow');
  return result;
}
function uint(value: unknown, bits: number, positive = false): string {
  if (typeof value !== 'string' || value.length > 78 || !/^(0|[1-9][0-9]*)$/.test(value))
    fail('Expected canonical unsigned decimal integer');
  const n = BigInt(value);
  if (n >= 1n << BigInt(bits) || (positive && n === 0n)) fail('Integer is outside its allowed range');
  return value;
}
function timestamp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail('Invalid Unix timestamp');
  return value;
}
function context(value: unknown): DocumentContext {
  const c = fields(value, ['chainId', 'escrow', 'jobId', 'purpose', 'version']);
  if (typeof c.chainId !== 'number' || !Number.isSafeInteger(c.chainId) || c.chainId <= 0 ||
    c.purpose !== 'review-result' || c.version !== 1) fail('Unsupported document context');
  return { chainId: c.chainId, escrow: address(c.escrow), jobId: uint(c.jobId, 256), purpose: 'review-result', version: 1 };
}
function binding(value: unknown): RecipientBinding {
  const b = fields(value, ['owner', 'publicKey', 'version', 'expiresAt']);
  const publicKey = boundedHex(b.publicKey, 65);
  if (!publicKey.startsWith('0x04')) fail('Expected an uncompressed P-256 public key');
  return { owner: address(b.owner), publicKey, version: uint(b.version, 64, true), expiresAt: timestamp(b.expiresAt) };
}
async function importPublicKey(publicKey: Hex): Promise<CryptoKey> {
  try { return await suite.kem.deserializePublicKey(bytes(publicKey)); }
  catch { return fail('Invalid P-256 curve point'); }
}
function recipientList(value: unknown): RecipientBinding[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_RECIPIENTS) fail('Expected 1–8 recipients');
  const result = value.map(binding).sort((a, b) => a.owner.localeCompare(b.owner));
  if (new Set(result.map(b => b.owner)).size !== result.length) fail('Duplicate recipient');
  return result;
}
function header(c: DocumentContext, iv: Hex, recipients: RecipientBinding[]) {
  return { format: FORMAT, version: 1, suite: SUITE, context: c, iv, recipients };
}

/** Bounds and authenticated metadata are checked before any decryption. */
function parseEnvelope(value: unknown): RecipientEnvelope {
  const e = fields(value, ['format', 'version', 'suite', 'context', 'iv', 'ciphertext', 'recipients']);
  if (e.format !== FORMAT || e.version !== 1 || e.suite !== SUITE) fail('Unsupported recipient envelope');
  if (!Array.isArray(e.recipients) || e.recipients.length < 1 || e.recipients.length > MAX_RECIPIENTS)
    fail('Expected 1–8 recipients');
  const recipients = e.recipients.map((value): RecipientWrap => {
    const r = fields(value, ['owner', 'publicKey', 'version', 'expiresAt', 'encapsulatedKey', 'wrappedKey']);
    return { ...binding({ owner: r.owner, publicKey: r.publicKey, version: r.version, expiresAt: r.expiresAt }),
      encapsulatedKey: boundedHex(r.encapsulatedKey, 65), wrappedKey: boundedHex(r.wrappedKey, 48) };
  });
  for (let i = 1; i < recipients.length; i++) {
    if (recipients[i - 1].owner >= recipients[i].owner) fail('Duplicate or unordered recipients');
  }
  return { format: FORMAT, version: 1, suite: SUITE, context: context(e.context), iv: boundedHex(e.iv, 12),
    ciphertext: boundedHex(e.ciphertext, 16, MAX_DOCUMENT_BYTES + 16), recipients };
}
const unwrapBinding = ({ owner, publicKey, version, expiresAt }: RecipientBinding): RecipientBinding =>
  ({ owner, publicKey, version, expiresAt });

/** Encrypt only for caller-authenticated current registry bindings; this function performs no directory lookup. */
export async function encryptForRecipients(plaintext: Uint8Array, requestedContext: DocumentContext,
  currentBindings: readonly RecipientBinding[], options: { now?: number } = {}): Promise<RecipientEnvelope> {
  if (!(plaintext instanceof Uint8Array) || plaintext.byteLength > MAX_DOCUMENT_BYTES) fail('Document exceeds 2 MiB or is not bytes');
  const input = new Uint8Array(plaintext); // No caller mutation across crypto awaits.
  const c = context(requestedContext);
  const bindings = recipientList(currentBindings);
  const now = timestamp(options.now ?? seconds());
  if (bindings.some(b => b.expiresAt <= now)) fail('Recipient key expired');
  const publicKeys = await Promise.all(bindings.map(b => importPublicKey(b.publicKey)));
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const iv = hex(ivBytes);
  const aad = json(header(c, iv, bindings));
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  try {
    const contentKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
    const ciphertext = hex(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes, additionalData: aad }, contentKey, input)));
    const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(ciphertext))));
    const recipients = await Promise.all(bindings.map(async (b, i): Promise<RecipientWrap> => {
      const sender = await suite.createSenderContext({ recipientPublicKey: publicKeys[i], info: hpkeInfo });
      const wrappedKey = await sender.seal(rawKey, json({ header: header(c, iv, bindings), recipient: b.owner, ciphertextHash: digest }));
      return { ...b, encapsulatedKey: hex(new Uint8Array(sender.enc)), wrappedKey: hex(new Uint8Array(wrappedKey)) };
    }));
    if (bindings.some(b => b.expiresAt <= (options.now ?? seconds()))) fail('Recipient key expired during encryption');
    return { format: FORMAT, version: 1, suite: SUITE, context: c, iv, ciphertext, recipients };
  } finally { rawKey.fill(0); input.fill(0); }
}

/** Historical decryption does NOT require a still-current binding. Select the matching retained device key. */
export async function decryptForRecipient(value: RecipientEnvelope | unknown, expectedContext: DocumentContext,
  requestedOwner: Hex, device: DeviceKey): Promise<Uint8Array> {
  const e = parseEnvelope(value);
  const c = context(expectedContext);
  if (JSON.stringify(e.context) !== JSON.stringify(c)) fail('Document context mismatch');
  const owner = address(requestedOwner);
  const wrap = e.recipients.find(r => r.owner === owner);
  if (!wrap) fail('No envelope for this recipient');
  if (await getDevicePublicKey(device) !== wrap.publicKey) fail('Selected device key does not match this historical recipient key');
  const bindings = e.recipients.map(unwrapBinding);
  const aad = json(header(c, e.iv, bindings));
  let rawKey: Uint8Array<ArrayBuffer> | undefined;
  try {
    const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(e.ciphertext))));
    const recipient = await suite.createRecipientContext({ recipientKey: { publicKey: device.publicKey, privateKey: device.privateKey },
      enc: bytes(wrap.encapsulatedKey), info: hpkeInfo });
    rawKey = new Uint8Array(await recipient.open(bytes(wrap.wrappedKey),
      json({ header: header(c, e.iv, bindings), recipient: owner, ciphertextHash: digest })));
    if (rawKey.length !== 32) fail('Wrong content key size');
    const contentKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(e.iv), additionalData: aad }, contentKey, bytes(e.ciphertext)));
  } catch { return fail('Recipient document authentication failed'); }
  finally { rawKey?.fill(0); }
}

interface StoredNamespace { version: 1; current: Hex; keys: DeviceKey[] }
function namespace(value: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9:._/-]{1,256}$/.test(value)) fail('Invalid device key namespace');
  return value;
}
function validateDevice(device: DeviceKey): void {
  if (!device || typeof device !== 'object') fail('Invalid stored device key');
  namespace(device.namespace);
  boundedHex(device.keyId, 32);
  timestamp(device.createdAt);
  const privateKey = device.privateKey;
  const publicKey = device.publicKey;
  if (!(privateKey instanceof CryptoKey) || !(publicKey instanceof CryptoKey) || privateKey.extractable ||
    privateKey.type !== 'private' || publicKey.type !== 'public' || privateKey.algorithm.name !== 'ECDH' ||
    publicKey.algorithm.name !== 'ECDH' || (privateKey.algorithm as EcKeyAlgorithm).namedCurve !== 'P-256' ||
    (publicKey.algorithm as EcKeyAlgorithm).namedCurve !== 'P-256' || privateKey.usages.length !== 1 ||
    privateKey.usages[0] !== 'deriveBits') fail('Stored device key must be nonextractable P-256 ECDH');
}
function validateStored(value: StoredNamespace | undefined, ns: string): void {
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || value.version !== 1 || !Array.isArray(value.keys) || value.keys.length < 1 || value.keys.length > MAX_DEVICE_KEYS ||
    new Set(value.keys.map(k => k.keyId)).size !== value.keys.length || !value.keys.some(k => k.keyId === value.current))
    fail('Corrupt device key store; refusing to replace existing keys');
  value.keys.forEach(k => { validateDevice(k); if (k.namespace !== ns) fail('Stored key namespace mismatch'); });
}
async function openStore(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') fail('IndexedDB key storage unavailable; no volatile fallback');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
    request.onerror = () => reject(new Error('IndexedDB key storage could not be opened'));
    request.onblocked = () => { blocked = true; reject(new Error('IndexedDB key storage is blocked by another tab')); };
  });
}
async function transaction<T>(ns: string, mode: IDBTransactionMode,
  apply: (value: StoredNamespace | undefined, store: IDBObjectStore) => T): Promise<T> {
  const db = await openStore();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const request = store.get(ns);
      let result: T;
      let error: unknown;
      request.onsuccess = () => {
        try { validateStored(request.result, ns); result = apply(request.result, store); }
        catch (cause) { error = cause; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(error ?? new Error('IndexedDB key storage transaction failed'));
    });
  } finally { db.close(); }
}
async function newDevice(ns: string): Promise<DeviceKey> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const encoded = await crypto.subtle.exportKey('raw', pair.publicKey);
  const keyId = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoded)));
  return { namespace: ns, keyId, createdAt: seconds(), publicKey: pair.publicKey, privateKey: pair.privateKey };
}
export async function getDevicePublicKey(device: DeviceKey): Promise<Hex> {
  validateDevice(device);
  const raw = await crypto.subtle.exportKey('raw', device.publicKey);
  if (hex(new Uint8Array(await crypto.subtle.digest('SHA-256', raw))) !== device.keyId) fail('Device public key fingerprint mismatch');
  return hex(new Uint8Array(raw));
}
/** Serialized read/write rechecks prevent concurrent tabs from overwriting a newly created key. */
export async function loadOrCreateDeviceKey(requestedNamespace: string): Promise<DeviceKey> {
  const ns = namespace(requestedNamespace);
  const existing = await transaction(ns, 'readonly', value => value?.keys.find(k => k.keyId === value.current));
  if (existing) { await getDevicePublicKey(existing); return existing; }
  const generated = await newDevice(ns);
  const result = await transaction(ns, 'readwrite', (value, store) => {
    if (value) return value.keys.find(k => k.keyId === value.current)!;
    store.put({ version: 1, current: generated.keyId, keys: [generated] } satisfies StoredNamespace, ns);
    return generated;
  });
  await getDevicePublicKey(result);
  return result;
}
/** Local rotation only: caller separately registers this public key and waits for registry confirmation. */
export async function rotateDeviceKey(requestedNamespace: string): Promise<DeviceKey> {
  const ns = namespace(requestedNamespace);
  const generated = await newDevice(ns);
  return transaction(ns, 'readwrite', (value, store) => {
    if (value && value.keys.length >= MAX_DEVICE_KEYS) fail('Device key history is full; no historical keys were deleted');
    store.put({ version: 1, current: generated.keyId, keys: [...(value?.keys ?? []), generated] } satisfies StoredNamespace, ns);
    return generated;
  });
}
export async function listDeviceKeys(requestedNamespace: string): Promise<DeviceKeySummary[]> {
  const value = await transaction(namespace(requestedNamespace), 'readonly', v => v);
  if (!value) return [];
  return Promise.all(value.keys.map(async k => ({ keyId: k.keyId, publicKey: await getDevicePublicKey(k), createdAt: k.createdAt, current: k.keyId === value.current })));
}
export async function loadDeviceKey(requestedNamespace: string, requestedKeyId: Hex): Promise<DeviceKey> {
  const ns = namespace(requestedNamespace);
  const keyId = boundedHex(requestedKeyId, 32);
  const key = await transaction(ns, 'readonly', value => value?.keys.find(k => k.keyId === keyId));
  if (!key) fail('Historical device key not found in this browser profile');
  await getDevicePublicKey(key);
  return key;
}
