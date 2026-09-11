import { createPublicClient, http, keccak256, type Hex } from "viem";
import { avalanche } from "viem/chains";
import { writeFile, mkdir } from "node:fs/promises";
const client = createPublicClient({
  chain: avalanche,
  transport: http("https://api.avax.network/ext/bc/C/rpc"),
});
const blockNumber = 95031281n,
  proxy = "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE";
const slot = await client.getStorageAt({
  address: proxy,
  slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  blockNumber,
});
const implementation = `0x${slot!.slice(-40)}` as Hex;
const bytecode = await client.getCode({ address: implementation, blockNumber });
const sourceUrl = `https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api?module=contract&action=getsourcecode&address=${implementation}`;
const verified = await (await fetch(sourceUrl)).json();
const info = verified.result[0];
const result = {
  observedAt: new Date().toISOString(),
  chainId: 43114,
  blockNumber: blockNumber.toString(),
  proxy,
  implementation,
  implementationCodeHash: keccak256(bytecode!),
  explorerSourceUrl: sourceUrl,
  explorerVerifiedContract: info.ContractName,
  compiler: info.CompilerVersion,
  sourceBundleKeccak: keccak256(new TextEncoder().encode(info.SourceCode)),
  sourceLicense:
    "GPL-3.0 published source; no third-party implementation copied into EXIT",
  sourceABI: JSON.parse(info.ABI)
    .filter((x: any) => x.type === "function")
    .map(
      (x: any) =>
        x.name + "(" + x.inputs.map((y: any) => y.type).join(",") + ")",
    ),
};
await mkdir("docs/evidence", { recursive: true });
await writeFile(
  "docs/evidence/benqi-pin.json",
  JSON.stringify(result, null, 2),
);
console.log(result);
