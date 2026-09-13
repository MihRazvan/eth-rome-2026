import type { Holder } from './holder-enrollment.js';
import { validateProofFile, validateProofPair } from './proof-files.js';

/** Origin is scoped by IndexedDB; the remaining deployment and wallet context is explicit. */
export interface CredentialVaultScope {
  chainId: number;
  escrow: string;
  issuerX: string;
  issuerY: string;
  wallet: string;
}
export type VaultJson = null | boolean | number | string | VaultJson[] | { [key: string]: VaultJson };
export type IssuedCredential = {
  version: 'qualification-v1-test'; testOnly: true; holderCommitment: string;
  signature: string; issuerX: string; issuerY: string; index: number; class: number; expiry: number;
};
export interface CredentialVaultEntry {
  holder: Holder;
  credential?: IssuedCredential;
  /** Private enrollment state, including request and reply key. Never publish this object. */
  pending?: { [key: string]: VaultJson };
}
export const MAX_CREDENTIAL_VAULT_BYTES = 64 * 1024;
const DB_NAME = 'cutout-credential-vault-v1';
const STORE = 'credentials';
const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
class VaultError extends Error {}
function fail(message: string): never { throw new VaultError(message); }
const storageError = () => new VaultError('Private qualification storage failed. Check browser storage access and retry.');

function normalizedScope(scope: CredentialVaultScope): CredentialVaultScope {
  const address = (value: string) => {
    if (typeof value !== 'string' || !/^0x[0-9a-f]{40}$/i.test(value) || /^0x0{40}$/i.test(value))
      fail('Invalid qualification storage context.');
    return value.toLowerCase();
  };
  const field = (value: string) => {
    if (typeof value !== 'string' || !/^[1-9][0-9]{0,76}$/.test(value) || BigInt(value) >= FIELD)
      fail('Invalid qualification issuer context.');
    return value;
  };
  if (!scope || !Number.isSafeInteger(scope.chainId) || scope.chainId <= 0)
    fail('Invalid qualification storage context.');
  return { chainId: scope.chainId, escrow: address(scope.escrow), issuerX: field(scope.issuerX),
    issuerY: field(scope.issuerY), wallet: address(scope.wallet) };
}

