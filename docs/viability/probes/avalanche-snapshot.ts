/** Deterministically summarize recorded public observations. No network or transaction access. */
import { readFile, writeFile } from "node:fs/promises";
const load = async (name: string) =>
  JSON.parse(await readFile(new URL(name, import.meta.url), "utf8"));
const lf = await load("./avalanche-quotes.json"),
  yak = await load("./avalanche-alternatives.json");
if (lf.blockNumber !== yak.blockNumber || lf.blockHash !== yak.blockHash)
  throw new Error("Mixed snapshots");
const sizes = ["1", "10", "100", "1000", "10000", "100000"];
const observations = sizes.map((size) => {
  const direct = lf.quotes.find(
    (q: any) =>
      q.shares === size && q.route.length === 2 && q.status === "quoted",
  );
  const y = yak.yak.quotes.find(
    (q: any) => q.inputShares === size && q.status === "quoted",
  );
  if (!direct || !y) throw new Error("Missing quoted path");
  if (BigInt(direct.amountOutWei) <= 0n || BigInt(y.amountOutWei) <= 0n)
    throw new Error("Zero quote");
  if (
    direct.quote.amounts[0] !== y.quote.amounts[0] ||
    direct.route[0].toLowerCase() !== y.quote.path[0].toLowerCase() ||
    direct.route.at(-1).toLowerCase() !== y.quote.path.at(-1).toLowerCase()
  )
    throw new Error("Mismatched assets");
  const best =
    BigInt(y.amountOutWei) > BigInt(direct.amountOutWei) ? "YakRouter" : "LFJ";
  const output = best === "LFJ" ? direct.amountOutWei : y.amountOutWei;
  return {
    inputShares: size,
    amountInWei: direct.amountInWei,
    currentNavWei: direct.currentNavWei,
    lfjAmountOutWei: direct.amountOutWei,
    yakAmountOutWei: y.amountOutWei,
    bestAmongObserved: {
      provider: best,
      amountOutWei: output,
      discountToCurrentNavBps:
        (Number(BigInt(direct.currentNavWei) - BigInt(output)) /
          Number(BigInt(direct.currentNavWei))) *
        10000,
    },
    lfj: {
      quoter: lf.quoter.address,
      route: direct.route,
      pairs: direct.quote.pairs,
      binSteps: direct.quote.binSteps,
      versions: direct.quote.versions,
    },
    yak: {
      quoter: yak.yak.address,
      maxSteps: 2,
      path: y.quote.path,
      adapters: y.quote.adapters,
    },
  };
});
const result = {
  schemaVersion: 1,
  kind: "historical-public-read-snapshot",
  chainId: 43114,
  blockNumber: lf.blockNumber,
  blockHash: lf.blockHash,
  blockTimestamp: lf.blockTimestamp,
  observedAt: lf.observedAt,
  inputToken: { symbol: "sAVAX", address: lf.source.proxy, decimals: 18 },
  outputToken: {
    symbol: "WAVAX",
    address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    decimals: 18,
  },
  currentNav: {
    nativeAsset: "AVAX",
    amountPerWholeShareWei: lf.values.oneShareAvaxWei,
    shareUnitWei: "1000000000000000000",
    description:
      "BENQI current getPooledAvaxByShares; not a guaranteed future payout",
  },
  source: lf.source,
  observations,
  fundedExitOffer: null,
  warnings: [
    "Historical snapshot; rerun quotes for a new observation. No transaction was submitted.",
    "LFJ paths plus YakRouter max2hop no-split routing; not best market-wide execution.",
    "Quoter output includes modeled pool fees. Cancel, approval and swap gas are excluded.",
    "DEX output is WAVAX; native unwrapping and stablecoin conversion are excluded.",
    "No buyer demand, funded EXIT offer or claim-purchase price was observed.",
  ],
};
await writeFile(
  new URL("./avalanche-snapshot.json", import.meta.url),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  `Validated ${observations.length} positive same-block direct/Yak quote comparisons.`,
);
