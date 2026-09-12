import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage, type Address } from "viem";
import {
  encodeTerms,
  publicTerms,
  matchTerms,
  termsUploadMessage,
  type ReviewTerms,
} from "./terms";
import { uploadMessage } from "./upload-message";

const address = (n: number) =>
  `0x${n.toString(16).padStart(40, "0")}` as Address;
const terms: ReviewTerms = {
  format: "review-pass-public-terms",
  version: 1,
  chainId: 43113,
  escrow: address(0xaa),
  client: address(0xbb),
  token: address(0xcc),
  qualificationClass: "7",
  amount: "250000001",
  acceptBefore: 1900000000,
  submitBefore: 1900003600,
  reviewBefore: 1900007200,
  title: "Review withdrawal authorization",
  scope: "Inspect permission boundaries. Supply a reproducible test.",
  policy: "approval-timeout-arbitration-v1",
};
const job = () => [
  terms.client,
  address(0),
  BigInt(terms.amount),
  7n,
  BigInt(terms.acceptBefore),
  BigInt(terms.submitBefore),
  BigInt(terms.reviewBefore),
  0,
  encodeTerms(terms).digest,
  `0x${"0".repeat(64)}`,
];
const matches = (value: ReviewTerms, valueJob = job()) =>
  matchTerms(value, terms.chainId, terms.escrow, terms.token, valueJob);

test("canonical wire bytes use fixed field order and lowercase addresses, independently SHA256 verified", () => {
  const reversed = Object.fromEntries(Object.entries(terms).reverse());
  for (const key of ["escrow", "client", "token"])
    reversed[key] = String(reversed[key]).replace(/[a-f]/g, (s) =>
      s.toUpperCase(),
    );
  const encoded = encodeTerms(reversed);
  const expected = `{"format":"review-pass-public-terms","version":1,"chainId":43113,"escrow":"${address(0xaa)}","client":"${address(0xbb)}","token":"${address(0xcc)}","qualificationClass":"7","amount":"250000001","acceptBefore":1900000000,"submitBefore":1900003600,"reviewBefore":1900007200,"title":"Review withdrawal authorization","scope":"Inspect permission boundaries. Supply a reproducible test.","policy":"approval-timeout-arbitration-v1"}`;
  assert.equal(new TextDecoder().decode(encoded.bytes), expected);
  assert.equal(
    encoded.digest,
    `0x${createHash("sha256").update(expected, "utf8").digest("hex")}`,
  );
  assert.equal(encoded.digest, encodeTerms(terms).digest);
  assert.deepEqual(encoded.terms, terms);
});

test("credential fields and nested private objects are omitted before serialization and hashing", () => {
  const hostile = {
    ...terms,
    holderSecret: "DO_NOT_PUBLISH",
    credentialId: "DO_NOT_PUBLISH",
    privateKey: "DO_NOT_PUBLISH",
    recipients: [{ secret: "DO_NOT_PUBLISH" }],
    assessment: { revocationIndex: 42 },
    publicScope: { secret: "DO_NOT_PUBLISH" },
  };
  const encoded = encodeTerms(hostile);
  assert.deepEqual(encoded.terms, terms);
  assert.equal(encoded.digest, encodeTerms(terms).digest);
  assert.equal(
    new TextDecoder().decode(encoded.bytes).includes("DO_NOT_PUBLISH"),
    false,
  );
  // A caller object cannot change previously encoded bytes through retained aliases.
  hostile.title = "Different task";
  hostile.recipients[0].secret = "changed";
  assert.equal(
    encoded.digest,
    `0x${createHash("sha256").update(encoded.bytes).digest("hex")}`,
  );
  assert.equal(encoded.terms.title, terms.title);
});

test("every financial field is bound to the expected escrow job", () => {
  assert.equal(matches(terms), true);
  for (const [field, value] of Object.entries({
    chainId: 43114,
    escrow: address(1),
    client: address(2),
    token: address(3),
    qualificationClass: "8",
    amount: "250000002",
    acceptBefore: 1900000001,
    submitBefore: 1900003601,
    reviewBefore: 1900007201,
  })) {
    const altered = publicTerms({ ...terms, [field]: value });
    assert.equal(matches(altered), false, field);
    assert.notEqual(
      encodeTerms(altered).digest,
      encodeTerms(terms).digest,
      field,
    );
  }
  for (const index of [0, 2, 3, 4, 5, 6]) {
    const alteredJob = job();
    alteredJob[index] =
      index === 0 ? address(9) : BigInt(alteredJob[index]) + 1n;
    assert.equal(matches(terms, alteredJob), false, `job index ${index}`);
  }
  assert.equal(
    matchTerms(terms, 43114, terms.escrow, terms.token, job()),
    false,
  );
  assert.equal(
    matchTerms(terms, terms.chainId, address(9), terms.token, job()),
    false,
  );
  assert.equal(
    matchTerms(terms, terms.chainId, terms.escrow, address(9), job()),
    false,
  );
});

test("scope integrity and current job status require separate checks beyond economic matching", () => {
  for (const change of [
    { title: "Different authorization review" },
    { scope: "No tests required." },
  ]) {
    const altered = publicTerms({ ...terms, ...change });
    assert.equal(matches(altered), true); // Economic matching is deliberately not a content hash check.
    assert.notEqual(encodeTerms(altered).digest, encodeTerms(terms).digest);
  }
  const paid = job();
  paid[7] = 3;
  assert.equal(matches(terms, paid), true); // Listing verifier separately requires Open.
});