/** Copies bounded plain JSON without invoking getters or toJSON on untrusted imports. */
function copyJson(value: unknown): VaultJson {
  let nodes = 0;
  let bytes = 0;
  const visit = (v: unknown, depth: number): VaultJson => {
    if (++nodes > 4096 || depth > 16) fail('Qualification data is too large or deeply nested.');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      bytes += v.length * 2;
      if (bytes > MAX_CREDENTIAL_VAULT_BYTES) fail('Qualification data exceeds browser storage limits.');
      return v;
    }
    if (!v || typeof v !== 'object' ||
      (!Array.isArray(v) && ![Object.prototype, null].includes(Object.getPrototypeOf(v))))
      fail('Qualification data must be plain JSON.');
    const descriptors = Object.getOwnPropertyDescriptors(v);
    if (Reflect.ownKeys(v).some(key => typeof key !== 'string')) fail('Qualification data must be plain JSON.');
    const entries = Object.entries(descriptors).filter(([key]) => !(Array.isArray(v) && key === 'length'));
    for (const [key, descriptor] of entries) {
      if (!('value' in descriptor) || !descriptor.enumerable) fail('Qualification data must be plain JSON.');
      bytes += key.length * 2;
      if (bytes > MAX_CREDENTIAL_VAULT_BYTES) fail('Qualification data exceeds browser storage limits.');
    }
    if (Array.isArray(v)) {
      if (entries.length !== v.length || entries.some(([key], i) => key !== String(i)))
        fail('Qualification data must be plain JSON.');
      return entries.map(([, descriptor]) => visit(descriptor.value, depth + 1));
    }
    return Object.fromEntries(entries.map(([key, descriptor]) => [key, visit(descriptor.value, depth + 1)]));
  };
  const result = visit(value, 0);
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_CREDENTIAL_VAULT_BYTES)
    fail('Qualification data exceeds browser storage limits.');
  return result;
}
function entry(value: unknown, scope: CredentialVaultScope): CredentialVaultEntry {
  const copied = copyJson(value);
  if (!copied || typeof copied !== 'object' || Array.isArray(copied)) fail('Invalid stored qualification.');
  if (Object.keys(copied).some(key => !['holder', 'credential', 'pending'].includes(key)))
    fail('Invalid stored qualification.');
  let holder: Holder;
  let credential: IssuedCredential | undefined;
  try {
    holder = validateProofFile('holder', copied.holder) as Holder;
    if (copied.credential !== undefined) {
      credential = validateProofFile('credential', copied.credential) as IssuedCredential;
      // Keep expired credentials available for recovery/renewal. Task eligibility is checked by the consumer.
      validateProofPair(credential, holder, credential.class, 0);
    }
  } catch { return fail('Invalid qualification or mismatched private holder and credential.'); }
  if (credential && (credential.issuerX !== scope.issuerX || credential.issuerY !== scope.issuerY))
    fail('Qualification belongs to a different issuer.');
  if (copied.pending !== undefined && (!copied.pending || typeof copied.pending !== 'object' || Array.isArray(copied.pending)))
    fail('Invalid pending qualification enrollment.');
  return { holder, ...(credential ? { credential } : {}),
    ...(copied.pending !== undefined ? { pending: copied.pending as CredentialVaultEntry['pending'] } : {}) };
}
function canonical(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return JSON.stringify(value);
}
async function openStore(): Promise<IDBDatabase> {
  try {
    if (typeof indexedDB === 'undefined') fail('Private qualification storage is unavailable in this browser.');
    return await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      let blocked = false;
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
      request.onerror = () => reject(storageError());
      request.onblocked = () => { blocked = true; reject(new VaultError('Private qualification storage is blocked by another tab.')); };
    });
  } catch (error) { throw error instanceof VaultError ? error : storageError(); }
}
interface StoredEntry { version: 1; scope: CredentialVaultScope; value: CredentialVaultEntry }
async function transact<T>(scope: CredentialVaultScope, mode: IDBTransactionMode,
  apply: (existing: CredentialVaultEntry | undefined, store: IDBObjectStore, key: string) => T,
  validateExisting = true): Promise<T> {
  const db = await openStore();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const key = JSON.stringify(scope);
      const request = store.get(key);
      let result: T;
      let failure: VaultError | undefined;
      request.onsuccess = () => {
        try {
          const stored = request.result as StoredEntry | undefined;
          let existing: CredentialVaultEntry | undefined;
          if (stored !== undefined && validateExisting) {
            if (!stored || stored.version !== 1 || canonical(stored.scope) !== canonical(scope))
              fail('Stored qualification context is corrupt. Restore a backup or explicitly remove it.');
            existing = entry(stored.value, scope);
          }
          result = apply(existing, store, key);
        } catch (error) {
          failure = error instanceof VaultError ? error : storageError();
          tx.abort();
        }
      };
      // A request succeeding is not a durable commit. Resolve only when the entire transaction completes.
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(failure ?? storageError());
    });
  } catch (error) { throw error instanceof VaultError ? error : storageError(); }
  finally { db.close(); }
}

/** Local profile storage only. Same-origin scripts can access these secrets, as with imported proof files.
 * This is not encrypted backup or guaranteed persistence; clearing site data loses the holder and reply key.
 * No network request, logging, wallet signing or in-memory persistence fallback occurs here.
 */
export async function loadCredentialVault(requestedScope: CredentialVaultScope): Promise<CredentialVaultEntry | undefined> {
  const scope = normalizedScope(requestedScope);
  return transact(scope, 'readonly', existing => existing);
}

/** Atomic pair/pending write. Concurrent tabs cannot silently overwrite a different holder or credential.
 * Initial issuance can add a credential to the existing holder. Renewal/import of a different issued
 * credential or holder requires explicit replace:true; omitted optional fields are removed.
 */
export async function saveCredentialVault(requestedScope: CredentialVaultScope, value: CredentialVaultEntry,
  options: { replace?: boolean } = {}): Promise<void> {
  const scope = normalizedScope(requestedScope);
  const next = entry(value, scope); // Copy before the first await to prevent caller mutation races.
  const replace = options.replace === true;
  return transact(scope, 'readwrite', (existing, store, key) => {
    if (existing && !replace && (canonical(existing.holder) !== canonical(next.holder) ||
      (existing.credential !== undefined && canonical(existing.credential) !== canonical(next.credential))))
      fail('A different qualification already exists in this browser. Explicitly replace or remove it first.');
    store.put({ version: 1, scope, value: next } satisfies StoredEntry, key);
  });
}

/** Explicit local removal also permits recovery from a corrupt record; it never alters issuer/onchain state. */
export async function removeCredentialVault(requestedScope: CredentialVaultScope): Promise<void> {
  const scope = normalizedScope(requestedScope);
  return transact(scope, 'readwrite', (_existing, store, key) => { store.delete(key); }, false);
}
