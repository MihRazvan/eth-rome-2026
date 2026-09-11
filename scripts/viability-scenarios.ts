import { formatUnits, parseUnits } from "viem";
import { writeFileSync } from "node:fs";
import {
  bargainingWindow,
  operatingScale,
  type PurchaseAssumptions,
} from "../packages/viability/economics";

const units = (value: string) => parseUnits(value, 6);
const base: PurchaseAssumptions = {
  expectedRecovery: units("10000"),
  remainingSeconds: 15n * 86400n,
  annualHurdleBps: 1000n,
  recoveryHaircutBps: 0n,
  buyerUpfrontCosts: units("2"),
  buyerCollectionCosts: units("2"),
  riskReserve: units("10"),
  protocolFeeBps: 5n,
  sellerTransactionCosts: units("1"),
};
const alternative = {
  kind: "immediate-route" as const,
  label:
    "Hypothetical instant exit with 20bp total loss, including its own costs",
  effectiveProceeds: units("9980"),
};
const serializeMoney = (record: Record<string, bigint>) =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, formatUnits(value, 6)]),
  );
const scenarios = [15, 5, 1].map((days) => {
  const result = bargainingWindow(
    { ...base, remainingSeconds: BigInt(days) * 86400n },
    alternative,
  );
  return {
    days,
    status: result.status,
    surplusOverAlternative:
      result.surplus === null ? null : formatUnits(result.surplus, 6),
    ...serializeMoney(result.ceiling),
  };
});
const stressed = bargainingWindow(
  { ...base, remainingSeconds: 86400n, recoveryHaircutBps: 100n },
  alternative,
);
const output = {
  kind: "hypothetical-economic-scenarios",
  marketEvidence: false,
  note: "All amounts use one hypothetical payout/payment currency. No exchange rate, funded buyer, seller willingness or source eligibility is assumed proven.",
  assumptions: {
    recovery: "10000",
    annualSimpleHurdle: "10%",
    upfrontBuyerCosts: "2",
    collectionCosts: "2",
    extraRiskReserve: "10",
    sellerTransactionCosts: "1",
    protocolFee: "5bp on seller payment",
    alternativeNet: "9980",
    recoveryHaircut: "0 unless marked stressed",
  },
  scenarios,
  oneDayWithOnePercentRecoveryHaircut: {
    status: stressed.status,
    sellerEffectiveProceeds: formatUnits(
      stressed.ceiling.sellerEffectiveProceeds,
      6,
    ),
    surplus:
      stressed.surplus === null ? null : formatUnits(stressed.surplus, 6),
  },
  operatingExample: {
    assumptions: {
      dailyFace: "1000000",
      averageWaitDays: 5,
      purchaseFraction: "99.8%",
      monthlyFace: "30000000",
      retainedFee: "5bp",
    },
    ...serializeMoney(
      operatingScale({
        dailyPurchasedFace: units("1000000"),
        averageWaitSeconds: 5n * 86400n,
        averagePaymentBps: 9980n,
        monthlyPurchasedFace: units("30000000"),
        retainedFeeBps: 5n,
      }),
    ),
    excluded:
      "idle capital, tail delays, simultaneous shocks, hedges, infrastructure, legal and personnel costs",
  },
};
const destination = process.argv[2];
const json = JSON.stringify(output, null, 2) + "\n";
if (destination) writeFileSync(destination, json);
else process.stdout.write(json);
