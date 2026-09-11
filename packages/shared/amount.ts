import { parseUnits } from "viem";
/** Compare six-decimal token quantities without conversion to IEEE754. */
export function compareAmounts(
  a: string | undefined,
  b: string | undefined,
): number {
  const left = parseUnits(a ?? "0", 6),
    right = parseUnits(b ?? "0", 6);
  return left > right ? 1 : left < right ? -1 : 0;
}
