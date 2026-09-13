import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import {
  loadCredentialVault, saveCredentialVault, removeCredentialVault, MAX_CREDENTIAL_VAULT_BYTES,
  type CredentialVaultScope, type CredentialVaultEntry,
} from './credential-vault.js';

const scope: CredentialVaultScope = { chainId: 43113, escrow: `0x${'ab'.repeat(20)}`,
  wallet: `0x${'cd'.repeat(20)}`, issuerX: '11', issuerY: '12' };
const holder = { version: 'qualification-v1-test' as const, testOnly: true as const,
  holderCommitment: '123', holderSecret: '456' };
const credential = { version: holder.version, testOnly: holder.testOnly, holderCommitment: holder.holderCommitment,
  signature: 'ab'.repeat(64), issuerX: scope.issuerX, issuerY: scope.issuerY, index: 8, class: 7, expiry: 1000 };
const pair: CredentialVaultEntry = { holder, credential };
beforeEach(() => { globalThis.indexedDB = new IDBFactory(); });

test('reload returns a fresh structured clone of holder, credential and private pending state', async () => {
  const value = { ...pair, pending: { request: { holderCommitment: holder.holderCommitment },
    replyKey: { d: 'private-reply-key', kty: 'EC' }, status: 'waiting', attempts: [1, 2] } };
  await saveCredentialVault(scope, value);
  const loaded = await loadCredentialVault(scope);
  assert.deepEqual(loaded, value);
  assert.notEqual(loaded!.holder, value.holder);
  loaded!.holder.holderSecret = '999';
  loaded!.pending!.status = 'changed';
  assert.deepEqual(await loadCredentialVault(scope), value);
  // Expiry is deliberately retained for renewal; task validation still rejects it when proving.
  assert.equal(loaded!.credential!.expiry, 1000);
});

test('deployment chain, escrow, issuer and wallet each isolate secrets; address case is normalized', async () => {
  await saveCredentialVault(scope, pair);
  for (const alternate of [{ ...scope, chainId: 1 }, { ...scope, escrow: `0x${'ef'.repeat(20)}` },
    { ...scope, issuerX: '13' }, { ...scope, issuerY: '14' }, { ...scope, wallet: `0x${'ef'.repeat(20)}` }]) {
    assert.equal(await loadCredentialVault(alternate), undefined);
    await removeCredentialVault(alternate);
  }
  assert.deepEqual(await loadCredentialVault({ ...scope, wallet: scope.wallet.toUpperCase(), escrow: scope.escrow.toUpperCase() }), pair);
  globalThis.indexedDB = new IDBFactory(); // Distinct origin/profile database factory.
  assert.equal(await loadCredentialVault(scope), undefined);
});

test('pending holder becomes an issued pair atomically and omission removes completed pending state', async () => {
  await saveCredentialVault(scope, { holder, pending: { request: { holderCommitment: '123' }, replyKey: 'secret' } });
  await saveCredentialVault(scope, pair);
  assert.deepEqual(await loadCredentialVault(scope), pair);
  await saveCredentialVault(scope, structuredClone(pair)); // Idempotent save.
  assert.deepEqual(await loadCredentialVault(scope), pair);
});

test('mismatched pairs, invalid shape and wrong issuer are rejected without replacing valid state', async () => {
  await saveCredentialVault(scope, pair);
  const invalid: unknown[] = [null, {}, { ...pair, holder: { ...holder, holderCommitment: '124' } },
    { ...pair, credential: { ...credential, signature: '' } },
    { ...pair, credential: { ...credential, issuerX: '15' } },
    { ...pair, holder: { ...holder, holderSecret: '0' } }, { ...pair, pending: [] }];
  for (const value of invalid) {
    await assert.rejects(saveCredentialVault(scope, value as CredentialVaultEntry, { replace: true }));
    assert.deepEqual(await loadCredentialVault(scope), pair);
  }
});

test('different holder, renewed credential and implicit credential deletion require explicit replace', async () => {
  await saveCredentialVault(scope, pair);
  for (const next of [{ holder: { ...holder, holderSecret: '457' }, credential },
    { holder, credential: { ...credential, expiry: 2000 } }, { holder }]) {
    await assert.rejects(saveCredentialVault(scope, next), /Explicitly replace/);
    assert.deepEqual(await loadCredentialVault(scope), pair);
  }
  const renewed = { holder, credential: { ...credential, expiry: 2000 } };
  await saveCredentialVault(scope, renewed, { replace: true });
  assert.deepEqual(await loadCredentialVault(scope), renewed);
  await removeCredentialVault(scope);
  assert.equal(await loadCredentialVault(scope), undefined);
  await removeCredentialVault(scope); // Idempotent explicit removal.
});

