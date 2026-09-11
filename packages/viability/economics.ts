/** Research calculator. Inputs are explicit assumptions, never executable quotes. */
export const BPS = 10_000n;
export const YEAR_SECONDS = 365n * 24n * 60n * 60n;

export interface PurchaseAssumptions {
  /** All monetary inputs use base units of ONE payout/payment asset. */
  expectedRecovery: bigint;
  remainingSeconds: bigint;
  /** Required simple annual return on all initial capital, including upfront costs. */
  annualHurdleBps: bigint;
  /** Applied to expected recovery; separately excludes the discretionary risk reserve. */
  recoveryHaircutBps: bigint;
  buyerUpfrontCosts: bigint;
  buyerCollectionCosts: bigint;
  /** Additional present-value capital buffer, not a statistical confidence bound. */
  riskReserve: bigint;
  protocolFeeBps: bigint;
  sellerTransactionCosts: bigint;
}

function nonnegative(values: Record<string, bigint>) {
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== "bigint" || value < 0n)
      throw new Error(`${key} must be a nonnegative bigint`);
  }
}

const floorAtZero = (n: bigint) => (n > 0n ? n : 0n);
export const ceilDiv = (n: bigint, d: bigint) => (n + d - 1n) / d;

/**
 * Find a conservative seller-payment ceiling under an assumed terminal recovery.
 * Discounting uses simple interest, NOT an observed market yield or an oracle.
 * Gas, risk reserve and protocol fees cannot disappear into a headline spread.
 */
export function purchaseCeiling(a: PurchaseAssumptions) {
  nonnegative({ ...a });
  if (a.recoveryHaircutBps > BPS || a.protocolFeeBps > BPS)
    throw new Error("Haircut and protocol fee cannot exceed 100%");
  const stressedRecovery =
    (a.expectedRecovery * (BPS - a.recoveryHaircutBps)) / BPS;
  const afterCollectionCosts = floorAtZero(
    stressedRecovery - a.buyerCollectionCosts,
  );
  const presentValue =
    (afterCollectionCosts * BPS * YEAR_SECONDS) /
    (BPS * YEAR_SECONDS + a.annualHurdleBps * a.remainingSeconds);
  const paymentBudget = floorAtZero(
    presentValue - a.buyerUpfrontCosts - a.riskReserve,
  );
  const sellerPayment = (paymentBudget * BPS) / (BPS + a.protocolFeeBps);
  const protocolFee = ceilDiv(sellerPayment * a.protocolFeeBps, BPS);
  const buyerDebit = sellerPayment + protocolFee;
  return {
    stressedRecovery,
    presentValue,
    paymentBudget,
    sellerPayment,
    protocolFee,
    buyerDebit,
    /** Can be negative for an uneconomic tiny purchase. Never clamp that loss away. */
    sellerEffectiveProceeds: sellerPayment - a.sellerTransactionCosts,
    buyerCapitalRequired: buyerDebit + a.buyerUpfrontCosts,
  };
}

export type Alternative = {
  kind: "immediate-route" | "seller-reservation";
  /** Net of this alternative's own gas/fees, in the identical asset and base units. */
  effectiveProceeds: bigint;
  label: string;
};

export function bargainingWindow(
  a: PurchaseAssumptions,
  alternative: Alternative | undefined,
  minimumImprovement = 0n,
) {
  nonnegative({ minimumImprovement });
  const ceiling = purchaseCeiling(a);
  if (!alternative)
    return { ceiling, status: "seller-floor-unknown" as const, surplus: null };
  nonnegative({ effectiveProceeds: alternative.effectiveProceeds });
  const surplus =
    ceiling.sellerEffectiveProceeds -
    alternative.effectiveProceeds -
    minimumImprovement;
  return {
    ceiling,
    status:
      surplus > 0n ? ("positive-window" as const) : ("no-window" as const),
    surplus,
  };
}

/** Economic positivity cannot make an untransferable or expired route executable. */
export function candidateStatus(input: {
  window: ReturnType<typeof bargainingWindow>;
  claimAcquisitionVerified: boolean;
  alternativeFresh: boolean;
  buyerFundedQuote: boolean;
}) {
  if (!input.claimAcquisitionVerified) return "unsupported-acquisition";
  if (!input.alternativeFresh) return "comparison-unverified";
  if (input.window.status !== "positive-window") return input.window.status;
  return input.buyerFundedQuote
    ? "candidate-for-simulation"
    : "buyer-unconfirmed";
}

/** Steady-state illustration; excludes idle capital, tails and simultaneous exit shocks. */
export function operatingScale(input: {
  dailyPurchasedFace: bigint;
  averageWaitSeconds: bigint;
  averagePaymentBps: bigint;
  monthlyPurchasedFace: bigint;
  retainedFeeBps: bigint;
}) {
  nonnegative({ ...input });
  if (input.averagePaymentBps > BPS || input.retainedFeeBps > BPS)
    throw new Error(
      "This operating illustration assumes payment/fees at most par",
    );
  return {
    deployedCapital: ceilDiv(
      input.dailyPurchasedFace *
        input.averageWaitSeconds *
        input.averagePaymentBps,
      86_400n * BPS,
    ),
    monthlyGrossRevenue:
      (input.monthlyPurchasedFace * input.retainedFeeBps) / BPS,
  };
}
