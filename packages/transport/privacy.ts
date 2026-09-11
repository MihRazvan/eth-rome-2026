import { Aes256Gcm, CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } from '@hpke/core';
import { bytesToHex, hexToBytes, keccak256, type Address, type Hex } from 'viem';

export const PRIVACY_VERSION = 1 as const;
const suite = new CipherSuite({ kem: new DhkemP256HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
const utf8 = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
export const encodeJson = (value: unknown) => utf8.encode(JSON.stringify(value));
export const decodeJson = (bytes: Uint8Array) => JSON.parse(decoder.decode(bytes)) as unknown;

export interface RequestContext {
  chainId: number;
  market: Address;
  seller: Address;
  requestId: Hex;
}
export interface KeyBinding extends RequestContext {
  version: number;
  publicKey: Hex;
  validFrom: number;
  validUntil: number;
}
export interface SignedKeyBinding { binding: KeyBinding; signature: Hex }
export interface ActiveKey { keyHash: Hex; version: number; revoked: boolean }
/** Must read current authoritative registry state. Network failure must reject; never return a cached active value. */
export type BindingStatusReader = (context: RequestContext) => Promise<ActiveKey>;
export const keyBindingTypes = { RecipientKey: [
  { name: 'purpose', type: 'string' }, { name: 'seller', type: 'address' },
  { name: 'requestId', type: 'bytes32' }, { name: 'publicKeyHash', type: 'bytes32' },
  { name: 'keyVersion', type: 'uint256' }, { name: 'validFrom', type: 'uint256' },
  { name: 'validUntil', type: 'uint256' },
] } as const;
export function keyBindingTypedData(binding: KeyBinding) {
  return {
    domain: { name: 'EXIT Private Offers', version: '1', chainId: binding.chainId, verifyingContract: binding.market },
    types: keyBindingTypes, primaryType: 'RecipientKey' as const,
    message: { purpose: 'Encrypt EXIT purchase offers only', seller: binding.seller, requestId: binding.requestId,
      publicKeyHash: keccak256(binding.publicKey), keyVersion: BigInt(binding.version),
      validFrom: BigInt(binding.validFrom), validUntil: BigInt(binding.validUntil) },
  };
}
export type VerifyBindingSignature = (data: ReturnType<typeof keyBindingTypedData>, signature: Hex, signer: Address) => Promise<boolean>;
function assertContext(actual: RequestContext, expected: RequestContext) {
  if (actual.chainId !== expected.chainId || actual.market.toLowerCase() !== expected.market.toLowerCase() ||
      actual.seller.toLowerCase() !== expected.seller.toLowerCase() || actual.requestId !== expected.requestId)
    throw new Error('Offer request context mismatch');
}
export async function validateBinding(cert: SignedKeyBinding, expected: RequestContext, verify: VerifyBindingSignature,
  status: BindingStatusReader, now = Math.floor(Date.now() / 1000)): Promise<void> {
  const b = cert.binding;
  assertContext(b, expected);
  if (!Number.isSafeInteger(b.version) || b.version < 1 || !Number.isSafeInteger(b.validFrom) ||
    !Number.isSafeInteger(b.validUntil) || b.validFrom > now || b.validUntil <= now || !/^0x04[0-9a-fA-F]{128}$/.test(b.publicKey))
    throw new Error('Recipient key is malformed, inactive or expired');
  if (!await verify(keyBindingTypedData(b), cert.signature, b.seller)) throw new Error('Recipient key signature rejected');
  const active = await status(expected);
  if (active.revoked || active.version !== b.version || active.keyHash !== keccak256(b.publicKey))
    throw new Error('Recipient key is rotated or revoked');
}

export interface RecipientKey { publicKey: Hex; privateKey: CryptoKey }
/** Separate random encryption key. Private half is never exported and is not wallet-derived. */
export async function generateRecipientKey(): Promise<RecipientKey> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  return { publicKey: bytesToHex(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))), privateKey: pair.privateKey };
}
export interface QuoteCodec<T> {
  encode(quote: T): Uint8Array;
  decode(bytes: Uint8Array): T;
  /** Must authenticate maker signature AND quote seller/domain against this exact request. */
  verify(quote: T, context: RequestContext): Promise<boolean>;
}
export interface PrivateEnvelope extends RequestContext {
  format: 'exit-private-offer';
  version: 1;
  keyVersion: number;
  keyHash: Hex;
  encapsulatedKey: Hex;
  ciphertext: Hex;
}
function envelopeHeader(b: KeyBinding) {
  return { format: 'exit-private-offer' as const, version: PRIVACY_VERSION, chainId: b.chainId,
    market: b.market.toLowerCase() as Address, seller: b.seller.toLowerCase() as Address, requestId: b.requestId,
    keyVersion: b.version, keyHash: keccak256(b.publicKey) };
}
const info = utf8.encode('EXIT Private Offers | RFC9180 | P256-SHA256-AES256GCM | v1');
export async function encryptOffer<T>(quote: T, cert: SignedKeyBinding, context: RequestContext, codec: QuoteCodec<T>,
  verify: VerifyBindingSignature, status: BindingStatusReader, now?: number): Promise<PrivateEnvelope> {
  await validateBinding(cert, context, verify, status, now);
  if (!await codec.verify(quote, context)) throw new Error('Purchase quote rejected');
  const header = envelopeHeader(cert.binding);
  const recipientPublicKey = await suite.kem.deserializePublicKey(hexToBytes(cert.binding.publicKey).buffer as ArrayBuffer);
  const sender = await suite.createSenderContext({ recipientPublicKey, info });
  const ciphertext = await sender.seal(codec.encode(quote), encodeJson(header));
  return { ...header, encapsulatedKey: bytesToHex(new Uint8Array(sender.enc)), ciphertext: bytesToHex(new Uint8Array(ciphertext)) };
}
/** Historical decryption remains allowed after rotation/expiry. Quote validity is checked separately. */
export async function decryptOffer<T>(envelope: PrivateEnvelope, binding: KeyBinding, key: RecipientKey,
  context: RequestContext, codec: QuoteCodec<T>): Promise<T> {
  assertContext(envelope, context);
  assertContext(binding, context);
  if (envelope.format !== 'exit-private-offer' || envelope.version !== PRIVACY_VERSION ||
      envelope.keyVersion !== binding.version || envelope.keyHash !== keccak256(binding.publicKey) || key.publicKey !== binding.publicKey)
    throw new Error('Private offer key or version mismatch');
  try {
    const publicKey = await suite.kem.deserializePublicKey(hexToBytes(key.publicKey).buffer as ArrayBuffer);
    const recipient = await suite.createRecipientContext({ recipientKey: { privateKey: key.privateKey, publicKey },
      enc: hexToBytes(envelope.encapsulatedKey), info });
    const plaintext = await recipient.open(hexToBytes(envelope.ciphertext), encodeJson(envelopeHeader(binding)));
    const quote = codec.decode(new Uint8Array(plaintext));
    if (!await codec.verify(quote, context)) throw new Error('signature');
    return quote;
  } catch { throw new Error('Private offer could not be authenticated'); }
}

export interface KeyStore {
  save(id: string, key: RecipientKey): Promise<void>;
  load(id: string): Promise<RecipientKey | undefined>;
  remove(id: string): Promise<void>;
}
export const keyStorageId = (b: KeyBinding) => `${b.chainId}:${b.market.toLowerCase()}:${b.seller.toLowerCase()}:${b.requestId}:${b.version}`;
/** Browser-local persistence; IndexedDB structured-clones non-extractable CryptoKey objects. No cross-device promise. */
export class BrowserKeyStore implements KeyStore {
  private async open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('exit-recipient-keys-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('keys');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Private key storage unavailable'));
    });
  }
  private async operation<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    try { return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('keys', mode);
      const request = fn(tx.objectStore('keys'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error('Private key storage failed'));
    }); } finally { db.close(); }
  }
  async save(id: string, key: RecipientKey) {
    if (key.privateKey.extractable) throw new Error('Extractable private keys cannot be persisted');
    await this.operation('readwrite', s => s.put(key, id));
  }
  async load(id: string) { return await this.operation<RecipientKey | undefined>('readonly', s => s.get(id)); }
  async remove(id: string) { await this.operation('readwrite', s => s.delete(id)); }
}
