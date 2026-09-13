// File-shape guidance only. Cryptographic validity is checked by the prover/contract.
const field = (v: unknown) =>
  typeof v === "string" &&
  /^[1-9][0-9]{0,76}$/.test(v) &&
  BigInt(v) <
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error(
      "Choose a JSON object from the issuer or your private holder backup.",
    );
  return value as Record<string, unknown>;
}
export function validateProofFile(
  kind: "credential" | "holder",
  value: unknown,
) {
  const v = object(value);
  if (v.format === "cutout-enrollment-request")
    throw Error(
      "This is an enrollment request, not a signed credential. Send only this request to the Deaddrop team and wait for the issued credential JSON.",
    );
  if (kind === "credential" && "holderSecret" in v)
    throw Error(
      "This is your private holder backup. Select it in Private holder JSON; Credential JSON needs the file returned by the Deaddrop issuer.",
    );
  if (kind === "holder" && "signature" in v)
    throw Error(
      "This is an issued credential. Select it in Credential JSON; Private holder JSON needs your saved cutout-private-holder.json.",
    );
  if (
    v.version !== "qualification-v1-test" ||
    v.testOnly !== true ||
    !field(v.holderCommitment)
  )
    throw Error("This file is not a supported Deaddrop test qualification file.");
  if (kind === "credential") {
    if (
      typeof v.signature !== "string" ||
      !/^[0-9a-f]{128}$/i.test(v.signature) ||
      !field(v.issuerX) ||
      !field(v.issuerY) ||
      !Number.isSafeInteger(v.index) ||
      Number(v.index) < 0 ||
      Number(v.index) >= 65536 ||
      !Number.isSafeInteger(v.class) ||
      Number(v.class) <= 0 ||
      !Number.isSafeInteger(v.expiry) ||
      Number(v.expiry) <= 0
    )
      throw Error(
        "Choose the signed credential JSON returned by the Deaddrop issuer. A generated enrollment request cannot replace it.",
      );
  } else if (
    !field(v.holderSecret) ||
    BigInt(v.holderSecret as string) >= 1n << 248n
  )
    throw Error(
      "Choose your saved private holder backup, cutout-private-holder.json. Keep its contents on your device.",
    );
  return v;
}
export function validateProofPair(
  credential: unknown,
  holder: unknown,
  qualificationClass: number,
  now: number,
) {
  const c = validateProofFile("credential", credential),
    h = validateProofFile("holder", holder);
  if (c.holderCommitment !== h.holderCommitment)
    throw Error(
      "These files do not belong together. Use the private holder backup from the enrollment request that the issuer approved.",
    );
  if (c.class !== qualificationClass)
    throw Error("This credential does not qualify for this task class.");
  if (Number(c.expiry) <= now)
    throw Error(
      "This credential has expired. Ask the Deaddrop issuer for a renewed credential.",
    );
}
