// SPDX-License-Identifier: MIT
// --prepare writes only local public setup/build artifacts. --broadcast requires
// explicit funded project access and a verified PUBLIC Swarm snapshot.
import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  access,
  open,
} from "node:fs/promises";
import { unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import { waitForSettlement } from "./settlement.ts";
import { createSwarmStorage } from "./swarm-id.ts";
const exec = promisify(execFile);
const root = process.cwd(),
  dir = resolve(root, ".runtime/review-pass-fuji");
const broadcast = process.argv.includes("--broadcast");
if (
  process.argv.slice(2).length !== 1 ||
  !["--prepare", "--broadcast"].includes(process.argv[2])
)
  throw Error(
    "Choose --prepare (local artifacts only) or --broadcast (authorized Fuji writes)",
  );
const readJSON = async (path) => JSON.parse(await readFile(path, "utf8"));
const hashFile = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch (e) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
};
const json = (value) =>
  JSON.stringify(value, (_, v) => (typeof v === "bigint" ? String(v) : v), 2) +
  "\n";
const token = "0x5425890298aed601595a70AB815c96711a31Bc65";
const rpcUrl =
  process.env.FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc";
const endpoint = new URL(rpcUrl);
if (
  endpoint.protocol !== "https:" ||
  endpoint.username ||
  endpoint.password ||
  endpoint.search
)
  throw Error("Use an HTTPS public Fuji RPC without embedded credentials");
const client = createPublicClient({
  chain: avalancheFuji,
  transport: http(rpcUrl),
});
if ((await client.getChainId()) !== 43113)
  throw Error("Fuji43113 required; no local or mainnet fallback");
const tokenABI = [
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
];
if (
  !(await client.getCode({ address: token })) ||
  (await client.readContract({
    address: token,
    abi: tokenABI,
    functionName: "decimals",
  })) !== 6
)
  throw Error("Canonical Fuji test USDC metadata unavailable");
await mkdir(resolve(dir, "contracts/src"), { recursive: true });
const lockPath = resolve(dir, "operation.lock");
const lock = await open(lockPath, "wx", 0o600);
await lock.writeFile(String(process.pid));
await lock.close();
process.once("exit", () => {
  try {
    unlinkSync(lockPath);
  } catch {}
});
const setupNames = [
  "proving.key",
  "verifying.key",
  "circuit.r1cs",
  "setup.json",
];
const hashSetup = async () =>
  Object.fromEntries(
    await Promise.all(
      setupNames.map(async (name) => [
        name,
        await hashFile(resolve(dir, "setup", name)),
      ]),
    ),
  );
const circuitHashes = Object.fromEntries(
  await Promise.all(
    ["circuit.go", "credential.go", "go.mod", "go.sum"].map(async (name) => [
      name,
      await hashFile(resolve(root, "experiments/qualification/prover", name)),
    ]),
  ),
);

const prover = resolve(dir, "qualification-prover");
await exec("go", ["build", "-o", prover, "."], {
  cwd: resolve(root, "experiments/qualification/prover"),
});
const setup = resolve(dir, "setup"),
  verifierSource = resolve(dir, "contracts/src/PublicVerifier.sol");
if (!(await exists(resolve(dir, "prepared.json")))) {
  if (await exists(setup))
    throw Error(
      "Incomplete preparation exists. Inspect it; do not silently regenerate an existing verifier setup",
    );
  await exec(prover, ["setup", "--dir", setup, "--verifier", verifierSource]);
  await writeFile(
    resolve(dir, "prepared.json"),
    json({
      testSetup: true,
      sourceRevision: (await exec("git", ["rev-parse", "HEAD"])).stdout.trim(),
      verifierSourceSha256: await hashFile(verifierSource),
      setupHashes: await hashSetup(),
      circuitHashes,
      setup: await readJSON(resolve(setup, "setup.json")),
    }),
  );
}
const prepared = await readJSON(resolve(dir, "prepared.json"));
if (prepared.verifierSourceSha256 !== (await hashFile(verifierSource)))
  throw Error("Prepared verifier source changed");
const setupHashes = await hashSetup();
for (const [name, hash] of Object.entries(setupHashes))
  if (prepared.setupHashes?.[name] !== hash)
    throw Error(`Prepared setup integrity mismatch: ${name}`);
for (const [name, hash] of Object.entries(circuitHashes))
  if (prepared.circuitHashes?.[name] !== hash)
    throw Error(`Prepared circuit provenance mismatch: ${name}`);
