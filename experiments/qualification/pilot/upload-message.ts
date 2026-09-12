import { type Hex } from "viem";
export function uploadMessage(
  chainId: number,
  escrow: Hex,
  jobId: string,
  digest: Hex,
  expiresAt: number,
) {
  return [
    "Review Pass encrypted review upload v1",
    `Chain: ${chainId}`,
    `Escrow: ${escrow.toLowerCase()}`,
    `Job: ${jobId}`,
    `SHA-256: ${digest.toLowerCase()}`,
    `Expires: ${expiresAt}`,
  ].join("\n");
}
