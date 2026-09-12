// SPDX-License-Identifier: MIT
// Read-only recovery: no application server, wallet, storage login or private key.
import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, http } from "viem";
import { createSwarmStorage } from "./swarm-id.ts";
import { beeBytes } from "../transport/bytes.ts";

const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
if (
  !["--config", "--job", "--out"].every((name) => args.includes(name)) ||
  !/^[1-9][0-9]*$/.test(option("--job"))
)
  throw Error(
    "Use --config public-config.json --job ID --out encrypted-report.json [--gateway HTTPS_URL]",
  );
const config = JSON.parse(await readFile(option("--config"), "utf8"));
const client = createPublicClient({ transport: http(config.rpcUrl) });
const chainId = await client.getChainId();
if (chainId !== config.chainId || ![31338, 43113].includes(chainId))
  throw Error("Wrong settlement network");
if (
  chainId === 31338 &&
  (config.environment !== "local-pilot" ||
    new URL(config.rpcUrl).hostname !== "127.0.0.1")
)
  throw Error("Explicit loopback local pilot required");
const abi = JSON.parse(
  await readFile(
    "experiments/qualification/contracts/out/QualificationEscrow.sol/QualificationEscrow.json",
    "utf8",
  ),
).abi;
const block = await client.getBlock({
  blockTag: chainId === 43113 ? "finalized" : "latest",
});
const read = (functionName) =>
  client.readContract({
    address: config.escrow,
    abi,
    functionName,
    args: [BigInt(option("--job"))],
    blockNumber: block.number,
  });
const [job, digest] = await Promise.all([
  read("jobs"),
  read("documentDigests"),
]);
if (job[9] === `0x${"0".repeat(64)}`)
  throw Error("No report committed for this job");
const gateway = args.includes("--gateway")
  ? option("--gateway")
  : (config.swarm.retrievalUrl ?? config.swarm.downloadUrl);
const storage =
  chainId === 43113
    ? createSwarmStorage({ gatewayUrl: gateway })
    : beeBytes({
        ...config.swarm,
        downloadUrl: gateway,
        environment: "local-bee",
      });
const bytes = await storage.download({
  reference: job[9].slice(2),
  sha256: digest,
});
const result = {
  format: "review-pass-export",
  version: 1,
  chainId,
  escrow: config.escrow,
  jobId: option("--job"),
  envelope: JSON.parse(new TextDecoder().decode(bytes)),
  digest,
  reference: job[9],
  verifiedAt: { blockNumber: String(block.number), blockHash: block.hash },
};
await writeFile(option("--out"), JSON.stringify(result, null, 2) + "\n", {
  flag: "wx",
  mode: 0o600,
});
console.log(
  JSON.stringify({
    status: "VERIFIED_CIPHERTEXT_EXPORTED",
    chainId,
    jobId: result.jobId,
    digest,
    reference: result.reference,
  }),
);
