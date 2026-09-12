// SPDX-License-Identifier: MIT
// Replays only the public proof. No holder, issuer, wallet, or credential files.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPublicClient, http, parseAbi, keccak256 } from 'viem';
const result = JSON.parse(await readFile(new URL('./result.json', import.meta.url), 'utf8'));
const proof = JSON.parse(await readFile(new URL('./public-proof.json', import.meta.url), 'utf8'));
const client = createPublicClient({ transport: http(result.rpcUrl) });
assert.equal(await client.getChainId(), result.chainId);
const blockNumber = BigInt(result.block.number);
const block = await client.getBlock({ blockNumber });
assert.equal(block.hash, result.block.hash);
const code = await client.getCode({ address: result.verifier, blockNumber });
assert.equal(keccak256(code), result.verifierRuntimeCodeHash);
const abi = parseAbi(['function verifyProof(bytes proof, uint256[9] input) view']);
await client.readContract({ address: result.verifier, abi, functionName: 'verifyProof', args: [proof.proof, proof.publicInputs.map(BigInt)], blockNumber });
await assert.rejects(client.readContract({ address: result.verifier, abi, functionName: 'verifyProof', args: [proof.proof, proof.publicInputs.map((value, index) => BigInt(value) + (index === 6 ? 1n : 0n))], blockNumber }));
console.log(JSON.stringify({ verified: true, alteredRecipientRejected: true, chainId: result.chainId, verifier: result.verifier, block: result.block.number, transactionsSent: 0, scope: 'Public cryptographic proof replay; synthetic unfunded assignment' }));
