import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateProofFile, validateProofPair } from "./proof-files";
const credential = JSON.parse(
  readFileSync(
    "experiments/qualification/prover/fixtures/credential.json",
    "utf8",
  ),
);
const holder = {
  version: credential.version,
  testOnly: true,
  holderCommitment: credential.holderCommitment,
  holderSecret: "1",
};
test("enrollment requests and swapped files explain the correct source", () => {
  assert.throws(
    () =>
      validateProofFile("credential", { format: "cutout-enrollment-request" }),
    /not a signed credential/,
  );
  assert.throws(
    () => validateProofFile("holder", { format: "cutout-enrollment-request" }),
    /enrollment request/,
  );
  assert.throws(
    () => validateProofFile("credential", holder),
    /Private holder JSON/,
  );
  assert.throws(
    () => validateProofFile("holder", credential),
    /Credential JSON/,
  );
});
test("pair validation rejects mismatched holder, expired credentials and wrong class", () => {
  validateProofPair(credential, holder, 7, 1900000000);
  assert.throws(
    () =>
      validateProofPair(
        credential,
        { ...holder, holderCommitment: "2" },
        7,
        1900000000,
      ),
    /do not belong/,
  );
  assert.throws(
    () => validateProofPair(credential, holder, 8, 1900000000),
    /task class/,
  );
  assert.throws(
    () => validateProofPair(credential, holder, 7, 2000000000),
    /expired/,
  );
  for (const bad of [
    null,
    {},
    { ...credential, signature: "" },
    { ...credential, index: -1 },
  ])
    assert.throws(() => validateProofFile("credential", bad));
});
