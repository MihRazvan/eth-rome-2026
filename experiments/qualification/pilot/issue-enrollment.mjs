// Operator-only issuance into the existing private registry. No server signing endpoint.
// Run with node --import tsx; takes ONLY the public request, never a holder backup.
import { readFile, stat, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createPublicClient, http } from "viem";
import { parseEnrollmentRequest } from "./enrollment-request.ts";
const args = process.argv.slice(2),
  flags = {};
for (let i = 0; i < args.length; i += 2) {
  if (
    !["--request", "--out", "--config", "--registry"].includes(args[i]) ||
    !args[i + 1] ||
    flags[args[i]]
  )
    throw Error(
      "Use --request <public request.json> --out <private credential.json> [--config <manifest>] [--registry <existing registry>]",
    );
  flags[args[i]] = args[i + 1];
}
if (!flags["--request"] || !flags["--out"])
  throw Error(
    "A public enrollment request and new private output path are required",
  );
const requestPath = resolve(flags["--request"]),
  out = resolve(flags["--out"]);
if ((await stat(requestPath)).size > 16384)
  throw Error("Enrollment request exceeds size limit");
const request = parseEnrollmentRequest(
  JSON.parse(await readFile(requestPath, "utf8")),
);
const config = JSON.parse(
  await readFile(
    flags["--config"] ?? ".runtime/review-pass-fuji/deployment.json",
    "utf8",
  ),
);
if (
  config.chainId !== 43113 ||
  config.testOnly !== true ||
  config.rpcUrl !== "https://api.avax-test.network/ext/bc/C/rpc" ||
  request.escrow !== config.escrow.toLowerCase() ||
  request.issuer !== config.issuer.toLowerCase()
)
  throw Error("Request does not target the configured Fuji test issuer");
try {
  await stat(out);
  throw Error(
    "Credential output already exists; issuance will not overwrite it",
  );
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const registry = resolve(
  flags["--registry"] ?? ".runtime/review-pass-fuji/issuer",
);
try { await stat(resolve(registry, "MIGRATED")); throw Error("Issuer allocation moved to its hosted persistent service; this local copy is read-only."); } catch(e) { if(e.code!=="ENOENT") throw e; }
const publicIssuer = JSON.parse(
  await readFile(resolve(registry, "issuer-public.json"), "utf8"),
);
const abi = JSON.parse(
  await readFile(
    "experiments/qualification/contracts/out/QualificationEscrow.sol/QualificationEscrow.json",
    "utf8",
  ),
).abi;
const chain = createPublicClient({
  transport: http(config.rpcUrl, { timeout: 15000, retryCount: 0 }),
});
if ((await chain.getChainId()) !== 43113) throw Error("Wrong issuer chain");
const block = await chain.getBlock({ blockTag: "finalized" });
if (
  request.createdAt > Number(block.timestamp) + 60 ||
  request.createdAt < Number(block.timestamp) - 7 * 86400
)
  throw Error("Enrollment request is stale or future-dated");
for (const field of ["issuerX", "issuerY"]) {
  const value = await chain.readContract({
    address: config.escrow,
    abi,
    functionName: field,
    blockNumber: block.number,
  });
  if (String(value) !== publicIssuer[field])
    throw Error("Registry public key differs from the deployed issuer");
}
const authority = await chain.readContract({
  address: config.escrow,
  abi,
  functionName: "issuer",
  blockNumber: block.number,
});
if (authority.toLowerCase() !== request.issuer)
  throw Error("Issuer authority differs");
const expiry = Number(block.timestamp) + 86400;
await mkdir(dirname(out), { recursive: true, mode: 0o700 });
try {
  await promisify(execFile)(
    "go",
    [
      "run",
      ".",
      "registry",
      "issue",
      "--dir",
      registry,
      "--commitment",
      request.holderCommitment,
      "--class",
      "7",
      "--expiry",
      String(expiry),
      "--out",
      out,
    ],
    { cwd: resolve("experiments/qualification/prover"), maxBuffer: 65536 },
  );
} catch {
  throw Error(
    "Issuer command did not complete. Inspect the private registry/output before retrying; a slot may have been reserved.",
  );
}
console.log(
  JSON.stringify({
    status: "issued-test-credential",
    qualificationClass: 7,
    expiresAt: expiry,
    chainId: 43113,
    escrow: request.escrow,
    scope:
      "Signed credential written to the requested private output. No holder secret received; no root update or chain write. Deliver the file only to its intended holder.",
  }),
);
