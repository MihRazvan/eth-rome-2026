/** Public mainnet eth_call/storage/code reads only. No signer or state override. */
import {
  createPublicClient,
  http,
  encodeFunctionData,
  decodeFunctionResult,
  keccak256,
  type Address,
  type Abi,
} from "viem";
import { readFile, writeFile } from "node:fs/promises";
const snapshot = JSON.parse(
  await readFile(new URL("./avalanche-quotes.json", import.meta.url), "utf8"),
);
const blockNumber = BigInt(snapshot.blockNumber);
const client = createPublicClient({
  transport: http("https://api.avax.network/ext/bc/C/rpc", {
    timeout: 30000,
    retryCount: 0,
  }),
});
const slot =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;
const sAVAX: Address = snapshot.source.proxy,
  WAVAX: Address = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
const yak: Address = "0xC4729E56b831d74bBc18797e0e17A295fA77488c";
async function verified(address: Address) {
  const url = `https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api?module=contract&action=getsourcecode&address=${address}`;
  const j = await (await fetch(url)).json();
  if (j.status !== "1") throw new Error("source unavailable");
  return {
    url,
    name: j.result[0].ContractName,
    abi: JSON.parse(j.result[0].ABI) as Abi,
    sourceHash: keccak256(new TextEncoder().encode(j.result[0].SourceCode)),
  };
}
const yakSource = await verified(yak);
const quotes = [];
for (const shares of [1n, 10n, 100n, 1000n, 10000n, 100000n]) {
  const amountInWei = shares * 10n ** 18n;
  try {
    const response = await client.call({
      to: yak,
      data: encodeFunctionData({
        abi: yakSource.abi,
        functionName: "findBestPath",
        args: [amountInWei, sAVAX, WAVAX, 2n],
      }),
      blockNumber,
      gas: 50000000n,
    });
    if (!response.data) throw new Error("Empty quote response");
    const quote = decodeFunctionResult({
      abi: yakSource.abi,
      functionName: "findBestPath",
      data: response.data,
    }) as { amounts: bigint[]; adapters: Address[]; path: Address[] };
    const amountOutWei = quote.amounts.at(-1) ?? 0n;
    const navWei = BigInt(
      snapshot.quotes.find(
        (q: any) => q.shares === shares.toString() && q.route.length === 2,
      ).currentNavWei,
    );
    quotes.push({
      inputShares: shares.toString(),
      amountInWei,
      amountOutWei,
      navWei,
      discountToCurrentNavBps:
        (Number(navWei - amountOutWei) / Number(navWei)) * 10000,
      status:
        quote.path.length > 1 && amountOutWei > 0n ? "quoted" : "no-route",
      quote,
    });
  } catch {
    quotes.push({
      inputShares: shares.toString(),
      amountInWei,
      status: "call-unavailable-or-reverted",
    });
  }
}
const candidates = [
  {
    name: "Hypha stAVAX / former ggAVAX",
    address: "0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3",
    calls: [
      "totalSupply",
      "totalAssets",
      "amountAvailableForStaking",
      "symbol",
    ],
  },
  {
    name: "Hypha WithdrawQueue",
    address: "0x61f908D4992a790A2792D3C36850B4b9eB5849A3",
    calls: [
      "nextRequestId",
      "getPendingRequestsCount",
      "getFulfilledRequestsCount",
      "totalAllocatedFunds",
      "unstakeDelay",
      "maxExpirationDelay",
      "paused",
    ],
  },
  {
    name: "Yield Yak rsAVAX",
    address: "0xDf788AD40181894dA035B827cDF55C523bf52F67",
    calls: ["totalSupply", "symbol", "authority"],
  },
  {
    name: "Yield Yak rsAVAX delayed withdrawal",
    address: "0xfF464A521077bd233C4e429BeD76d1442015Eb62",
    calls: ["isPaused", "boringVault", "accountant"],
  },
  {
    name: "Yield Yak yyUSDai",
    address: "0xdC038cFf8E55416a5189e37F382879c19217a4CB",
    calls: ["totalSupply", "symbol", "authority"],
  },
  {
    name: "Yield Yak yyUSDai delayed withdrawal",
    address: "0xa131e4ddA78Ed81aE5F467D2EA3Ef8b223c2aAFB",
    calls: ["isPaused", "boringVault", "accountant"],
  },
];
const observations = [];
for (const c of candidates) {
  const address = c.address as Address;
  const code = await client.getCode({ address, blockNumber });
  const stored = await client.getStorageAt({ address, blockNumber, slot });
  const implementation =
    stored && !/^0x0*$/.test(stored)
      ? (`0x${stored.slice(-40)}` as Address)
      : address;
  const info = await verified(implementation);
  const calls: Record<string, unknown> = {};
  for (const fn of c.calls) {
    try {
      calls[fn] = {
        status: "observed",
        value: await client.readContract({
          address,
          abi: info.abi,
          functionName: fn,
          blockNumber,
        }),
      };
    } catch {
      calls[fn] = { status: "unavailable-or-reverted" };
    }
  }
  if (c.name.includes("delayed withdrawal")) {
    const asset = c.name.includes("rsAVAX")
      ? sAVAX
      : "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";
    try {
      calls.withdrawAsset = {
        status: "observed",
        asset,
        value: await client.readContract({
          address,
          abi: info.abi,
          functionName: "withdrawAssets",
          args: [asset],
          blockNumber,
        }),
        abi: info.abi.filter((a: any) => a.name === "withdrawAssets"),
      };
    } catch {
      calls.withdrawAsset = { status: "unavailable-or-reverted" };
    }
  }
  observations.push({
    name: c.name,
    address,
    implementation,
    codeHash: code ? keccak256(code) : null,
    source: info.url,
    sourceBundleKeccak: info.sourceHash,
    contractName: info.name,
    nativeBalanceWei: await client.getBalance({ address, blockNumber }),
    calls,
  });
}
const result = {
  observedAt: new Date().toISOString(),
  chainId: 43114,
  blockNumber,
  blockHash: snapshot.blockHash,
  yak: {
    address: yak,
    source: yakSource.url,
    officialRepo:
      "https://github.com/yieldyak/yak-aggregator/tree/50d8be725730b83f231b0a69ff4da62136a49692",
    codeHash: keccak256((await client.getCode({ address: yak, blockNumber }))!),
    maxSteps: 2,
    quotes,
  },
  observations,
  limits: [
    "Public read-only quotes, not executed swaps. No split routing; max2hops, existing router adapter registry only.",
    "Contract getters are observations, not source integration or proof that withdrawal completion will succeed.",
    "Same pinned block as LFJ benchmark; frontend and documentation may describe newer or older versions.",
  ],
};
await writeFile(
  new URL("./avalanche-alternatives.json", import.meta.url),
  JSON.stringify(
    result,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    block: String(blockNumber),
    quotes: quotes.length,
    candidates: observations.length,
  }),
);
