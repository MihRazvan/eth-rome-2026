import test from "node:test";
import assert from "node:assert/strict";
import { bytesToHex, sha256 } from "viem";
import { beeBytes, downloadIssuerSnapshot, type SnapshotRef } from "./bytes";
import { encryptJobDocument, decryptJobDocument } from "./cipher";
import { statusAttributes } from "./arkiv";
const context = {
  chainId: 43113,
  contract: `0x${"11".repeat(20)}`,
  jobId: "7",
  version: 1 as const,
};
const fixture = {
  issuerId: "test-issuer",
  epoch: 2,
  root: "123",
  authority: `0x${"22".repeat(20)}` as `0x${string}`,
  chainId: 43113,
  reference: "aa".repeat(32),
  sha256: `0x${"bb".repeat(32)}` as `0x${string}`,
} satisfies SnapshotRef;
const bytes = new TextEncoder().encode(
  "private job scope: oxygen-maintenance-qualification",
);
test("AES-GCM round trip; upload envelope excludes document/key; key cannot be exported", async () => {
  const encrypted = await encryptJobDocument(bytes, context);
  assert.deepEqual(
    await decryptJobDocument(encrypted.envelope, encrypted.key, context),
    bytes,
  );
  assert(
    !new TextDecoder()
      .decode(encrypted.envelope)
      .includes("oxygen-maintenance"),
  );
  await assert.rejects(crypto.subtle.exportKey("raw", encrypted.key));
});
test("cross-job/chain/contract and tampered ciphertext fail authentication", async () => {
  const e = await encryptJobDocument(bytes, context);
  for (const c of [
    { ...context, jobId: "8" },
    { ...context, chainId: 1 },
    { ...context, contract: `0x${"33".repeat(20)}` },
  ])
    await assert.rejects(decryptJobDocument(e.envelope, e.key, c));
  const v = JSON.parse(new TextDecoder().decode(e.envelope));
  v.ciphertext =
    (v.ciphertext.startsWith("00") ? "ff" : "00") + v.ciphertext.slice(2);
  await assert.rejects(
    decryptJobDocument(
      new TextEncoder().encode(JSON.stringify(v)),
      e.key,
      context,
    ),
  );
});
test("whole snapshot download has one content URL; mismatch with current root fails before retrieval", async () => {
  const document = new TextEncoder().encode('{"allIssuerLeaves":[0,0,1]}');
  const urls: string[] = [];
  const provider = beeBytes({
    environment: "local-bee",
    uploadUrl: "http://127.0.0.1:1633",
    downloadUrl: "http://127.0.0.1:1635",
    postageBatchId: "aa".repeat(32),
    fetch: async (url) => {
      urls.push(String(url));
      return new Response(document);
    },
  });
  const ref = { ...fixture, sha256: sha256(bytesToHex(document)) };
  const full = await downloadIssuerSnapshot(
    provider,
    ref,
    fixture,
    async (value) => value.length === document.length,
  );
  assert.deepEqual(full, document);
  assert.deepEqual(urls, [`http://127.0.0.1:1635/bytes/${ref.reference}`]);
  await assert.rejects(
    downloadIssuerSnapshot(
      provider,
      ref,
      { ...fixture, root: "999" },
      async () => true,
    ),
  );
  assert.equal(urls.length, 1);
  await assert.rejects(
    downloadIssuerSnapshot(provider, ref, fixture, async () => false),
  );
});
test("integrity failure and excessive streamed download rejected; never trusts gateway bytes", async () => {
  for (const maxBytes of [1, 1000]) {
    const provider = beeBytes({
      environment: "local-bee",
      uploadUrl: "http://localhost:1633",
      downloadUrl: "http://localhost:1635",
      postageBatchId: "aa".repeat(32),
      maxBytes,
      fetch: async () => new Response(bytes),
    });
    await assert.rejects(provider.download(fixture));
  }
});
test("ordinary byte references only and sanitized provider failure", async () => {
  const provider = beeBytes({
    environment: "public-swarm",
    uploadUrl: "https://example.invalid/auth-secret",
    downloadUrl: "https://example.invalid",
    postageBatchId: "aa".repeat(32),
    fetch: async () => {
      throw Error("SECRET_URL_AND_PAYLOAD");
    },
  });
  await assert.rejects(
    provider.upload(bytes),
    (e) => e instanceof Error && !e.message.includes("SECRET"),
  );
  await assert.rejects(
    provider.download({ ...fixture, reference: "ab".repeat(64) }),
  );
  assert.throws(() =>
    beeBytes({
      environment: "local-bee",
      uploadUrl: "https://public.example",
      downloadUrl: "http://localhost",
      postageBatchId: "aa".repeat(32),
    }),
  );
});
test("public issuer attributes never serialize credential-specific fields", () => {
  const attrs = statusAttributes({
    ...fixture,
    credentialIndex: 9,
    credentialId: "private",
    holderSecret: "secret",
  } as typeof fixture);
  assert.equal(Object.keys(attrs).length, 8);
  for (const forbidden of [
    "credentialIndex",
    "credentialId",
    "holderSecret",
    "reference",
  ])
    assert(!(forbidden in attrs));
});
