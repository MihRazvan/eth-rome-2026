import {
  createPublicClient,
  createWalletClient,
  NoEntityFoundError,
} from "@arkiv-network/sdk";
import { watchBlockNumber, getChainId, getAddresses } from "viem/actions";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { u64, u256 } from "@arkiv-network/sdk/attr";
import { eq, gte } from "@arkiv-network/sdk/query";
import { ExpirationTime } from "@arkiv-network/sdk/utils";
import { http, webSocket, type Account, type Hex, type Transport } from "viem";

export type Listing = {
  schema: 2;
  taskClass: "technical-review";
  qualificationClass: string;
  settlementChain: number;
  escrow: Hex;
  jobId: string;
  client: Hex;
  paymentToken: Hex;
  reward: string;
  acceptBefore: number;
  title: string;
  publicScope: { reference: string; sha256: Hex };
};
export type ListingFilter = {
  namespace: string;
  taskClass: "technical-review";
  qualificationClass: string;
  settlementChain: number;
  escrow: Hex;
  paymentToken?: Hex;
  minimumReward?: string;
};
export type ListingEntity = {
  key: Hex;
  owner: Hex;
  creator: Hex;
  expiresAt: bigint;
  readonly: boolean;
  permissionlessExtension: boolean;
  listing: Listing;
};
export type ListingPage = {
  entities: readonly unknown[];
  blockNumber: bigint;
  hasNextPage(): boolean;
  next(): Promise<ListingPage>;
};
export type ListingStream = {
  onEntity(key: Hex, type?: string): void;
  onHead(block: bigint): void;
  onDisconnect(): void;
};
export type ListingDriver = {
  query(filter: ListingFilter): Promise<ListingPage>;
  get(key: Hex): Promise<unknown | null>;
  watch(stream: ListingStream): () => void;
};
export type BoardState = {
  status: "connecting" | "live" | "stale" | "error" | "stopped";
  listings: readonly ListingEntity[];
  removed: readonly {
    key: Hex;
    reason: "native-expired" | "no-longer-listed";
  }[];
  head: bigint | null;
  reason?: string;
};
const enc = new TextEncoder();
const address = (x: unknown): x is Hex =>
  typeof x === "string" && /^0x[0-9a-f]{40}$/i.test(x) && !/^0x0{40}$/i.test(x);
const hash = (x: unknown): x is Hex =>
  typeof x === "string" && /^0x[0-9a-f]{64}$/i.test(x);
const uint = (x: unknown, bits = 256): x is string =>
  typeof x === "string" &&
  /^(0|[1-9][0-9]{0,77})$/.test(x) &&
  BigInt(x) < 2n ** BigInt(bits);
