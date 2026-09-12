import type { Address } from "viem";
export type EnrollmentRequest = {
  format: "cutout-enrollment-request";
  version: 1;
  testOnly: true;
  chainId: 43113;
  escrow: Address;
  issuer: Address;
  qualificationClass: "7";
  holderCommitment: string;
  createdAt: number;
};
const fields = [
  "format",
  "version",
  "testOnly",
  "chainId",
  "escrow",
  "issuer",
  "qualificationClass",
  "holderCommitment",
  "createdAt",
];
/** Contains only the enrollment commitment, never a holder secret or credential. */
export function parseEnrollmentRequest(value: unknown): EnrollmentRequest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Enrollment request required");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).length !== fields.length ||
    !fields.every((k) => Object.hasOwn(v, k))
  )
    throw Error(
      "Use the public enrollment request, never your private pass backup",
    );
  if (
    v.format !== "cutout-enrollment-request" ||
    v.version !== 1 ||
    v.testOnly !== true ||
    v.chainId !== 43113 ||
    v.qualificationClass !== "7"
  )
    throw Error("Unsupported test enrollment request");
  for (const key of ["escrow", "issuer"])
    if (
      typeof v[key] !== "string" ||
      !/^0x[0-9a-f]{40}$/i.test(v[key]) ||
      BigInt(v[key]) === 0n
    )
      throw Error("Invalid enrollment destination");
  if (
    typeof v.holderCommitment !== "string" ||
    !/^[1-9][0-9]{0,76}$/.test(v.holderCommitment) ||
    BigInt(v.holderCommitment) >=
      21888242871839275222246405745257275088548364400416034343698204186575808495617n
  )
    throw Error("Invalid enrollment commitment");
  if (!Number.isSafeInteger(v.createdAt) || Number(v.createdAt) <= 0)
    throw Error("Invalid request time");
  return {
    ...v,
    escrow: (v.escrow as string).toLowerCase(),
    issuer: (v.issuer as string).toLowerCase(),
  } as EnrollmentRequest;
}
