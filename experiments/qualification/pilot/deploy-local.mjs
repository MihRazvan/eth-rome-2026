// SPDX-License-Identifier: MIT
// Uses PUBLIC Anvil test accounts only, with a strict local-chain guard.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
const exec = promisify(execFile);
const dir = ".runtime/qualification-pilot";
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
const publicState = await fetch("http://127.0.0.1:18787/api/state").then(
  (r) => {
    if (!r.ok) throw Error("Original local workbench unavailable");
    return r.json();
  },
);
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
const escrowArtifact = await artifact("QualificationEscrow");
const inspect = (fn) =>
  read.readContract({
    address: source.escrow,
    abi: escrowArtifact.abi,
    functionName: fn,
  });
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
  await inspect("issuerX"),
  await inspect("issuerY"),
  await inspect("revocationRoot"),
  publicState.addresses.arbitrator,
]);
const stack = JSON.parse(
  await readFile(
    "experiments/qualification/transport/local-stack.json",
    "utf8",
  ),
);
const config = {
  version: 1,
  environment: "local-pilot",
  testOnly: true,
  chainId: 31338,
  rpcUrl: chain.rpcUrls.default.http[0],
  escrow,
  keyRegistry,
  token: source.token,
  verifier: source.verifier,
  issuer: account.address,
  arbitrator: publicState.addresses.arbitrator,
  snapshot: publicState.storage.snapshot,
  swarm: {
    environment: "local-bee",
    uploadUrl: "http://127.0.0.1:1633",
    downloadUrl: "http://127.0.0.1:1635",
    postageBatchId:
      process.env.QUALIFICATION_LOCAL_POSTAGE ?? stack.localPostage.batchID,
  },
};
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