test('concurrent conflicting first saves serialize without overwriting a holder', async () => {
  const other = { holder: { ...holder, holderSecret: '457', holderCommitment: '124' } };
  const outcomes = await Promise.allSettled([saveCredentialVault(scope, { holder }), saveCredentialVault(scope, other)]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1);
  assert.deepEqual(await loadCredentialVault(scope), { holder });
});

test('caller mutation during IndexedDB open cannot change stored inputs or namespace', async () => {
  const value = structuredClone(pair), context = { ...scope };
  const saving = saveCredentialVault(context, value);
  value.holder.holderSecret = '999';
  context.wallet = `0x${'ef'.repeat(20)}`;
  await saving;
  assert.deepEqual(await loadCredentialVault(scope), pair);
  assert.equal(await loadCredentialVault(context), undefined);
});

test('aborted writes preserve the whole previous record and reject instead of reporting success', async () => {
  const before = { holder, pending: { replyKey: 'keep-this-secret', status: 'waiting' } };
  await saveCredentialVault(scope, before);
  const original = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
    const request = original.apply(this, args);
    this.transaction.abort();
    return request;
  };
  try { await assert.rejects(saveCredentialVault(scope, pair), /storage failed/); }
  finally { IDBObjectStore.prototype.put = original; }
  assert.deepEqual(await loadCredentialVault(scope), before);
});

test('bounded JSON rejects cyclic/oversized data and getters without invoking them', async () => {
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  let called = false;
  const getter = Object.defineProperty({}, 'secret', { enumerable: true, get() { called = true; return 'secret'; } });
  for (const pending of [cycle, getter, { big: 'x'.repeat(MAX_CREDENTIAL_VAULT_BYTES) }, { date: new Date() }])
    await assert.rejects(saveCredentialVault(scope, { holder, pending } as CredentialVaultEntry));
  assert.equal(called, false);
  assert.equal(await loadCredentialVault(scope), undefined);
});

test('storage failures are sanitized, make no network requests and never log private data', async () => {
  const originalPut = IDBObjectStore.prototype.put;
  const originals = { log: console.log, error: console.error, warn: console.warn, fetch: globalThis.fetch };
  const calls: unknown[] = [];
  console.log = console.error = console.warn = (...args: unknown[]) => { calls.push(args); };
  globalThis.fetch = (() => { calls.push('network'); throw Error('unexpected network'); }) as typeof fetch;
  IDBObjectStore.prototype.put = function () { throw Error(`leaked holder ${holder.holderSecret} private-reply-key`); };
  try {
    await assert.rejects(saveCredentialVault(scope, pair), error => {
      assert.equal((error as Error).message.includes(holder.holderSecret), false);
      assert.equal((error as Error).message.includes('private-reply-key'), false);
      return /storage failed/.test((error as Error).message);
    });
    assert.deepEqual(calls, []);
  } finally {
    IDBObjectStore.prototype.put = originalPut;
    console.log = originals.log; console.error = originals.error; console.warn = originals.warn; globalThis.fetch = originals.fetch;
  }
  assert.equal(await loadCredentialVault(scope), undefined);
});

test('unavailable IndexedDB fails without a volatile fallback', async () => {
  const factory = globalThis.indexedDB;
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, writable: true, value: undefined });
  try {
    await assert.rejects(saveCredentialVault(scope, pair), /unavailable/);
    await assert.rejects(loadCredentialVault(scope), /unavailable/);
  } finally { globalThis.indexedDB = factory; }
  assert.equal(await loadCredentialVault(scope), undefined);
});

test('corrupt stored records fail closed and can only be cleared explicitly', async () => {
  await saveCredentialVault(scope, pair);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('cutout-credential-vault-v1', 1);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('credentials', 'readwrite');
      tx.objectStore('credentials').put({ version: 1, scope: { ...scope, wallet: `0x${'ef'.repeat(20)}` }, value: pair }, JSON.stringify({ chainId: scope.chainId, escrow: scope.escrow, issuerX: scope.issuerX, issuerY: scope.issuerY, wallet: scope.wallet }));
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
  await assert.rejects(loadCredentialVault(scope), /context is corrupt/);
  await assert.rejects(saveCredentialVault(scope, pair), /context is corrupt/);
  await removeCredentialVault(scope);
  await saveCredentialVault(scope, pair);
  assert.deepEqual(await loadCredentialVault(scope), pair);
});
