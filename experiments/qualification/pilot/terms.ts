import { bytesToHex, sha256, type Address, type Hex } from "viem";

/** Public scope only. Do not put private source, credentials or identifying assessment records here. */
export type ReviewTerms = {
  format: "review-pass-public-terms";
  version: 1;
  chainId: number;
  escrow: Address;
  client: Address;
  token: Address;
  qualificationClass: string;
  amount: string;
  acceptBefore: number;
  submitBefore: number;
  reviewBefore: number;
  title: string;
  scope: string;
  policy: "approval-timeout-arbitration-v1";
};
const address = /^0x[a-fA-F0-9]{40}$/;
export function publicTerms(value: unknown): ReviewTerms {
  if (!value || typeof value !== "object")
    throw Error("Public review terms required");
  const v = value as Record<string, unknown>;
  if (
    v.format !== "review-pass-public-terms" ||
    v.version !== 1 ||
    v.policy !== "approval-timeout-arbitration-v1"
  )
    throw Error("Unsupported review terms");
  for (const key of ["escrow", "client", "token"])
    if (
      typeof v[key] !== "string" ||
      !address.test(v[key]) ||
      BigInt(v[key]) === 0n
    )
      throw Error("Invalid terms address");
  if (!Number.isSafeInteger(v.chainId) || Number(v.chainId) <= 0)
    throw Error("Invalid terms chain");
  for (const key of ["amount", "qualificationClass"])
    if (
      typeof v[key] !== "string" ||
      !/^[1-9][0-9]{0,77}$/.test(v[key]) ||
      BigInt(v[key]) >= 2n ** (key === "amount" ? 256n : 32n)
    )
      throw Error("Invalid terms amount or class");
  for (const key of ["acceptBefore", "submitBefore", "reviewBefore"])
    if (!Number.isSafeInteger(v[key]) || Number(v[key]) <= 0)
      throw Error("Invalid terms deadline");
  if (!(
    Number(v.acceptBefore) < Number(v.submitBefore) &&
    Number(v.submitBefore) < Number(v.reviewBefore)
  ))
    throw Error("Deadlines must increase");
  if (
    typeof v.title !== "string" ||
    !v.title.trim() ||
    v.title.length > 100 ||
    typeof v.scope !== "string" ||
    !v.scope.trim() ||
    v.scope.length > 4000
  )
    throw Error("Use a title up to100 and public scope up to4000 characters");
  // Explicit construction prevents arbitrary credential/private properties from being published.
  return {
    format: "review-pass-public-terms",
    version: 1,
    chainId: Number(v.chainId),
    escrow: (v.escrow as string).toLowerCase() as Address,
    client: (v.client as string).toLowerCase() as Address,
    token: (v.token as string).toLowerCase() as Address,
    qualificationClass: v.qualificationClass as string,
    amount: v.amount as string,
    acceptBefore: Number(v.acceptBefore),
    submitBefore: Number(v.submitBefore),
    reviewBefore: Number(v.reviewBefore),
    title: v.title,
    scope: v.scope,
    policy: "approval-timeout-arbitration-v1",
  };
}
export function encodeTerms(value: unknown) {
  const terms = publicTerms(value);
  const bytes = new TextEncoder().encode(JSON.stringify(terms));
  return { terms, bytes, digest: sha256(bytesToHex(bytes)) };
}
export function termsUploadMessage(
  terms: ReviewTerms,
  digest: Hex,
  expiresAt: number,
) {
  return `Review Pass public terms upload\nChain: ${terms.chainId}\nEscrow: ${terms.escrow}\nClient: ${terms.client}\nSHA256: ${digest}\nExpires: ${expiresAt}`;
}
export function matchTerms(
  terms: ReviewTerms,
  chainId: number,
  escrow: string,
  token: string,
  job: readonly unknown[],
) {
  return (
    terms.chainId === chainId &&
    terms.escrow.toLowerCase() === escrow.toLowerCase() &&
    terms.token.toLowerCase() === token.toLowerCase() &&
    terms.client.toLowerCase() === String(job[0]).toLowerCase() &&
    terms.amount === String(job[2]) &&
    terms.qualificationClass === String(job[3]) &&
    terms.acceptBefore === Number(job[4]) &&
    terms.submitBefore === Number(job[5]) &&
    terms.reviewBefore === Number(job[6])
  );
}