for (const name of ["QualificationEscrow", "QualificationKeys"])
  await copyFile(
    resolve(root, `experiments/qualification/contracts/src/${name}.sol`),
    resolve(dir, `contracts/src/${name}.sol`),
  );
await writeFile(
  resolve(dir, "contracts/foundry.toml"),
  '[profile.default]\nsrc="src"\nout="out"\nsolc_version="0.8.30"\nevm_version="cancun"\noptimizer=true\noptimizer_runs=200\n',
);
await exec("forge", [
  "build",
  "--root",
  resolve(dir, "contracts"),
  "--remappings",
  `@openzeppelin/contracts/=${resolve(root, "node_modules/@openzeppelin/contracts")}/`,
]);
// Produce matching app/recovery ABIs in a fresh checkout as well.
await exec("forge", [
  "build",
  "--root",
  resolve(root, "experiments/qualification/contracts"),
]);
const artifacts = {
  verifier: await readJSON(
    resolve(dir, "contracts/out/PublicVerifier.sol/Verifier.json"),
  ),
  keyRegistry: await readJSON(
    resolve(dir, "contracts/out/QualificationKeys.sol/QualificationKeys.json"),
  ),
  escrow: await readJSON(
    resolve(
      dir,
      "contracts/out/QualificationEscrow.sol/QualificationEscrow.json",
    ),
  ),
};
const sourceHashes = Object.fromEntries(
  await Promise.all(
    ["QualificationEscrow", "QualificationKeys"].map(async (name) => [
      name,
      await hashFile(resolve(dir, `contracts/src/${name}.sol`)),
    ]),
  ),
);
const intent = {
  version: 1,
  chainId: 43113,
  token,
  tokenDecimals: 6,
  testOnly: true,
  sourceRevision: (await exec("git", ["rev-parse", "HEAD"])).stdout.trim(),
  setupTrust:
    "Single-process experimental Groth16 setup; no production ceremony",
  setupHashes,
  circuitHashes,
  sourceHashes,
  sourceDirty: Boolean(
    (
      await exec("git", [
        "status",
        "--porcelain",
        "--",
        "experiments/qualification",
      ])
    ).stdout.trim(),
  ),
  verifierSourceSha256: prepared.verifierSourceSha256,
  bytecodeHashes: Object.fromEntries(
    Object.entries(artifacts).map(([key, a]) => [
      key,
      keccak256(a.bytecode.object),
    ]),
  ),
  requiredForBroadcast: [
    "FUJI_PRIVATE_KEY",
    "QUALIFICATION_ISSUER_PUBLIC",
    "QUALIFICATION_SNAPSHOT_FILE",
    "QUALIFICATION_SNAPSHOT_REFERENCE",
    "QUALIFICATION_ARBITRATOR",
  ],
};
await writeFile(resolve(dir, "intent.json"), json(intent));
if (!broadcast) {
  console.log(
    json({
      status: "PREPARED_NOT_DEPLOYED",
      intent: resolve(dir, "intent.json"),
      publicSetup: setup,
      chainId: 43113,
      token,
    }),
  );
  process.exit(0);
}
for (const key of intent.requiredForBroadcast)
  if (!process.env[key])
    throw Error(`Missing required project configuration: ${key}`);
if (
  (await exists(resolve(dir, "deployment.json"))) ||
  (await exists(resolve(dir, "broadcast-started.json")))
)
  throw Error(
    "Existing or partial deployment recorded; inspect transaction journal instead of blindly resending",
  );
const validated = JSON.parse(
  (
    await exec(prover, [
      "validate-public",
      "--issuer-public",
      process.env.QUALIFICATION_ISSUER_PUBLIC,
      "--snapshot",
      process.env.QUALIFICATION_SNAPSHOT_FILE,
    ])
  ).stdout,
);
if (validated.status !== "VALID_PUBLIC_METADATA")
  throw Error("Public metadata validation failed");
const issuer = { issuerX: validated.issuerX, issuerY: validated.issuerY };
const snapshot = { root: validated.root };
const snapshotBytes = new Uint8Array(
  await readFile(process.env.QUALIFICATION_SNAPSHOT_FILE),
);
if (
  createHash("sha256").update(snapshotBytes).digest("hex") !==
  validated.snapshotSha256
)
  throw Error("Public snapshot changed after validation");