test("amount and qualification class retain exact integer limits without float coercion", () => {
  assert.equal(
    publicTerms({
      ...terms,
      amount: String(2n ** 256n - 1n),
      qualificationClass: String(2n ** 32n - 1n),
    }).amount,
    String(2n ** 256n - 1n),
  );
  for (const amount of [
    "0",
    "01",
    "+1",
    "-1",
    "1.0",
    "1e18",
    " 1",
    "1 ",
    1,
    1n,
    String(2n ** 256n),
  ])
    assert.throws(() => publicTerms({ ...terms, amount }), String(amount));
  for (const qualificationClass of ["0", "07", "-1", 7, String(2n ** 32n)])
    assert.throws(() => publicTerms({ ...terms, qualificationClass }));
  assert.equal(
    publicTerms({ ...terms, amount: "9007199254740993" }).amount,
    "9007199254740993",
  );
});

test("deadline and chain identifiers reject unsafe values and nonincreasing stages", () => {
  for (const chainId of [
    0,
    -1,
    1.1,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    "43113",
  ])
    assert.throws(() => publicTerms({ ...terms, chainId }));
  for (const field of ["acceptBefore", "submitBefore", "reviewBefore"])
    for (const value of [
      0,
      -1,
      1.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      "1900000000",
    ])
      assert.throws(() => publicTerms({ ...terms, [field]: value }));
  for (const change of [
    { acceptBefore: terms.submitBefore },
    { submitBefore: terms.acceptBefore },
    { submitBefore: terms.reviewBefore },
    { reviewBefore: terms.submitBefore },
  ])
    assert.throws(() => publicTerms({ ...terms, ...change }));
  const max = Number.MAX_SAFE_INTEGER;
  assert.equal(
    publicTerms({
      ...terms,
      acceptBefore: max - 2,
      submitBefore: max - 1,
      reviewBefore: max,
    }).reviewBefore,
    max,
  );
});

test("Unicode title byte limits and scope code-unit limits are enforced independently", () => {
  for (const title of ["a".repeat(100), "é".repeat(60), "🧪".repeat(30)])
    assert.equal(publicTerms({ ...terms, title }).title, title);
  for (const title of [
    "a".repeat(101),
    "é".repeat(61),
    "🧪".repeat(31),
    " \n\t",
  ])
    assert.throws(() => publicTerms({ ...terms, title }));
  for (const scope of ["a".repeat(4000), "🧪".repeat(2000)])
    assert.equal(publicTerms({ ...terms, scope }).scope, scope);
  for (const scope of ["a".repeat(4001), "🧪".repeat(2001), "\n\t "])
    assert.throws(() => publicTerms({ ...terms, scope }));
  // Exact user-visible text is committed; Unicode normalization is not silently applied.
  assert.notEqual(
    encodeTerms({ ...terms, title: "café" }).digest,
    encodeTerms({ ...terms, title: "cafe\u0301" }).digest,
  );
  assert.notEqual(
    encodeTerms({ ...terms, scope: "Task" }).digest,
    encodeTerms({ ...terms, scope: "Task " }).digest,
  );
});

test("unsupported domains, zero addresses and non-object terms fail closed", () => {
  for (const input of [null, undefined, [], false, 1, "terms"])
    assert.throws(() => publicTerms(input));
  for (const change of [
    { format: "review-result" },
    { version: 2 },
    { policy: "auto-pay-no-review" },
  ])
    assert.throws(() => publicTerms({ ...terms, ...change }));
  for (const field of ["client", "escrow", "token"])
    for (const value of [address(0), "0x12", "0x" + "g".repeat(40), 42])
      assert.throws(() => publicTerms({ ...terms, [field]: value }));
});

test("real upload signatures bind purpose, chain, escrow, client, scope digest and authorization expiry", async () => {
  const signer = privateKeyToAccount(generatePrivateKey()); // Ephemeral test key; never printed or persisted.
  const encoded = encodeTerms({ ...terms, client: signer.address });
  const expiresAt = 1900000100;
  const message = termsUploadMessage(encoded.terms, encoded.digest, expiresAt);
  const signature = await signer.signMessage({ message });
  assert.equal(
    await verifyMessage({ address: signer.address, message, signature }),
    true,
  );
  const messages = [
    termsUploadMessage(
      { ...encoded.terms, chainId: 43114 },
      encoded.digest,
      expiresAt,
    ),
    termsUploadMessage(
      { ...encoded.terms, escrow: address(9) },
      encoded.digest,
      expiresAt,
    ),
    termsUploadMessage(
      { ...encoded.terms, client: address(9) },
      encoded.digest,
      expiresAt,
    ),
    termsUploadMessage(
      encoded.terms,
      encodeTerms({ ...encoded.terms, amount: "1" }).digest,
      expiresAt,
    ),
    termsUploadMessage(
      encoded.terms,
      encodeTerms({ ...encoded.terms, scope: "Different scope" }).digest,
      expiresAt,
    ),
    termsUploadMessage(encoded.terms, encoded.digest, expiresAt + 1),
    uploadMessage(terms.chainId, terms.escrow, "1", encoded.digest, expiresAt),
  ];
  for (const altered of messages)
    assert.equal(
      await verifyMessage({
        address: signer.address,
        message: altered,
        signature,
      }),
      false,
    );
});
