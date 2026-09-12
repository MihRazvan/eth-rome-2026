import test from "node:test";
import assert from "node:assert/strict";
import {
  assignmentAttributes,
  assignmentIndex,
  assignmentQuery,
  arkivAssignmentDriver,
  publicAssignment,
  type Assignment,
  type AssignmentPage,
} from "./assignment";
const a: Assignment = {
  taskClass: "document-review",
  qualificationClass: "1",
  reward: "20000000",
  paymentToken: `0x${"11".repeat(20)}`,
  acceptBefore: 2000000000,
  settlementChain: 43113,
  escrow: `0x${"22".repeat(20)}`,
  jobId: "4",
  encryptedBrief: {
    reference: "33".repeat(32),
    sha256: `0x${"44".repeat(32)}`,
  },
};
const filter = {
  taskClass: a.taskClass,
  qualificationClass: a.qualificationClass,
  settlementChain: a.settlementChain,
  escrow: a.escrow,
};
const page = (
  values: unknown[],
  next?: () => Promise<AssignmentPage>,
): AssignmentPage => ({
  entities: values.map((value) => ({
    key: `0x${"55".repeat(32)}`,
    payload: new TextEncoder().encode(JSON.stringify(value)),
  })),
  hasNextPage: () => !!next,
  next:
    next ??
    (() => {
      throw Error("No page");
    }),
});
test("public projection strips top-level and nested holder identifiers, private text and keys", () => {
  const secret = {
    ...a,
    holderWallet: "PRIVATE",
    credentialId: "PRIVATE",
    profile: "PRIVATE",
    brief: "PRIVATE",
    encryptedBrief: {
      ...a.encryptedBrief,
      key: "PRIVATE",
      credentialIndex: "PRIVATE",
    },
  };
  const projected = publicAssignment(secret);
  assert.deepEqual(projected, a);
  assert.equal(JSON.stringify(projected).includes("PRIVATE"), false);
  assert.equal(
    JSON.stringify(assignmentAttributes(secret), (_, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ).includes("PRIVATE"),
    false,
  );
  assert.equal(Object.keys(assignmentAttributes(secret)).length, 9);
});
test("privacy format rejects free-text classes, key-bearing refs, unsafe amounts and out-of-circuit classes", () => {
  for (const v of [
    { ...a, taskClass: "Review Alice medical record" },
    { ...a, qualificationClass: "4294967296" },
    { ...a, qualificationClass: "01" },
    { ...a, reward: "1e6" },
    { ...a, reward: "0" },
    { ...a, reward: 2 ** 60 },
    {
      ...a,
      encryptedBrief: { ...a.encryptedBrief, reference: "33".repeat(64) },
    },
  ])
    assert.throws(() => publicAssignment(v as Assignment));
});
test("query binds class, chain, escrow and strict acceptance deadline using typed uint64", () => {
  const query = assignmentQuery(filter, 1900000000).map(String).join(" AND ");
  for (const value of [
    "taskClass",
    "qualificationClass",
    "settlementChain",
    "escrow",
    "acceptBefore > u64(1900000000)",
  ])
    assert.ok(query.includes(value));
  assert.equal(query.includes("holder"), false);
});
test("all pages verified; poisoned duplicate cannot suppress genuine record; expired/wrong chain ignored", async () => {
  let second = 0,
    verified = 0;
  const driver = {
    environment: "local-test" as const,
    query: async () =>
      page(
        [
          { ...a, reward: "1" },
          { ...a, acceptBefore: 1900000000 },
          { ...a, settlementChain: 1 },
        ],
        async () => {
          second++;
          return page([a, a]);
        },
      ),
    publish: async () => ({ entityKey: `0x11` as const }),
  };
  const rows = await assignmentIndex(
    driver,
    async (value) => {
      verified++;
      return value.reward === a.reward;
    },
    () => 1900000000,
  ).discover(filter);
  assert.equal(rows.length, 1);
  assert.equal(second, 1);
  assert.equal(verified, 2);
});
test("contract rejection and read failure cannot become available assignment or publication", async () => {
  let writes = 0;
  const driver = {
    environment: "local-test" as const,
    query: async () => page([a]),
    publish: async () => {
      writes++;
      return { entityKey: "0x11" as const };
    },
  };
  assert.deepEqual(
    await assignmentIndex(
      driver,
      async () => false,
      () => 1900000000,
    ).discover(filter),
    [],
  );
  await assert.rejects(
    assignmentIndex(
      driver,
      async () => false,
      () => 1900000000,
    ).publish(a),
    /blocked/,
  );
  await assert.rejects(
    assignmentIndex(
      driver,
      async () => {
        throw Error("https://secret-provider/?key=secret");
      },
      () => 1900000000,
    ).discover(filter),
    (e) =>
      e instanceof Error &&
      !e.message.includes("secret") &&
      e.message.includes("no fallback"),
  );
  assert.equal(writes, 0);
});
test("deadline passing during contract read removes assignment; publication projects nested extras", async () => {
  let now = 1900000000,
    saved: Assignment | undefined;
  const driver = {
    environment: "local-test" as const,
    query: async () => page([a]),
    publish: async (v: Assignment) => {
      saved = v;
      return { entityKey: "0x11" as const };
    },
  };
  assert.deepEqual(
    await assignmentIndex(
      driver,
      async () => {
        now = a.acceptBefore;
        return true;
      },
      () => now,
    ).discover(filter),
    [],
  );
  now = 1900000000;
  await assignmentIndex(
    driver,
    async () => true,
    () => now,
  ).publish({
    ...a,
    encryptedBrief: { ...a.encryptedBrief, key: "secret" },
  } as Assignment);
  assert.deepEqual(saved, a);
});
test("unconfigured live publishing reports explicit funded-account gate without network write", async () => {
  await assert.rejects(
    arkivAssignmentDriver({}).publish(a),
    /Funded Arkiv account required/,
  );
});
