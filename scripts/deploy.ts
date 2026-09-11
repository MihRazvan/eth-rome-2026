import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { maxUint256, parseUnits, type Address, type Hex } from "viem";
import {
  artifact,
  walletFor,
  publicFor,
  type Deployment,
} from "../packages/runtime/chain";
const fuji = process.argv.includes("--fuji");
const d: Deployment = {
  environment: fuji ? "fuji" : "local",
  chainId: fuji ? 43113 : 31337,
  rpcUrl: fuji
    ? "https://api.avax-test.network/ext/bc/C/rpc"
    : "http://127.0.0.1:8547",
  market: "0x",
  source: "0x",
  token: "0x",
  keyRegistry: "0x",
  blockNumber: "0",
  deployedAt: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  transactions: [],
  makers: [],
};
const client = publicFor(d),
  deployer = walletFor(d, 0);
const accounts = [0, 1, 2, 3].map((i) =>
  walletFor(d, i).account.address.toLowerCase(),
);
if (new Set(accounts).size !== 4)
  throw new Error("Deployer and makers require four distinct accounts");
for (const address of accounts)
  if ((await client.getBalance({ address: address as Address })) === 0n)
    throw new Error("Each demo signer requires testnet gas before deployment");
if ((await client.getChainId()) !== d.chainId)
  throw new Error("RPC chain mismatch");
if ((await client.getBalance({ address: deployer.account.address })) === 0n)
  throw new Error("Deployer lacks testnet gas");
async function deploy(name: string, args: unknown[] = []): Promise<Address> {
  const a = await artifact(name);
  const hash = await deployer.deployContract({
    abi: a.abi,
    bytecode: a.bytecode.object,
    args,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress)
    throw new Error(`${name} deployment failed`);
  d.transactions.push(hash);
  return receipt.contractAddress;
}
d.blockNumber = String((await client.getBlockNumber()) + 1n);
d.token = await deploy("TestUSDC");
d.source = await deploy("TestWithdrawalVault", [d.token]);
d.market = await deploy("ExitMarket", [d.source]);
d.keyRegistry = await deploy("OfferKeyRegistry");
const token = await artifact("TestUSDC"),
  market = await artifact("ExitMarket");
for (let i = 0; i < 4; i++) {
  const w = walletFor(d, i);
  if (i > 0) d.makers.push(w.account.address);
  for (const [address, abi, functionName, args] of [
    [d.token, token.abi, "faucet", []],
    [d.token, token.abi, "approve", [d.market, maxUint256]],
  ] as const) {
    const hash = await w.writeContract({ address, abi, functionName, args });
    const r = await client.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error("Funding failed");
    d.transactions.push(hash);
  }
}
for (const adverse of [false, true]) {
  const hash = await deployer.writeContract({
    address: d.market,
    abi: market.abi,
    functionName: "originate",
    args: [parseUnits("10000", 6), adverse],
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success")
    throw new Error("Seeded claim origination reverted");
  d.transactions.push(hash);
}

await mkdir(".runtime/local", { recursive: true });
if (!fuji)
  await writeFile(".runtime/local/deployment.json", JSON.stringify(d, null, 2));
if (fuji) {
  await mkdir("deployments", { recursive: true });
  await writeFile("deployments/fuji.json", JSON.stringify(d, null, 2));
}
console.log(
  JSON.stringify(
    {
      environment: d.environment,
      chainId: d.chainId,
      market: d.market,
      source: d.source,
      token: d.token,
      keyRegistry: d.keyRegistry,
      makers: d.makers,
      manifest: fuji
        ? "deployments/fuji.json"
        : ".runtime/local/deployment.json",
    },
    null,
    2,
  ),
);
