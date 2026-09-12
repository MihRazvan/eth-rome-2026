// SPDX-License-Identifier: MIT
// Uses PUBLIC Anvil test accounts only, with a strict local-chain guard.
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  sha256,
  bytesToHex,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { beeBytes } from "../transport/bytes.ts";
const exec = promisify(execFile);
const dir =
  process.env.QUALIFICATION_PILOT_DIR ?? ".runtime/qualification-pilot";
await mkdir(dir, { recursive: true });
const source = JSON.parse(
  await readFile(".runtime/qualification/deployment.json", "utf8"),
);
const chain = defineChain({
  id: 31338,
  name: "Review Pass local pilot",
  nativeCurrency: { name: "Test Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:18547"] } },
});
const read = createPublicClient({ chain, transport: http() });
if ((await read.getChainId()) !== 31338)
  throw Error("Local Anvil31338 required; no public account fallback");
const account = mnemonicToAccount(
  "test test test test test test test test test test test junk",
);
const wallet = createWalletClient({ account, chain, transport: http() });
await exec("forge", ["build", "--root", "experiments/qualification/contracts"]);
const artifact = async (n) =>
  JSON.parse(
    await readFile(
      `experiments/qualification/contracts/out/${n}.sol/${n}.json`,
      "utf8",
    ),
  );
const prover = `${process.cwd()}/${dir}/prover`;
await exec("go", ["build", "-o", prover, "."], {
  cwd: "experiments/qualification/prover",
});
const issuerDir = `${dir}/issuer`,
  holderDir = `${dir}/holder`;
await mkdir(holderDir, { recursive: true, mode: 0o700 });
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (e) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
}
if (!(await exists(issuerDir)))
  await exec(prover, ["registry", "init", "--dir", issuerDir]);
if (!(await exists(`${holderDir}/holder.json`)))
  await exec(prover, ["holder-new", "--out", `${holderDir}/holder.json`]);
const holder = JSON.parse(await readFile(`${holderDir}/holder.json`, "utf8"));
const credentialPath = `${holderDir}/credential-${Date.now()}.json`;
await exec(prover, [
  "registry",
  "issue",
  "--dir",
  issuerDir,
  "--commitment",
  holder.holderCommitment,
  "--class",
  "7",
  "--expiry",
  String(Math.floor(Date.now() / 1000) + 86400),
  "--out",
  credentialPath,
]);
await writeFile(
  `${holderDir}/latest.json`,
  JSON.stringify({
    credential: credentialPath,
    holder: `${holderDir}/holder.json`,
  }) + "\n",
  { mode: 0o600 },
);
await exec(prover, [
  "registry",
  "snapshot",
  "--dir",
  issuerDir,
  "--out",
  `${holderDir}/snapshot.json`,
]);
const issuerPublic = JSON.parse(
  await readFile(`${issuerDir}/issuer-public.json`, "utf8"),
);
const snapshot = JSON.parse(
  await readFile(`${holderDir}/snapshot.json`, "utf8"),
);
const arbitrator = mnemonicToAccount(
  "test test test test test test test test test test test junk",
  { addressIndex: 4 },
).address;
async function deploy(name, args = []) {
  const a = await artifact(name);
  const hash = await wallet.deployContract({
    abi: a.abi,
    bytecode: a.bytecode.object,
    args,
  });
  const r = await read.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw Error("Deployment failed");
  return r.contractAddress;
}
const keyRegistry = await deploy("QualificationKeys");
const escrow = await deploy("QualificationEscrow", [
  source.token,
  source.verifier,
  BigInt(issuerPublic.issuerX),
  BigInt(issuerPublic.issuerY),
  BigInt(snapshot.root),
  arbitrator,
]);
const stack = JSON.parse(
  await readFile(
    "experiments/qualification/transport/local-stack.json",
    "utf8",
  ),
);
const config = {
  version: 1,
  setupDir: `${process.cwd()}/.runtime/qualification/setup`,
  setupHashes: Object.fromEntries(
    await Promise.all(
      ["circuit.r1cs", "proving.key", "verifying.key"].map(async (name) => [
        name,
        sha256(
          bytesToHex(await readFile(`.runtime/qualification/setup/${name}`)),
        ),
      ]),
    ),
  ),
  environment: "local-pilot",
  testOnly: true,
  chainId: 31338,
  rpcUrl: chain.rpcUrls.default.http[0],
  escrow,
  keyRegistry,
  token: source.token,
  verifier: source.verifier,
  issuer: account.address,
  arbitrator: arbitrator,
  snapshot: null,
  swarm: {
    environment: "local-bee",
    uploadUrl: "http://127.0.0.1:1633",
    downloadUrl: "http://127.0.0.1:1635",
    postageBatchId:
      process.env.QUALIFICATION_LOCAL_POSTAGE ?? stack.localPostage.batchID,
  },
};
config.snapshot = await beeBytes(config.swarm).upload(
  new Uint8Array(await readFile(`${holderDir}/snapshot.json`)),
);
await writeFile(`${dir}/config.json`, JSON.stringify(config, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      environment: config.environment,
      escrow,
      keyRegistry,
      config: `${dir}/config.json`,
    },
    null,
    2,
  ),
);
