/** Reproducible PUBLIC READS only. Run: npx tsx docs/viability/probes/avalanche-quotes.ts [blockNumber]
 * No account, signer, approvals, state overrides, transactions, or provider credentials.
 */
import {
  createPublicClient,
  http,
  parseAbi,
  parseAbiItem,
  formatUnits,
  keccak256,
  type Address,
  type Abi,
} from "viem";
import { writeFile } from "node:fs/promises";
const rpc = "https://api.avax.network/ext/bc/C/rpc";
const client = createPublicClient({
  transport: http(rpc, { timeout: 25000, retryCount: 1 }),
});
const blockNumber = process.argv[2]
  ? BigInt(process.argv[2])
  : await client.getBlockNumber();
const block = await client.getBlock({ blockNumber });
const sAVAX: Address = "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE";
const WAVAX: Address = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
const USDC: Address = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";
const quoter: Address = "0x9A550a522BBaDFB69019b0432800Ed17855A51C3";
const sourceURL = (address: Address) =>
  `https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api?module=contract&action=getsourcecode&address=${address}`;
const source = async (address: Address) => {
  const r = await fetch(sourceURL(address));
  const j = await r.json();
  if (j.status !== "1" || !j.result[0]?.ABI)
    throw new Error("Source retrieval unavailable");
  return j.result[0];
};
const slot = await client.getStorageAt({
  address: sAVAX,
  blockNumber,
  slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
});
const implementation = `0x${slot!.slice(-40)}` as Address;
const [s, q] = await Promise.all([source(implementation), source(quoter)]);
const abi = JSON.parse(s.ABI) as Abi;
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const read = (functionName: string, args: readonly unknown[] = []) =>
  client.readContract({ address: sAVAX, abi, functionName, args, blockNumber });
const safe = async (fn: () => Promise<unknown>) => {
  try {
    return { status: "observed", value: await fn() };
  } catch {
    return { status: "unavailable" };
  }
};
const values: Record<string, unknown> = {};
for (const fn of [
  "totalPooledAvax",
  "totalSupply",
  "totalShares",
  "cooldownPeriod",
  "redeemPeriod",
  "paused",
  "mintingPaused",
  "protocolRewardShare",
  "stakerCount",
])
  values[fn] = await safe(() => read(fn));
const rate = (await read("getPooledAvaxByShares", [10n ** 18n])) as bigint;
values.oneShareAvaxWei = rate;
values.custodiedSharesWei = await client.readContract({
  address: sAVAX,
  abi: erc20,
  functionName: "balanceOf",
  args: [sAVAX],
  blockNumber,
});
values.contractNativeBalanceWei = await client.getBalance({
  address: sAVAX,
  blockNumber,
});
const quotes: unknown[] = [];
for (const shares of [1n, 10n, 100n, 1000n, 10000n, 100000n]) {
  const amount = shares * 10n ** 18n;
  const nav = (await read("getPooledAvaxByShares", [amount])) as bigint;
  for (const route of [
    [sAVAX, WAVAX],
    [sAVAX, USDC, WAVAX],
  ]) {
    try {
      const quote = (await client.readContract({
        address: quoter,
        abi: JSON.parse(q.ABI),
        functionName: "findBestPathFromAmountIn",
        args: [route, amount],
        blockNumber,
      })) as {
        amounts: bigint[];
        virtualAmountsWithoutSlippage: bigint[];
        pairs: Address[];
        [key: string]: unknown;
      };
      const output = quote.amounts.at(-1)!;
      quotes.push({
        shares: shares.toString(),
        amountInWei: amount,
        amountOutWei: output,
        currentNavWei: nav,
        route,
        status:
          output > 0n && quote.pairs.every((p) => !/^0x0+$/.test(p))
            ? "quoted"
            : "no-complete-route",
        navAvax: formatUnits(nav, 18),
        outputAvax: formatUnits(output, 18),
        discountToCurrentNavBps: (Number(nav - output) / Number(nav)) * 10000,
        quote,
      });
    } catch {
      quotes.push({
        shares: shares.toString(),
        route,
        status: "call-unavailable-or-reverted",
      });
    }
  }
}
// Bounded event sample, deliberately not represented as the full queue or user count.
const fromBlock = blockNumber - 9999n;
const logs: Awaited<ReturnType<typeof client.getLogs>> = [];
const event = parseAbiItem(
  "event UnlockRequested(address indexed user,uint256 shareAmount)",
);
let logScanComplete = true;
for (let start = fromBlock; start <= blockNumber; start += 1000n) {
  try {
    logs.push(
      ...(await client.getLogs({
        address: sAVAX,
        event,
        fromBlock: start,
        toBlock: start + 999n < blockNumber ? start + 999n : blockNumber,
      })),
    );
  } catch {
    logScanComplete = false;
  }
}
const users = [
  ...new Set(
    logs
      .map((l) => l.topics[1])
      .filter(Boolean)
      .map((t) => `0x${t!.slice(-40)}` as Address),
  ),
];
const sampledRequests = [];
for (const user of users.slice(0, 50)) {
  const count = await safe(() => read("getUnlockRequestCount", [user]));
  const requests =
    count.status === "observed" &&
    typeof count.value === "bigint" &&
    count.value > 0n
      ? await safe(() =>
          read("getPaginatedUnlockRequests", [
            user,
            0n,
            (count.value as bigint) > 20n ? 20n : count.value,
          ]),
        )
      : undefined;
  sampledRequests.push({ user, count, requests });
}
const result = {
  observedAt: new Date().toISOString(),
  chainId: await client.getChainId(),
  blockNumber,
  blockHash: block.hash,
  blockTimestamp: block.timestamp,
  rpc,
  source: {
    proxy: sAVAX,
    implementation,
    implementationCodeHash: keccak256(
      (await client.getCode({ address: implementation, blockNumber }))!,
    ),
    explorer: sourceURL(implementation),
    sourceBundleKeccak: keccak256(new TextEncoder().encode(s.SourceCode)),
  },
  quoter: {
    address: quoter,
    codeHash: keccak256(
      (await client.getCode({ address: quoter, blockNumber }))!,
    ),
    officialAddressSource:
      "https://developers.lfj.gg/deployment-addresses/avalanche",
    explorer: sourceURL(quoter),
  },
  values,
  quotes,
  queueSample: {
    fromBlock,
    toBlock: blockNumber,
    fromTimestamp: (await client.getBlock({ blockNumber: fromBlock }))
      .timestamp,
    logScanComplete,
    requestEventCount: logs.length,
    uniqueRecentRequesters: users.length,
    usersExamined: sampledRequests.length,
    sampledRequests,
  },
  limits: [
    "Read-only eth_call output, not an executed sale, guaranteed fill, or transaction simulation with a funded seller.",
    "LFJ direct and USDC-routed paths only; no claim of best market-wide routing or split liquidity.",
    "Current conversion NAV is not guaranteed future redemption value.",
    "Custodied shares include pending, redeemable and overdue requests; bounded event sample is not full active queue.",
    "Gas, future rate changes, front-running, and stablecoin conversion are excluded.",
  ],
};
const target = new URL("./avalanche-quotes.json", import.meta.url);
await writeFile(
  target,
  JSON.stringify(
    result,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    blockNumber: blockNumber.toString(),
    quotes: quotes.length,
    eventCount: logs.length,
    sampleComplete: logScanComplete,
    saved: target.pathname,
  }),
);
