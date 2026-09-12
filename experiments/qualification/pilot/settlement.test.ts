import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForSettlement, waitForSettlementEvidence, SettlementError, type SettlementClient } from './settlement.js';
import { createPublicClient, http, type Hash, type TransactionReceipt } from 'viem';
const hash = `0x${'11'.repeat(32)}` as Hash;
const blockHash = `0x${'22'.repeat(32)}` as Hash;
const otherHash = `0x${'33'.repeat(32)}` as Hash;
const policy = { mode: 'fuji-finalized', chainId: 43113 } as const;
const receipt = { transactionHash: hash, blockHash, blockNumber: 10n, status: 'success' } as TransactionReceipt;
const hasCode = (code: string) => (error: unknown) => error instanceof SettlementError && error.code === code;
function fixture(overrides: Partial<SettlementClient> = {}): SettlementClient {
  return {
    getChainId: async () => 43113,
    waitForTransactionReceipt: async () => receipt,
    getTransactionReceipt: async () => receipt,
    getBlock: async args => ({ number: 'blockTag' in args ? 11n : args.blockNumber, hash: blockHash }),
    ...overrides,
  };
}
test('successful execution remains pending until Fuji finalized covers the receipt', async () => {
  let calls = 0; let reread = false;
  const result = await waitForSettlementEvidence(fixture({
    getBlock: async args => 'blockTag' in args ? { number: ++calls < 3 ? 9n : 12n, hash: otherHash } : { number: 10n, hash: blockHash },
    getTransactionReceipt: async () => { reread = true; assert.equal(calls, 3); return receipt; },
  }), hash, policy, { pollMs: 1 });
  assert.equal(reread, true); assert.equal(result.assurance, 'fuji-finalized');
  assert.deepEqual(result.reference, { blockNumber: 12n, blockHash: otherHash });
});
test('reverted execution fails before finalized polling', async () => {
  await assert.rejects(waitForSettlementEvidence(fixture({ waitForTransactionReceipt: async () => ({ ...receipt, status: 'reverted' }), getBlock: async () => { throw Error('Must not poll'); } }), hash, policy), hasCode('REVERTED'));
});
test('a stuck finalized head times out without reporting success', async () => {
  await assert.rejects(waitForSettlementEvidence(fixture({ getBlock: async () => ({ number: 9n, hash: blockHash }) }), hash, policy, { timeoutMs: 25, pollMs: 2 }), hasCode('TIMEOUT'));
});
test('unavailable or malformed finalized RPC never falls back to latest', async () => {
  for (const getBlock of [async () => { throw Error('Unsupported tag'); }, async () => ({ number: null, hash: null })])
    await assert.rejects(waitForSettlementEvidence(fixture({ getBlock }), hash, policy), error => error instanceof SettlementError && ['RPC_UNAVAILABLE','INCONSISTENT'].includes(error.code));
});
test('canonical hash mismatch and changed receipts fail closed', async () => {
  await assert.rejects(waitForSettlementEvidence(fixture({ getBlock: async args => ({ number: 'blockTag' in args ? 11n : 10n, hash: otherHash }) }), hash, policy), hasCode('INCONSISTENT'));
  await assert.rejects(waitForSettlementEvidence(fixture({ getTransactionReceipt: async () => ({ ...receipt, blockHash: otherHash }) }), hash, policy), hasCode('INCONSISTENT'));
});
test('wrong initial or changed RPC chain cannot produce settlement evidence', async () => {
  await assert.rejects(waitForSettlementEvidence(fixture({ getChainId: async () => 31338 }), hash, policy), hasCode('WRONG_CHAIN'));
  let calls = 0;
  await assert.rejects(waitForSettlementEvidence(fixture({ getChainId: async () => ++calls === 1 ? 43113 : 1 }), hash, policy), hasCode('WRONG_CHAIN'));
});
test('cancelled and semantically replaced transactions are not the requested payment', async () => {
  for (const reason of ['cancelled','replaced'] as const)
    await assert.rejects(waitForSettlementEvidence(fixture({ waitForTransactionReceipt: async args => { args.onReplaced({ reason, transactionReceipt: { ...receipt, transactionHash: otherHash } }); return { ...receipt, transactionHash: otherHash }; } }), hash, policy), hasCode('REPLACED'));
});
test('repricing retains intent and returns the replacement hash for evidence', async () => {
  const r = { ...receipt, transactionHash: otherHash };
  const result = await waitForSettlementEvidence(fixture({ waitForTransactionReceipt: async args => { args.onReplaced({ reason: 'repriced', transactionReceipt: r }); return r; }, getTransactionReceipt: async args => { assert.equal(args.hash, otherHash); return r; } }), hash, policy);
  assert.equal(result.requestedHash, hash); assert.equal(result.transactionHash, otherHash); assert.equal(result.repriced, true);
});
test('unreported receipt substitution is rejected', async () => {
  await assert.rejects(waitForSettlementEvidence(fixture({ waitForTransactionReceipt: async () => ({ ...receipt, transactionHash: otherHash }) }), hash, policy), hasCode('REPLACED'));
});
test('abort before and during a stalled RPC returns promptly without late success', async () => {
  const first = new AbortController(); first.abort();
  await assert.rejects(waitForSettlementEvidence(fixture(), hash, policy, { signal: first.signal }), hasCode('ABORTED'));
  const controller = new AbortController();
  const pending = waitForSettlementEvidence(fixture({ getBlock: async () => new Promise(() => {}) }), hash, policy, { signal: controller.signal, timeoutMs: 500 });
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(pending, hasCode('ABORTED'));
});
test('every RPC phase obeys the total deadline', async () => {
  await assert.rejects(waitForSettlementEvidence(fixture({ getChainId: async () => new Promise(() => {}) }), hash, policy, { timeoutMs: 15 }), hasCode('TIMEOUT'));
});
test('local receipt policy is explicit and cannot be applied to Fuji', async () => {
  const result = await waitForSettlementEvidence(fixture({ getChainId: async () => 31338, getBlock: async args => { assert.ok('blockNumber' in args); return { number: 10n, hash: blockHash }; } }), hash, { mode: 'local-receipt', chainId: 31338 });
  assert.equal(result.assurance, 'local-receipt');
  await assert.rejects(waitForSettlementEvidence(fixture(), hash, { mode: 'local-receipt', chainId: 43113 } as never), hasCode('WRONG_CHAIN'));
});

test('browser entrypoint accepts a real viem client shape and preserves receipt', async () => {
  const real: SettlementClient = createPublicClient({ transport: http('http://127.0.0.1:18547') });
  assert.equal(typeof real.getBlock, 'function'); // Type compatibility only; no RPC call.
  assert.equal(await waitForSettlement(fixture({ getChainId: async () => 31338 }), { hash, chainId: 31338 }), receipt);
  await assert.rejects(waitForSettlement(fixture(), { hash, chainId: 1 }), hasCode('WRONG_CHAIN'));
});
