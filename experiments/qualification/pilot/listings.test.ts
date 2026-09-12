import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "@arkiv-network/sdk/query";
import {
  createListingBoard,
  projectListing,
  listingAttributes,
  listingQuery,
  type Listing,
  type ListingFilter,
  type ListingDriver,
  type ListingPage,
  type ListingStream,
  type BoardState,
} from "./listings";
const a = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as const;
const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as const;
const listing: Listing = {
  schema: 2,
  taskClass: "technical-review",
  qualificationClass: "7",
  settlementChain: 43113,
  escrow: a(1),
  jobId: "1",
  client: a(2),
  paymentToken: a(3),
  reward: "5000000",
  acceptBefore: 2000000000,
  title: "Review a contract change",
  publicScope: { reference: "a".repeat(64), sha256: k(4) },
};
const filter: ListingFilter = {
  namespace: "review-pass",
  taskClass: "technical-review",
  qualificationClass: "7",
  settlementChain: 43113,
  escrow: a(1),
};
function entity(id = 1, overrides: Partial<Listing> = {}) {
  const l = { ...listing, jobId: String(id), ...overrides };
  const attrs = listingAttributes(filter.namespace, l);
  return {
    key: k(id),
    owner: l.client,
    creator: l.client,
    expiresAt: 20n,
    creationFlags: { readonly: true, permissionlessExtension: false },
    payload: new TextEncoder().encode(JSON.stringify(l)),
    attributes: Object.fromEntries(
      Object.entries(attrs).map(([n, v]) => [
        n,
        typeof v === "string"
          ? { type: "str", value: v }
          : typeof v === "number"
            ? { type: "i32", value: v }
            : v,
      ]),
    ),
  };
}
function page(
  entities: unknown[],
  blockNumber = 10n,
  next?: ListingPage,
): ListingPage {
  return {
    entities,
    blockNumber,
    hasNextPage: () => !!next,
    next: async () => next!,
  };
}
const tick = () => new Promise<void>((r) => setImmediate(r));
function harness(
  verify: Parameters<typeof createListingBoard>[0]["verify"] = async () => true,
) {
  let snapshot = page([entity()]),
    streams: ListingStream[] = [];
  let queries = 0,
    gets = 0,
    stops = 0;
  let getter: ListingDriver["get"] = async (key) =>
    snapshot.entities.find((x: any) => x.key === key) ?? null;
  let query: ListingDriver["query"] = async () => snapshot;
  const states: BoardState[] = [];
  const driver: ListingDriver = {
    query: async (f) => {
      queries++;
      return query(f);
    },
    get: async (key) => {
      gets++;
      return getter(key);
    },
    watch: (s) => {
      streams.push(s);
      return () => {
        stops++;
      };
    },
  };
  const board = createListingBoard({
    driver,
    verify,
    onState: (s) => states.push(s),
  });
  return {
    board,
    states,
    set: (p: ListingPage) => (snapshot = p),
    setGetter: (g: typeof getter) => (getter = g),
    setQuery: (q: typeof query) => (query = q),
    stream: () => streams.at(-1)!,
    oldStream: () => streams[0]!,
    counts: () => ({ queries, gets, stops }),
    last: () => states.at(-1)!,
  };
}
test("projection strips secret fields and rejects malformed amounts, UTF8 lengths and refs", () => {
  const safe = projectListing({
    ...listing,
    holderSecret: "secret",
    publicScope: { ...listing.publicScope, credential: "secret" },
  });
  assert.equal(JSON.stringify(safe).includes("secret"), false);
  for (const change of [
    { reward: "01" },
    { reward: String(2n ** 256n) },
    { qualificationClass: "4294967296" },
    { acceptBefore: 1.5 },
    { title: "🧪".repeat(31) },
    { publicScope: { reference: "x", sha256: k(1) } },
    { schema: 1 },
  ])
    assert.throws(() => projectListing({ ...listing, ...change }));
});
test("lowercase typed compound query remains fixed over clock changes", () => {
  const q = listingQuery({
    ...filter,
    minimumReward: "123",
    paymentToken: a(3),
  }).map(render);
  assert.equal(q.length, 9);
  assert(q.includes("reward >= u256(123)"));
  assert(q.every((x) => !x.includes("acceptbefore")));
  assert.deepEqual(
    q,
    listingQuery({ ...filter, minimumReward: "123", paymentToken: a(3) }).map(
      render,
    ),
  );
  assert(
    Object.keys(listingAttributes(filter.namespace, listing)).every(
      (x) => x === x.toLowerCase(),
    ),
  );
});
test("complete pagination, strict metadata, invalid duplicate cannot suppress authentic job", async () => {
  const h = harness(async (e) => e.key !== k(2));
  const invalid = entity();
  invalid.owner = a(8);
  h.set(page([invalid, entity(2, { jobId: "1" })], 10n, page([entity()], 10n)));
  await h.board.start(filter);
  assert.deepEqual(
    h.last().listings.map((x) => x.key),
    [k(1)],
  );
  h.board.stop();
});
test("query failure and verification failure preserve prior list as unavailable", async () => {
  let fail = false;
  const h = harness(async () => {
    if (fail) throw Error("RPC");
    return true;
  });
  await h.board.start(filter);
  fail = true;
  await h.board.refresh();
  assert.equal(h.last().status, "error");
  assert.equal(h.last().listings.length, 1);
  assert.equal(h.last().removed.length, 0);
  h.board.stop();
});
test("head expiry requires successful fresh absence and reports native lease removal", async () => {
  const h = harness();
  await h.board.start(filter);
  h.stream().onHead(11n);
  await tick();
  let release!: (x: ListingPage) => void;
  h.setQuery(() => new Promise((r) => (release = r)));
  h.stream().onHead(20n);
  assert.equal(h.last().listings.length, 1);
  release(page([], 20n));
  await tick();
  assert.equal(h.last().listings.length, 0);
  assert.equal(h.last().removed[0].reason, "native-expired");
  h.board.stop();
});
test("explicit delete is never presented as native expiry", async () => {
  const h = harness();
  await h.board.start(filter);
  h.set(page([], 21n));
  h.stream().onEntity(k(1), "EntityDeleted");
  await tick();
  assert.equal(h.last().removed[0].reason, "no-longer-listed");
  h.board.stop();
});
test("renewal updates boundary and earlier head does not remove work", async () => {
  const h = harness();
  await h.board.start(filter);
  h.stream().onHead(11n);
  await tick();
  h.set(page([{ ...entity(), expiresAt: 40n }], 12n));
  h.stream().onEntity(k(1), "ExpiryExtended");
  await tick();
  const before = h.counts().queries;
  h.stream().onHead(20n);
  await tick();
  assert.equal(h.counts().queries, before);
  assert.equal(h.last().listings[0].expiresAt, 40n);
  h.board.stop();
});
test("irrelevant events skip refresh; matching new entity refreshes board", async () => {
  const h = harness();
  await h.board.start(filter);
  const before = h.counts().queries;
  h.stream().onEntity(k(9));
  await tick();
  assert.equal(h.counts().queries, before);
  h.set(page([entity(), entity(2)]));
  h.stream().onEntity(k(2));
  await tick();
  await tick();
  assert.equal(h.last().listings.length, 2);
  h.board.stop();
});
test("disconnect marks stale and resumed head catches missed creation without replay watcher", async () => {
  const h = harness();
  await h.board.start(filter);
  h.stream().onHead(11n);
  await tick();
  h.stream().onDisconnect();
  assert.equal(h.last().status, "stale");
  h.set(page([entity(), entity(2)], 13n));
  h.stream().onHead(13n);
  await tick();
  assert.equal(h.last().status, "live");
  assert.equal(h.last().listings.length, 2);
  h.board.stop();
});
test("initial read race reconciles dirty event and stale stopped results never repaint", async () => {
  const h = harness();
  let release!: (x: ListingPage) => void;
  let first = true;
  h.setQuery(() =>
    first
      ? ((first = false), new Promise((r) => (release = r)))
      : Promise.resolve(page([entity(), entity(2)], 12n)),
  );
  const started = h.board.start(filter);
  h.stream().onHead(11n);
  release(page([entity()], 10n));
  await started;
  assert.equal(h.last().listings.length, 2);
  const old = h.oldStream();
  h.board.stop();
  const n = h.counts().queries;
  old.onHead(30n);
  old.onEntity(k(2));
  await tick();
  assert.equal(h.counts().queries, n);
  assert.equal(h.last().status, "stopped");
});
test("bounded event hydration under a burst", async () => {
  const h = harness();
  await h.board.start(filter);
  const releases: Array<() => void> = [];
  h.setGetter(() => new Promise((r) => releases.push(() => r(null))));
  for (let i = 20; i < 220; i++) h.stream().onEntity(k(i));
  assert.equal(h.counts().gets, 4);
  h.board.stop();
  releases.forEach((r) => r());
  await tick();
  assert.equal(h.last().status, "stopped");
});
test("raw attributes and current creator cannot spoof authoritative payload", async () => {
  const h = harness();
  const x = entity();
  x.attributes.qualificationclass = { type: "str", value: "8" };
  const y = entity(2);
  y.creator = a(8);
  h.set(page([x, y]));
  await h.board.start(filter);
  assert.equal(h.last().listings.length, 0);
  h.board.stop();
});

