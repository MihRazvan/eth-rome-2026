import test from "node:test";
import assert from "node:assert/strict";
import { parseEnrollmentRequest } from "./enrollment-request";
const request = {
  format: "cutout-enrollment-request",
  version: 1,
  testOnly: true,
  chainId: 43113,
  escrow: "0x1111111111111111111111111111111111111111",
  issuer: "0x2222222222222222222222222222222222222222",
  qualificationClass: "7",
  holderCommitment: "123",
  createdAt: 1789233500,
};
test("public request contains only approved routing and commitment fields", () =>
  assert.deepEqual(parseEnrollmentRequest(request), request));
test("private holder material and unknown fields are rejected rather than forwarded", () => {
  for (const extra of [
    { holderSecret: "secret" },
    { signature: "credential" },
    { walletPrivateKey: "secret" },
  ])
    assert.throws(() => parseEnrollmentRequest({ ...request, ...extra }));
});
test("rejects wrong chain/class, invalid commitment and malformed time/destinations", () => {
  for (const bad of [
    { chainId: 1 },
    { qualificationClass: "8" },
    { testOnly: false },
    { holderCommitment: "0" },
    {
      holderCommitment:
        "21888242871839275222246405745257275088548364400416034343698204186575808495617",
    },
    { createdAt: -1 },
    { issuer: "invalid" },
  ])
    assert.throws(() => parseEnrollmentRequest({ ...request, ...bad }));
});
