import { describe, expect, it } from "vitest";
import {
  bargainingWindow,
  candidateStatus,
  operatingScale,
  purchaseCeiling,
  type PurchaseAssumptions,
} from "./economics";

const base: PurchaseAssumptions = {
  expectedRecovery: 10_000_000_000n,
  remainingSeconds: 15n * 86_400n,
  annualHurdleBps: 1_000n,
  recoveryHaircutBps: 0n,
  buyerUpfrontCosts: 0n,
  buyerCollectionCosts: 0n,
  riskReserve: 0n,
  protocolFeeBps: 0n,
  sellerTransactionCosts: 0n,
};

describe("withdrawal purchase economics, explicit assumptions only", () => {
  it("a 15-day purchase cannot beat a 20bp liquid exit at a 10% hurdle", () => {
    const alternative = {
      kind: "immediate-route" as const,
      label: "hypothetical 20bp instant exit",
      effectiveProceeds: 9_980_000_000n,
    };
    const long = bargainingWindow(base, alternative);
    expect(long.status).toBe("no-window");
    // Independently computed: 10000 / (1 + 0.1 * 15/365) = 9959.0723...
    expect(long.ceiling.sellerPayment).toBe(9_959_072_305n);
    const aged = bargainingWindow(
      { ...base, remainingSeconds: 86_400n },
      alternative,
    );
    expect(aged.status).toBe("positive-window");
    expect(aged.ceiling.sellerPayment).toBe(9_997_261_024n);
  });

  it("discounts all deployed capital and counts each cost/fee once", () => {
    const a = {
      ...base,
      expectedRecovery: 1_000n,
      remainingSeconds: 0n,
      buyerCollectionCosts: 10n,
      buyerUpfrontCosts: 20n,
      riskReserve: 30n,
      protocolFeeBps: 100n,
      sellerTransactionCosts: 40n,
    };
    const c = purchaseCeiling(a);
    expect(c).toMatchObject({
      presentValue: 990n,
      paymentBudget: 940n,
      sellerPayment: 930n,
      protocolFee: 10n,
      buyerDebit: 940n,
      buyerCapitalRequired: 960n,
      sellerEffectiveProceeds: 890n,
    });
    expect(c.buyerCapitalRequired + a.riskReserve).toBe(c.presentValue);
  });

  it("retains losses and refuses to infer seller willingness from face value", () => {
    const empty = purchaseCeiling({
      ...base,
      recoveryHaircutBps: 10_000n,
      sellerTransactionCosts: 10n,
    });
    expect(empty.sellerPayment).toBe(0n);
    expect(empty.sellerEffectiveProceeds).toBe(-10n);
    expect(bargainingWindow(base, undefined).status).toBe(
      "seller-floor-unknown",
    );
  });

  it("worse delay, recovery and costs cannot improve the purchase ceiling", () => {
    const original = purchaseCeiling(base).sellerPayment;
    for (const change of [
      { remainingSeconds: 30n * 86_400n },
      { recoveryHaircutBps: 100n },
      { annualHurdleBps: 2_000n },
      { buyerUpfrontCosts: 1n },
      { buyerCollectionCosts: 1n },
      { riskReserve: 1n },
      { protocolFeeBps: 1n },
    ])
      expect(
        purchaseCeiling({ ...base, ...change }).sellerPayment,
      ).toBeLessThan(original);
  });

  it("does not confuse an assumed spread with transferable claims or funded demand", () => {
    const window = bargainingWindow(base, {
      kind: "seller-reservation",
      label: "hypothetical seller floor",
      effectiveProceeds: 9_900_000_000n,
    });
    const flags = {
      window,
      claimAcquisitionVerified: true,
      alternativeFresh: true,
      buyerFundedQuote: true,
    };
    expect(candidateStatus({ ...flags, claimAcquisitionVerified: false })).toBe(
      "unsupported-acquisition",
    );
    expect(candidateStatus({ ...flags, alternativeFresh: false })).toBe(
      "comparison-unverified",
    );
    expect(candidateStatus({ ...flags, buyerFundedQuote: false })).toBe(
      "buyer-unconfirmed",
    );
    expect(candidateStatus(flags)).toBe("candidate-for-simulation");
  });

  it("uses integers above JS number precision and rounds capital upward", () => {
    const amount = 9007199254740993000001n;
    expect(
      purchaseCeiling({
        ...base,
        expectedRecovery: amount,
        remainingSeconds: 0n,
      }).sellerPayment,
    ).toBe(amount);
    expect(
      operatingScale({
        dailyPurchasedFace: 1n,
        averageWaitSeconds: 1n,
        averagePaymentBps: 10_000n,
        monthlyPurchasedFace: amount,
        retainedFeeBps: 10n,
      }),
    ).toEqual({ deployedCapital: 1n, monthlyGrossRevenue: amount / 1000n });
  });

  it("small fees need volume while inventory consumes capital", () => {
    expect(
      operatingScale({
        dailyPurchasedFace: 1_000_000n,
        averageWaitSeconds: 5n * 86_400n,
        averagePaymentBps: 9_980n,
        monthlyPurchasedFace: 30_000_000n,
        retainedFeeBps: 5n,
      }),
    ).toEqual({ deployedCapital: 4_990_000n, monthlyGrossRevenue: 15_000n });
  });

  it("rejects impossible inputs and does not call a tie an improvement", () => {
    expect(() => purchaseCeiling({ ...base, remainingSeconds: -1n })).toThrow();
    expect(() =>
      purchaseCeiling({ ...base, recoveryHaircutBps: 10_001n }),
    ).toThrow();
    const c = purchaseCeiling(base);
    expect(
      bargainingWindow(base, {
        kind: "immediate-route",
        label: "equal",
        effectiveProceeds: c.sellerEffectiveProceeds,
      }).status,
    ).toBe("no-window");
  });
});
