const USDC_SCALE = 1_000_000n;

/** Reject extra precision rather than rounding a value the user may sign. */
export function parseUsdc(value: string): bigint | null {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * USDC_SCALE + BigInt(fraction.padEnd(6, "0"));
}

export function formatUsdc(value: bigint): string {
  const absolute = value < 0n ? -value : value;
  const fraction = (absolute % USDC_SCALE)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  return `${value < 0n ? "-" : ""}${absolute / USDC_SCALE}${fraction ? `.${fraction}` : ""}`;
}

/** The denominator is the current expected entitlement, including cash held. */
export function saleDifference(expected: string, net: string) {
  const expectedAmount = parseUsdc(expected);
  const netAmount = parseUsdc(net);
  if (expectedAmount === null || netAmount === null) return null;
  const signedDifference = expectedAmount - netAmount;
  const difference =
    signedDifference < 0n ? -signedDifference : signedDifference;
  let percentage: string | null = null;
  if (expectedAmount > 0n) {
    const numerator = difference * 10_000n;
    if (difference > 0n && numerator < expectedAmount) {
      percentage = "<0.01%";
    } else {
      const rounded = (numerator + expectedAmount / 2n) / expectedAmount;
      const approximate = numerator % expectedAmount !== 0n;
      percentage = `${approximate ? "≈" : ""}${rounded / 100n}.${(rounded % 100n).toString().padStart(2, "0")}%`;
    }
  }
  return {
    kind:
      signedDifference > 0n
        ? "discount"
        : signedDifference < 0n
          ? "premium"
          : "equal",
    difference: formatUsdc(difference),
    percentage,
  } as const;
}

/** Gross already includes the protocol fee; never add that fee twice. */
export function buyerOutcome(
  offer: { net: string; fee?: string; gross?: string },
  assumedProceeds: string,
) {
  const net = parseUsdc(offer.net);
  const fee = parseUsdc(offer.fee ?? "0");
  const proceeds = parseUsdc(assumedProceeds);
  const gross = offer.gross === undefined ? undefined : parseUsdc(offer.gross);
  if (net === null || fee === null || proceeds === null || gross === null)
    return null;
  const cost = gross ?? net + fee;
  if (cost < net || (offer.fee !== undefined && cost !== net + fee))
    return null;
  const result = proceeds - cost;
  return {
    cost: formatUsdc(cost),
    breakEven: formatUsdc(cost),
    result: formatUsdc(result),
    kind: result > 0n ? "gain" : result < 0n ? "loss" : "break-even",
  } as const;
}
