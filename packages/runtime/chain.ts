import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { readFile } from "node:fs/promises";
export interface Deployment {
  environment: "local" | "fuji";
  chainId: number;
  rpcUrl: string;
  market: Address;
  source: Address;
  token: Address;
  keyRegistry: Address;
  blockNumber: string;
  deployedAt: string;
  commit: string;
  transactions: Hex[];
  makers: Address[];
}
export const localMnemonic =
  "test test test test test test test test test test test junk";
export function localAccount(index: number) {
  return mnemonicToAccount(localMnemonic, { addressIndex: index });
}
export function chainFor(d: Pick<Deployment, "chainId" | "rpcUrl">) {
  return defineChain({
    id: d.chainId,
    name: d.chainId === 31337 ? "EXIT local chain" : "Avalanche Fuji",
    nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
    rpcUrls: { default: { http: [d.rpcUrl] } },
  });
}
export const publicFor = (d: Deployment) =>
  createPublicClient({
    chain: chainFor(d),
    transport: http(
      d.environment === "fuji"
        ? (process.env.EXIT_RPC_URL ?? d.rpcUrl)
        : d.rpcUrl,
    ),
  });
export function walletFor(d: Deployment, index: number) {
  if (d.chainId === 31337 && d.environment === "local")
    return createWalletClient({
      account: localAccount(index),
      chain: chainFor(d),
      transport: http(d.rpcUrl),
    });
  const key =
    process.env[index === 0 ? "EXIT_DEPLOYER_KEY" : `EXIT_MAKER_${index}_KEY`];
  if (!key)
    throw new Error(
      `Missing funded Fuji ${index === 0 ? "deployer" : "maker " + index} key; configure environment, never source control`,
    );
  return createWalletClient({
    account: privateKeyToAccount(key as Hex),
    chain: chainFor(d),
    transport: http(
      d.environment === "fuji"
        ? (process.env.EXIT_RPC_URL ?? d.rpcUrl)
        : d.rpcUrl,
    ),
  });
}
export async function artifact(name: string) {
  return JSON.parse(
    await readFile(
      new URL(`../../out/${name}.sol/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
}
export async function loadDeployment() {
  const d = JSON.parse(
    await readFile(
      process.env.EXIT_DEPLOYMENT ?? ".runtime/local/deployment.json",
      "utf8",
    ),
  ) as Deployment;
  if (!(
    (d.environment === "local" && d.chainId === 31337) ||
    (d.environment === "fuji" && d.chainId === 43113)
  ))
    throw new Error("Invalid deployment environment/chain");
  for (const field of ["market", "source", "token", "keyRegistry"] as const)
    if (!isAddress(d[field]))
      throw new Error("Invalid deployment contract address");
  const rpc = new URL(d.rpcUrl);
  if (rpc.username || rpc.password || rpc.search)
    throw new Error(
      "Deployment browser RPC must not contain credentials or query tokens",
    );
  return d;
}
