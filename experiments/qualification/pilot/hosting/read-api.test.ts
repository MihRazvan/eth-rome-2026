// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import { sha256, bytesToHex } from "viem";
import {
  createPublicReadAPI,
  type PublicReadConfig,
  type ReadDependencies,
} from "./read-api";
import { encodeTerms } from "../terms";
const client = `0x${"1".repeat(40)}` as const;
const escrow = `0x${"2".repeat(40)}` as const;
const token = "0x5425890298aed601595a70ab815c96711a31bc65";
const ref = `0x${"3".repeat(64)}`;
const hash = `0x${"4".repeat(64)}`;
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
const digest = (v: Uint8Array) => sha256(bytesToHex(v));
function fixture() {
  const snapshot = bytes({
    root: "7",
    tree: { complete: true },
    allLeaves: [1, 2, 3],
  });
  const config: PublicReadConfig = {
    version: 1,
    status: "active",
    chainId: 43113,
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    gatewayUrl: "https://api.gateway.ethswarm.org",
    storageMode: "swarm-id",
    token,
    escrow,
    snapshot: { reference: ref.slice(2), sha256: digest(snapshot) },
    abi: { QualificationEscrow: [] },
  };
  const calls: Record<string, unknown>[] = [];
  let blockReads = 0;
  const terms = encodeTerms({
    format: "review-pass-public-terms",
    version: 1,
    chainId: 43113,
    escrow,
    client,
    token,
    qualificationClass: "1",
    amount: "10000000",
    acceptBefore: 100,
    submitBefore: 200,
    reviewBefore: 300,
    title: "Review contract",
    scope: "Check withdrawal authorization.",
    policy: "approval-timeout-arbitration-v1",
  });
  const job = [
    client,
    escrow,
    10000000n,
    1n,
    100n,
    200n,
    300n,
    2,
    terms.digest,
    ref,
  ];
  const document = bytes({
    format: "review-pass-recipient-document",
    ciphertext: "authenticated-encrypted-bytes",
  });
  const values: Record<string, unknown> = {
    revocationRoot: 7n,
    jobs: job,
    termsReferences: ref,
    documentDigests: digest(document),
  };
  const deps: ReadDependencies = {
    chain: {
      async getChainId() {
        return 43113;
      },
      async getBlock() {
        blockReads++;
        return { number: 42n, hash };
      },
      async readContract(args) {
        calls.push(args);
        return values[String(args.functionName)];
      },
    },
    async download(r) {
      return r.sha256 === terms.digest
        ? terms.bytes
        : r.sha256 === digest(document)
          ? document
          : snapshot;
    },
  };
  return {
    config,
    deps,
    calls,
    values,
    job,
    snapshot,
    terms,
    document,
    blockReads: () => blockReads,
  };
}
test("pending config is explicit, strips private top-level fields and performs no network work", async () => {
  const f = fixture();
  f.deps.chain!.getChainId = async () => {
    throw Error("must not run");
  };
  const api = createPublicReadAPI(
    {
      ...f.config,
      status: "pending",
      privateKey: "never-return",
      setupDir: "/private/setup",
    },
    f.deps,
  );
  const config = await api("/api/config");
  assert.equal(config.status, 200);
  assert.equal(JSON.stringify(config).includes("never-return"), false);
  assert.equal(JSON.stringify(config).includes("/private/setup"), false);
  for (const path of [
    "/api/snapshot",
    "/api/terms?job=1",
    "/api/document?job=1",
  ])
    assert.equal((await api(path)).status, 503);
});
test("only GET and exact bounded routes/queries are accepted", async () => {
  const f = fixture(),
    api = createPublicReadAPI(f.config, f.deps);
  for (const method of ["POST", "PUT", "DELETE", "PATCH", "HEAD"])
    assert.equal((await api("/api/config", method)).status, 405);
  for (const path of [
    "/api/terms",
    "/api/terms?job=0",
    "/api/terms?job=-1",
    "/api/terms?job=01",
    "/api/terms?job=99999999999999999999",
    "/api/terms?job=1&job=2",
    "/api/terms?job=1&url=https://attacker.invalid",
    "/api/config?secret=1",
    "/api/snapshot#fragment",
    "https://attacker.invalid/api/config",
    `/api/terms?job=${"1".repeat(300)}`,
  ])
    assert.equal((await api(path)).status, 400, path);
  assert.equal((await api("/api/upload")).status, 404);
  assert.equal(f.calls.length, 0);
});
test("whole snapshot authenticated against pinned finalized root; no credential-specific lookup", async () => {
  const f = fixture(),
    result = await createPublicReadAPI(f.config, f.deps)("/api/snapshot");
  assert.equal(result.status, 200);
  assert.deepEqual(
    result.body,
    JSON.parse(new TextDecoder().decode(f.snapshot)),
  );
  assert.equal(f.calls[0].blockNumber, 42n);
  assert.equal(f.blockReads(), 2);
});
test("stale root and tampered snapshot both fail without data fallback", async () => {
  const stale = fixture();
  stale.values.revocationRoot = 8n;
  assert.equal(
    (await createPublicReadAPI(stale.config, stale.deps)("/api/snapshot"))
      .status,
    409,
  );
  const tamper = fixture();
  tamper.deps.download = async () => bytes({ root: "7", changed: true });
  assert.equal(
    (await createPublicReadAPI(tamper.config, tamper.deps)("/api/snapshot"))
      .status,
    502,
  );
});
test("terms require authenticated exact economics and read every contract field at one finalized block", async () => {
  const f = fixture(),
    result = await createPublicReadAPI(f.config, f.deps)("/api/terms?job=1");
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    terms: f.terms.terms,
    reference: ref,
    digest: f.terms.digest,
  });
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls.every((c) => c.blockNumber === 42n));
  f.job[2] = 20000000n;
  assert.equal(
    (await createPublicReadAPI(f.config, f.deps)("/api/terms?job=1")).status,
    502,
  );
});
test("document digest and locator are chain-derived; missing and corrupt documents reject", async () => {
  const f = fixture(),
    api = createPublicReadAPI(f.config, f.deps);
  const result = await api("/api/document?job=1");
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    envelope: JSON.parse(new TextDecoder().decode(f.document)),
    reference: ref,
    digest: digest(f.document),
  });
  assert.ok(f.calls.every((c) => c.blockNumber === 42n));
  f.deps.download = async () => bytes({ ciphertext: "replacement" });
  assert.equal(
    (await createPublicReadAPI(f.config, f.deps)("/api/document?job=1")).status,
    502,
  );
  f.values.documentDigests = `0x${"0".repeat(64)}`;
  assert.equal((await api("/api/document?job=1")).status, 404);
});
test("changed canonical block rejects otherwise valid documents", async () => {
  const f = fixture();
  let n = 0;
  f.deps.chain!.getBlock = async () => ({
    number: 42n,
    hash: n++ ? `0x${"5".repeat(64)}` : hash,
  });
  assert.equal(
    (await createPublicReadAPI(f.config, f.deps)("/api/terms?job=1")).status,
    503,
  );
});
test("RPC errors are sanitized, wrong chain rejected, and stuck reads time out", async () => {
  const f = fixture();
  f.deps.chain!.getChainId = async () => {
    throw Error("https://rpc.invalid/?secret=credential");
  };
  const result = await createPublicReadAPI(f.config, f.deps)("/api/snapshot");
  assert.equal(result.status, 502);
  assert.equal(JSON.stringify(result).includes("credential"), false);
  f.deps.chain!.getChainId = async () => 31338;
  assert.equal(
    (await createPublicReadAPI(f.config, f.deps)("/api/snapshot")).status,
    503,
  );
  f.deps.chain!.getChainId = async () => new Promise<number>(() => {});
  assert.equal(
    (
      await createPublicReadAPI(f.config, { ...f.deps, timeoutMs: 10 })(
        "/api/snapshot",
      )
    ).status,
    504,
  );
});
test("invalid public deployment configuration cannot become an active hosted endpoint", () => {
  const f = fixture();
  for (const patch of [
    { chainId: 31338 },
    { status: "unknown" },
    { storageMode: "local-bee" },
    { token: client },
    { rpcUrl: "https://rpc.invalid?apiKey=secret" },
    { gatewayUrl: "http://127.0.0.1:1633" },
  ])
    assert.throws(() =>
      createPublicReadAPI(
        { ...f.config, ...patch } as PublicReadConfig,
        f.deps,
      ),
    );
});

test("gateway-funded storage keeps authenticated reads and a read-only hosted API", async () => {
  const f = fixture();
  f.config.storageMode = "swarm-gateway";
  const api = createPublicReadAPI(f.config, f.deps);
  const config = await api("/api/config");
  assert.equal((config.body as PublicReadConfig).storageMode, "swarm-gateway");
  assert.equal((await api("/api/snapshot")).status, 200);
  assert.equal((await api("/api/terms?job=1")).status, 200);
  assert.equal((await api("/api/upload", "POST")).status, 405);
});