const arbitrator = process.env.QUALIFICATION_ARBITRATOR;
if (!isAddress(arbitrator) || BigInt(arbitrator) === 0n)
  throw Error("Nonzero intended arbitrator address required");
const snapshotRef = {
  reference: process.env.QUALIFICATION_SNAPSHOT_REFERENCE,
  sha256: `0x${createHash("sha256").update(snapshotBytes).digest("hex")}`,
};
const gatewayUrl =
  process.env.SWARM_RETRIEVAL_URL ?? "https://gateway.ethswarm.org";
await createSwarmStorage({ gatewayUrl }).download(snapshotRef);
if (!/^0x[0-9a-f]{64}$/i.test(process.env.FUJI_PRIVATE_KEY))
  throw Error("Configured Fuji signer key has invalid encoding");
let account;
try {
  account = privateKeyToAccount(process.env.FUJI_PRIVATE_KEY);
} catch {
  throw Error("Configured Fuji signer key is invalid");
}
if (
  (await client.getBalance({
    address: account.address,
    blockTag: "finalized",
  })) === 0n
)
  throw Error("Configured project signer has no settled test AVAX");
const wallet = createWalletClient({
  account,
  chain: avalancheFuji,
  transport: http(rpcUrl),
});
const journal = { chainId: 43113, signer: account.address, transactions: [] };
await writeFile(resolve(dir, "broadcast-started.json"), json(journal), {
  flag: "wx",
  mode: 0o600,
});
async function deploy(name, args = []) {
  const a = artifacts[name];
  const hash = await wallet.deployContract({
    abi: a.abi,
    bytecode: a.bytecode.object,
    args,
  });
  journal.transactions.push({ name, hash });
  await writeFile(resolve(dir, "broadcast-started.json"), json(journal));
  const receipt = await waitForSettlement(client, { hash, chainId: 43113 });
  if (!receipt.contractAddress)
    throw Error("Deployment receipt has no contract address");
  journal.transactions.at(-1).receipt = {
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
    contractAddress: receipt.contractAddress,
    status: receipt.status,
  };
  await writeFile(resolve(dir, "broadcast-started.json"), json(journal));
  return receipt.contractAddress;
}
const verifier = await deploy("verifier"),
  keyRegistry = await deploy("keyRegistry");
const escrow = await deploy("escrow", [
  token,
  verifier,
  BigInt(issuer.issuerX),
  BigInt(issuer.issuerY),
  BigInt(snapshot.root),
  arbitrator,
]);
const runtimeCodeHashes = {};
for (const [name, address] of Object.entries({
  verifier,
  keyRegistry,
  escrow,
})) {
  const code = await client.getCode({ address, blockTag: "finalized" });
  if (!code || code === "0x")
    throw Error(`Deployed ${name} code unavailable in settled state`);
  runtimeCodeHashes[name] = keccak256(code);
}
for (const [name, expected] of Object.entries({
  token,
  verifier,
  issuer: account.address,
  arbitrator,
  issuerX: issuer.issuerX,
  issuerY: issuer.issuerY,
  revocationRoot: snapshot.root,
})) {
  const actual = await client.readContract({
    address: escrow,
    abi: artifacts.escrow.abi,
    functionName: name,
    blockTag: "finalized",
  });
  if (String(actual).toLowerCase() !== String(expected).toLowerCase())
    throw Error(`Deployed escrow ${name} differs from intended value`);
}
const manifest = {
  ...intent,
  runtimeCodeHashes,
  environment: "fuji-testnet",
  rpcUrl,
  escrow,
  verifier,
  keyRegistry,
  deploymentBlock: journal.transactions[0].receipt.blockNumber,
  issuer: account.address,
  arbitrator,
  snapshot: snapshotRef,
  storageMode: "swarm-id",
  setupDir: setup,
  swarm: { retrievalUrl: gatewayUrl },
  arkiv: {
    rpcUrl: "https://rpc.tiramisu.db-chain.testnet.arkiv.network",
    wsUrl: "wss://rpc.tiramisu.db-chain.testnet.arkiv.network",
  },
  transactions: journal.transactions,
};
await writeFile(resolve(dir, "deployment.json"), json(manifest));
console.log(
  json({
    status: "DEPLOYED_ON_FUJI",
    escrow,
    verifier,
    keyRegistry,
    manifest: resolve(dir, "deployment.json"),
  }),
);