const object = (x: unknown): x is Record<string, any> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const lower = (x: Hex) => x.toLowerCase() as Hex;
export function projectListing(value: unknown): Listing {
  if (
    !object(value) ||
    value.schema !== 2 ||
    value.taskClass !== "technical-review" ||
    !uint(value.qualificationClass, 32) ||
    !Number.isSafeInteger(value.settlementChain) ||
    value.settlementChain < 1 ||
    value.settlementChain > 2147483647 ||
    !address(value.escrow) ||
    !uint(value.jobId) ||
    !address(value.client) ||
    !address(value.paymentToken) ||
    !uint(value.reward) ||
    value.reward === "0" ||
    !Number.isSafeInteger(value.acceptBefore) ||
    value.acceptBefore < 1 ||
    typeof value.title !== "string" ||
    !value.title.trim() ||
    enc.encode(value.title).length > 120 ||
    !object(value.publicScope) ||
    typeof value.publicScope.reference !== "string" ||
    !/^[0-9a-f]{64}$/i.test(value.publicScope.reference) ||
    !hash(value.publicScope.sha256)
  )
    throw Error("Invalid public listing");
  return {
    schema: 2,
    taskClass: value.taskClass,
    qualificationClass: value.qualificationClass,
    settlementChain: value.settlementChain,
    escrow: lower(value.escrow),
    jobId: value.jobId,
    client: lower(value.client),
    paymentToken: lower(value.paymentToken),
    reward: value.reward,
    acceptBefore: value.acceptBefore,
    title: value.title,
    publicScope: {
      reference: value.publicScope.reference.toLowerCase(),
      sha256: lower(value.publicScope.sha256),
    },
  };
}
function namespace(value: string) {
  if (typeof value !== "string" || !value || enc.encode(value).length > 128)
    throw Error("Invalid listing namespace");
  return value;
}
export function listingAttributes(ns: string, value: Listing) {
  const a = projectListing(value);
  return {
    application: namespace(ns),
    kind: "review-listing",
    schema: 2,
    taskclass: a.taskClass,
    qualificationclass: a.qualificationClass,
    settlementchain: a.settlementChain,
    escrow: a.escrow,
    jobid: a.jobId,
    paymenttoken: a.paymentToken,
    reward: u256(BigInt(a.reward)),
    acceptbefore: u64(BigInt(a.acceptBefore)),
  };
}
export function listingQuery(f: ListingFilter) {
  if (
    f.taskClass !== "technical-review" ||
    !uint(f.qualificationClass, 32) ||
    !address(f.escrow) ||
    !Number.isSafeInteger(f.settlementChain) ||
    f.settlementChain < 1 ||
    f.settlementChain > 2147483647 ||
    (f.paymentToken !== undefined && !address(f.paymentToken)) ||
    (f.minimumReward !== undefined && !uint(f.minimumReward))
  )
    throw Error("Invalid listing filter");
  return [
    eq("application", namespace(f.namespace)),
    eq("kind", "review-listing"),
    eq("schema", 2),
    eq("taskclass", f.taskClass),
    eq("qualificationclass", f.qualificationClass),
    eq("settlementchain", f.settlementChain),
    eq("escrow", lower(f.escrow)),
    ...(f.paymentToken ? [eq("paymenttoken", lower(f.paymentToken))] : []),
    ...(f.minimumReward !== undefined
      ? [gte("reward", u256(BigInt(f.minimumReward)))]
      : []),
  ];
}
/** The adapter intentionally accepts raw entities, validating indexed fields against payload fields. */
function parseEntity(raw: unknown, f: ListingFilter): ListingEntity | null {
  try {
    if (
      !object(raw) ||
      !hash(raw.key) ||
      !address(raw.owner) ||
      !address(raw.creator) ||
      typeof raw.expiresAt !== "bigint" ||
      raw.expiresAt < 0n ||
      !(raw.payload instanceof Uint8Array) ||
      raw.payload.length > 4096 ||
      !object(raw.creationFlags) ||
      raw.creationFlags.readonly !== true ||
      raw.creationFlags.permissionlessExtension !== false ||
      !object(raw.attributes)
    )
      return null;
    const listing = projectListing(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw.payload)),
    );
    if (
      listing.taskClass !== f.taskClass ||
      listing.qualificationClass !== f.qualificationClass ||
      listing.settlementChain !== f.settlementChain ||
      listing.escrow !== lower(f.escrow) ||
      (f.paymentToken && listing.paymentToken !== lower(f.paymentToken)) ||
      (f.minimumReward !== undefined &&
        BigInt(listing.reward) < BigInt(f.minimumReward))
    )
      return null;
    const attrs = listingAttributes(f.namespace, listing);
    for (const [name, expected] of Object.entries(attrs)) {
      const actual = raw.attributes[name];
      const expectedType =
        typeof expected === "string"
          ? "str"
          : typeof expected === "number"
            ? "i32"
            : expected.type;
      const expectedValue =
        typeof expected === "object" ? expected.value : expected;
      if (
        !object(actual) ||
        actual.type !== expectedType ||
        String(actual.value) !== String(expectedValue)
      )
        return null;
    }
    if (
      lower(raw.owner) !== listing.client ||
      lower(raw.creator) !== listing.client
    )
      return null;
    return {
      key: lower(raw.key),
      owner: lower(raw.owner),
      creator: lower(raw.creator),
      expiresAt: raw.expiresAt,
      readonly: true,
      permissionlessExtension: false,
      listing,
    };
  } catch {
    return null;
  }
}
/** verify must read trusted settlement chain state and exact public terms binding, or throw on unavailable RPC. */
export function createListingBoard(options: {
  driver: ListingDriver;
  verify(entity: ListingEntity): Promise<boolean>;
  onState(state: BoardState): void;
  maxHydrations?: number;
}) {
  const concurrency = options.maxHydrations ?? 4;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 16)
    throw Error("Invalid hydration concurrency");
  let generation = 0,
    filter: ListingFilter | null = null,
    stopStream: (() => void) | null = null;
  let state: BoardState = {
    status: "stopped",
    listings: [],
    removed: [],
    head: null,
  };
  let flight: Promise<void> | null = null,
    dirty = false,
    disconnected = false,
    boundary = 0n;
  let active = 0,
    connected = false,
    reconcileOnHead = false;
  const pending = new Set<Hex>();
  const deleted = new Set<Hex>();
  const emit = (patch: Partial<BoardState>) => {
    state = { ...state, ...patch };
    options.onState(state);
  };
  async function refresh(): Promise<void> {
    if (!filter) return;
    if (flight) {
      dirty = true;
      return flight;
    }
    const mine = generation,
      f = filter;
    const task = async () => {
      let rounds = 0;
      do {
        rounds++;
        dirty = false;
        try {
          let page = await options.driver.query(f),
            pages = 0,
            records = 0;
          const block = page.blockNumber,
            listings: ListingEntity[] = [],
            seen = new Set<string>();
          for (;;) {
            if (mine !== generation) return;
            if (page.blockNumber !== block || ++pages > 100)
              throw Error("Invalid or excessive listing pagination");
            for (const raw of page.entities) {
              if (++records > 10000)
                throw Error("Listing result limit exceeded");
              const e = parseEntity(raw, f);
              if (!e || !(await options.verify(e))) continue;
              if (mine !== generation) return;
              const id = `${e.listing.settlementChain}:${e.listing.escrow}:${e.listing.jobId}`;
              if (!seen.has(id)) {
                seen.add(id);
                listings.push(e);
              }
            }
            if (!page.hasNextPage()) break;
            page = await page.next();
          }
          if (mine !== generation) return;
          const keys = new Set(listings.map((x) => x.key));
          const removed = state.listings
            .filter((x) => !keys.has(x.key))
            .map((x) => ({
              key: x.key,
              reason:
                block >= x.expiresAt && !deleted.has(x.key)
                  ? ("native-expired" as const)
                  : ("no-longer-listed" as const),
            }));
          boundary = listings.reduce(
            (n, x) => (n === 0n || x.expiresAt < n ? x.expiresAt : n),
            0n,
          );
          emit({
            listings,
            removed,
            status: disconnected ? "stale" : connected ? "live" : "connecting",
            reason: undefined,
          });
          for (const key of deleted) if (!keys.has(key)) deleted.delete(key);
          // A head crossed expiry during a snapshot bound to an earlier block: reconcile once more.
          if (
            state.head !== null &&
            boundary !== 0n &&
            state.head >= boundary &&
            block < boundary
          )
            dirty = true;
        } catch {
          if (mine === generation) {
            // A failed read must not strand the board until a matching event happens.
            // Retry from the next real stream head, with the existing single-flight bound.
            reconcileOnHead = true;
            emit({
              status: "error",
              reason:
                "Listing discovery or settlement verification unavailable",
              removed: [],
            });
          }
        }
      } while (dirty && mine === generation && rounds < 2);
      if (dirty && mine === generation) {
        reconcileOnHead = true;
        emit({
          status: "stale",
          reason: "Stream changed during reconciliation",
        });
      }
    };
    const current = task();
    flight = current;
    try {
      await current;
    } finally {
      if (flight === current) flight = null;
    }
  }
  function pump(mine: number) {
    if (mine !== generation || !filter) return;
    while (active < concurrency && pending.size) {
      const key = pending.values().next().value!;
      pending.delete(key);
      active++;
      const f = filter;
      void options.driver
        .get(key)
        .then((raw) => {
          if (mine !== generation) return;
          if (state.listings.some((x) => x.key === key) || parseEntity(raw, f))
            void refresh();
        })
        .catch(() => {
          if (mine === generation) {
            // Even an unrelated event can fail to hydrate during a short RPC outage.
            // Reconcile the filtered snapshot once a subsequent WSS head arrives.
            reconcileOnHead = true;
            emit({
              status: "stale",
              reason: "Live listing hydration unavailable",
            });
          }
        })
        .finally(() => {
          if (mine === generation) {
            active--;
            pump(mine);
          }
        });
    }
  }
  function stop() {
    generation++;
    filter = null;
    stopStream?.();
    stopStream = null;
    pending.clear();
    active = 0;
    flight = null;
    dirty = false;
    boundary = 0n;
    disconnected = false;
    connected = false;
    reconcileOnHead = false;
    deleted.clear();
    emit({
      status: "stopped",
      listings: [],
      removed: [],
      head: null,
      reason: undefined,
    });
  }
  return {
    async start(f: ListingFilter) {
      listingQuery(f);
      stop();
      filter = { ...f };
      const mine = generation;
      emit({ status: "connecting" });
      stopStream = options.driver.watch({
        onEntity(key, type) {
          if (mine !== generation) return;
          if (
            type === "EntityDeleted" &&
            state.listings.some((x) => x.key === key)
          )
            deleted.add(key);
          if (state.listings.some((x) => x.key === key)) {
            void refresh();
            return;
          }
          if (pending.size >= 128) {
            pending.clear();
            emit({
              status: "stale",
              reason: "Live event backlog; reconciling",
            });
            void refresh();
            return;
          }
          pending.add(key);
          pump(mine);
        },
        onHead(head) {
          if (mine !== generation) return;
          state = { ...state, head };
          if (disconnected || !connected || reconcileOnHead) {
            disconnected = false;
            connected = true;
            reconcileOnHead = false;
            void refresh();
          } else if (boundary !== 0n && head >= boundary) {
            boundary = 0n;
            void refresh();
          }
        },
        onDisconnect() {
          if (mine === generation) {
            disconnected = true;
            emit({ status: "stale", reason: "Arkiv stream disconnected" });
          }
        },
      });
      await refresh();
    },
    refresh,
    stop,
  };
}
export function createArkivListingDriver(config: {
  rpcUrl?: string;
  wsUrl?: string;
  namespace: string;
  account?: Account;
  walletTransport?: Transport;
}) {
  namespace(config.namespace);
  const read = createPublicClient({
    chain: tiramisu,
    transport: http(config.rpcUrl, { timeout: 12000, retryCount: 0 }),
  });
  const check = async () => {
    if ((await read.getChainId()) !== tiramisu.id)
      throw Error("Wrong Arkiv chain");
  };
  const selection = {
    key: true,
    owner: true,
    creator: true,
    expiresAt: true,
    creationFlags: true,
    attributes: true,
    payload: true,
  } as const;
  return {
    async query(filter: ListingFilter): Promise<ListingPage> {
      if (filter.namespace !== config.namespace)
        throw Error("Wrong listing namespace");
      await check();
      return read
        .select(selection)
        .where(...listingQuery(filter))
        .limit(100)
        .fetch();
    },
    async get(key: Hex) {
      try {
        return await read.getEntity(key);
      } catch (error) {
        if (error instanceof NoEntityFoundError) return null;
        throw Error("Listing hydration unavailable");
      }
    },
    watch(stream: ListingStream) {
      const live = createPublicClient({
        chain: tiramisu,
        transport: webSocket(
          config.wsUrl ?? "wss://rpc.tiramisu.db-chain.testnet.arkiv.network",
          { timeout: 12000, reconnect: { attempts: 5, delay: 1000 } },
        ),
      });
      const unwatch = live.watchEntityEvents({
        onEvent: (e) => stream.onEntity(e.entityKey, e.type),
        onError: () => stream.onDisconnect(),
      });
      const unhead = watchBlockNumber(live, {
        poll: false,
        onBlockNumber: stream.onHead,
        onError: () => stream.onDisconnect(),
      });
      return () => {
        unwatch();
        unhead();
      };
    },
    async publish(value: Listing, leaseBlocks: number) {
      const listing = projectListing(value);
      if (!config.account || lower(config.account.address) !== listing.client)
        throw Error("Listing requires the client wallet");
      if (
        !Number.isSafeInteger(leaseBlocks) ||
        leaseBlocks < 3 ||
        leaseBlocks > 43200
      )
        throw Error("Invalid discovery lease");
      if (config.account.type !== "local" && !config.walletTransport)
        throw Error("Browser publication requires its wallet transport");
      await check();
      const timing = await read.getBlockTiming();
      if (
        timing.currentBlockTime + leaseBlocks * timing.blockDuration >=
        listing.acceptBefore
      )
        throw Error("Discovery lease must end before acceptance deadline");
      const wallet = createWalletClient({
        chain: tiramisu,
        account: config.account,
        transport:
          config.walletTransport ??
          http(config.rpcUrl, { timeout: 12000, retryCount: 0 }),
      });
      if (BigInt(await getChainId(wallet)) !== BigInt(tiramisu.id))
        throw Error("Wrong signing chain");
      if (config.account.type !== "local") {
        const addresses = await getAddresses(wallet);
        if (!addresses.some((x) => lower(x) === listing.client))
          throw Error("Client wallet changed");
      }
      return wallet.createEntity({
        payload: enc.encode(JSON.stringify(listing)),
        contentType: "application/json",
        attributes: listingAttributes(config.namespace, listing),
        expires: ExpirationTime.fromBlocks(leaseBlocks),
        flags: { readonly: true, permissionlessExtension: false },
      });
    },
  } satisfies ListingDriver & {
    publish(
      value: Listing,
      leaseBlocks: number,
    ): Promise<{ entityKey: Hex; txHash: Hex; expiresAt: bigint }>;
  };
}
