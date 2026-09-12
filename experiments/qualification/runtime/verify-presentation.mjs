// SPDX-License-Identifier: MIT
// Independent client-side verification process: reads public presentation and chain state only.
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import assert from "node:assert/strict";
import { createPublicClient, http, parseAbi } from "viem";
const { values } = parseArgs({
  options: {
    rpc: { type: "string" },
    escrow: { type: "string" },
    job: { type: "string" },
    proof: { type: "string" },
  },
});
for (const name of ["rpc", "escrow", "job", "proof"])
  assert.ok(values[name], `--${name} required`);
const client = createPublicClient({ transport: http(values.rpc) });
const abi = parseAbi([
  "function issuerX() view returns(uint256)",
  "function issuerY() view returns(uint256)",
  "function revocationRoot() view returns(uint256)",
  "function verifier() view returns(address)",
  "function contextFor(uint256) view returns(uint256)",
  "function consumedNullifiers(uint256) view returns(bool)",
  "function jobs(uint256) view returns(address client,address worker,uint256 amount,uint256 qualificationClass,uint64 acceptBefore,uint64 submitBefore,uint64 reviewBefore,uint8 status,bytes32 terms,bytes32 deliverable)",
  "function verifyProof(bytes,uint256[9]) view",
]);
// Pin all reads to one block; acceptance rechecks authoritative state in its own transaction.
const block = await client.getBlock();
const read = (functionName, args = [], address = values.escrow) =>
  client.readContract({
    address,
    abi,
    functionName,
    args,
    blockNumber: block.number,
  });
const proof = JSON.parse(await readFile(values.proof, "utf8"));
assert.equal(proof.publicInputs.length, 9);
const inputs = proof.publicInputs.map(BigInt);
const [x, y, root, context, verifier, job, consumed] = await Promise.all([
  read("issuerX"),
  read("issuerY"),
  read("revocationRoot"),
  read("contextFor", [BigInt(values.job)]),
  read("verifier"),
  read("jobs", [BigInt(values.job)]),
  read("consumedNullifiers", [inputs[7]]),
]);
assert.equal(job[7], 0, "Assignment must be open");
assert.equal(consumed, false);
assert.deepEqual(inputs.slice(0, 4), [x, y, root, job[3]]);
assert.ok(
  block.timestamp < job[4] &&
    block.timestamp <= inputs[4] &&
    inputs[4] <= job[4],
);
assert.equal(inputs[5], context);
assert.ok(inputs[6] > 0n && inputs[6] < 2n ** 160n);
await read("verifyProof", [proof.proof, inputs], verifier);
console.log(
  JSON.stringify({
    valid: true,
    atBlock: String(block.number),
    chainId: await client.getChainId(),
    escrow: values.escrow,
    job: values.job,
    statement:
      "Issuer-authenticated, unexpired, nonrevoked qualification for this assignment and recipient",
    limitation:
      "Read-only verification at this block; acceptance transaction must recheck state",
  }),
);