test("a transient hydration outage recovers on a real head without a matching event", async () => {
  const h = harness();
  await h.board.start(filter);
  h.stream().onHead(11n);
  await tick();
  h.setGetter(async () => {
    throw Error("temporary RPC outage");
  });
  h.stream().onEntity(k(9));
  await tick();
  assert.equal(h.last().status, "stale");
  assert.equal(h.last().listings.length, 1);
  const before = h.counts().queries;
  await tick();
  assert.equal(
    h.counts().queries,
    before,
    "no timer polling disguises the outage",
  );
  h.set(page([entity(), entity(2)], 12n));
  h.stream().onHead(12n);
  await tick();
  assert.equal(h.counts().queries, before + 1);
  assert.equal(h.last().status, "live");
  assert.equal(h.last().reason, undefined);
  assert.equal(h.last().listings.length, 2);
  h.stream().onHead(13n);
  await tick();
  assert.equal(
    h.counts().queries,
    before + 1,
    "healthy heads do not poll snapshots",
  );
  h.board.stop();
});

test("a failed reconciliation retries on a subsequent stream head and remains single-flight", async () => {
  const h = harness();
  await h.board.start(filter);
  h.stream().onHead(11n);
  await tick();
  h.setQuery(async () => {
    throw Error("temporary query outage");
  });
  await h.board.refresh();
  assert.equal(h.last().status, "error");
  let release!: (x: ListingPage) => void;
  h.setQuery(() => new Promise((r) => (release = r)));
  const before = h.counts().queries;
  h.stream().onHead(12n);
  h.stream().onHead(13n);
  h.stream().onHead(14n);
  assert.equal(h.counts().queries, before + 1);
  assert.equal(
    h.last().status,
    "error",
    "stream health alone cannot authenticate listings",
  );
  release(page([entity(), entity(2)], 14n));
  await tick();
  assert.equal(h.last().status, "live");
  assert.equal(h.last().listings.length, 2);
  h.board.stop();
});
