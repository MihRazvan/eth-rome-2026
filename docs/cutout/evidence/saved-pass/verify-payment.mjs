// Read-only replay of the recorded public payment. No wallet, credentials or signing.
// Run from the repository root: node docs/cutout/evidence/saved-pass/verify-payment.mjs
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createPublicClient, http, sha256, bytesToHex, decodeEventLog, parseAbi } from 'viem';
const expected = JSON.parse(await readFile(new URL('./finalized-payment.json', import.meta.url), 'utf8'));
const response = await fetch('https://cutout-ethrome-2026.vercel.app/api/config', { signal: AbortSignal.timeout(30000) });
assert.equal(response.status, 200);
const config = await response.json();
assert.equal(config.escrow.toLowerCase(), expected.escrow.toLowerCase());
assert.equal(config.token.toLowerCase(), expected.token.toLowerCase());
const client = createPublicClient({ transport: http(config.rpcUrl) });
assert.equal(await client.getChainId(), expected.chainId);
const block = await client.getBlock({ blockTag: 'finalized' });
const get = (functionName) => client.readContract({ address: config.escrow, abi: config.abi.QualificationEscrow, functionName, args: [BigInt(expected.taskId)], blockNumber: block.number });
const job = await get('jobs');
assert.equal(job[7], 3);
assert.equal(job[0].toLowerCase(), expected.client.toLowerCase());
assert.equal(job[1].toLowerCase(), expected.reviewer.toLowerCase());
assert.equal(String(job[2]), expected.rewardBaseUnits);
const receipts = await Promise.all(expected.transactions.map(t => client.getTransactionReceipt({ hash: t.hash })));
for (const [i, receipt] of receipts.entries()) {
  assert.equal(receipt.status, 'success');
  assert.ok(receipt.blockNumber <= block.number);
  assert.equal(receipt.blockHash, expected.transactions[i].blockHash);
}
const payment = receipts[expected.transactions.findIndex(t => t.action === 'approveAndPay')];
const transfers = payment.logs.filter(l => l.address.toLowerCase() === config.token.toLowerCase()).flatMap(log => {
  try { return [decodeEventLog({ abi: parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']), ...log })]; }
  catch { return []; }
});
assert.ok(transfers.some(t => t.args.from.toLowerCase() === config.escrow.toLowerCase() && t.args.to.toLowerCase() === expected.reviewer.toLowerCase() && String(t.args.value) === expected.rewardBaseUnits));
assert.equal(job[9].slice(2), expected.report.reference);
assert.equal(await get('documentDigests'), expected.report.digest);
const stored = await fetch(`https://api.gateway.ethswarm.org/bytes/${expected.report.reference}`, { signal: AbortSignal.timeout(30000) });
assert.equal(stored.status, 200, 'Recorded ciphertext is currently unavailable; historical payment is separate from storage retention');
const bytes = new Uint8Array(await stored.arrayBuffer());
assert.equal(sha256(bytesToHex(bytes)), expected.report.digest);
console.log(JSON.stringify({ date: new Date().toISOString(), taskId: expected.taskId, status: 'Paid', finalizedBlock: String(block.number), finalizedReceipts: receipts.length, paymentTransferBaseUnits: expected.rewardBaseUnits, publicCiphertextDigest: 'verified', writes: 0 }, null, 2));
