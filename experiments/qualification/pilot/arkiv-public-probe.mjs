// SPDX-License-Identifier: MIT
// Public-chain evidence: two independent SOFTWARE clients, not two browser users.
import { readFile, open, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
  threadId,
} from "node:worker_threads";
import { createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { render } from "@arkiv-network/sdk/query";
import {
  createArkivListingDriver,
  createListingBoard,
  listingQuery,
  projectListing,
} from "./listings.ts";
import { encodeTerms, matchTerms } from "./terms.ts";
import { createSwarmStorage } from "./swarm-id.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FUJI = "https://api.avax-test.network/ext/bc/C/rpc";
const ARKIV = "https://rpc.tiramisu.db-chain.testnet.arkiv.network";
const WS = "wss://rpc.tiramisu.db-chain.testnet.arkiv.network";
const GATEWAY = "https://api.gateway.ethswarm.org";
const USDC = "0x5425890298aed601595a70AB815c96711a31Bc65";
const abi = parseAbi([
  "function token() view returns (address)",
  "function jobs(uint256) view returns (address,address,uint256,uint256,uint64,uint64,uint64,uint8,bytes32,bytes32)",
  "function termsReferences(uint256) view returns (bytes32)",
]);
const lower = (value) => value.toLowerCase();
const json = (value) =>
  JSON.stringify(
    value,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
class ProbeError extends Error {}
const fail = (message) => {
  throw new ProbeError(message);
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const httpOptions = {
  retryCount: 0,
  timeout: 12000,
  fetchOptions: { redirect: "error" },
};
const fuji = () =>
  createPublicClient({
    chain: avalancheFuji,
    transport: http(FUJI, httpOptions),
  });
const arkiv = () =>
  createPublicClient({ chain: tiramisu, transport: http(ARKIV, httpOptions) });

// Mirrors web/main.ts verifyListing, which is private to the DOM application module.
// It uses the shared canonical projection and adds finalized chain/token checks.
async function funded(config, id) {
  const client = fuji();
  if ((await client.getChainId()) !== 43113) fail("Fuji chain mismatch");
  const block = await client.getBlock({ blockTag: "finalized" });
  const read = (functionName, args = []) =>
    client.readContract({
      address: config.escrow,
      abi,
      functionName,
      args,
      blockNumber: block.number,
    });
  const [token, job, ref] = await Promise.all([
    read("token"),
    read("jobs", [BigInt(id)]),
    read("termsReferences", [BigInt(id)]),
  ]);
  if (
    lower(token) !== lower(USDC) ||
    job[7] !== 0 ||
    job[2] <= 0n ||
    block.timestamp >= job[4]
  )
    fail("Task is not an open, funded canonical-USDC task");
  if (BigInt(ref) === 0n) fail("Task has no committed public scope");
  const store = createSwarmStorage({ gatewayUrl: GATEWAY });
  let encoded;
  try {
    const bytes = await store.download({
      reference: ref.slice(2),
      sha256: job[8],
    });
    encoded = encodeTerms(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  } finally {
    store.destroy();
  }
  if (
    encoded.digest !== job[8] ||
    !matchTerms(encoded.terms, 43113, config.escrow, USDC, job)
  )
    fail("Public scope differs from funded terms");
  return {
    job,
    ref,
    terms: encoded.terms,
    block: block.number,
    timestamp: block.timestamp,
  };
}
async function verifyListing(config, entity) {
  const a = entity.listing;
  if (
    a.settlementChain !== 43113 ||
    lower(a.escrow) !== lower(config.escrow) ||
    lower(a.paymentToken) !== lower(USDC) ||
    lower(entity.owner) !== lower(a.client) ||
    lower(entity.creator) !== lower(a.client)
  )
    return false;
  const state = await funded(config, a.jobId);
  return (
    lower(state.job[0]) === lower(a.client) &&
    String(state.job[2]) === a.reward &&
    String(state.job[3]) === a.qualificationClass &&
    Number(state.job[4]) === a.acceptBefore &&
    lower(state.ref.slice(2)) === lower(a.publicScope.reference) &&
    lower(state.job[8]) === lower(a.publicScope.sha256) &&
    state.terms.title === a.title
  );
}
async function collect(page) {
  const result = { block: String(page.blockNumber), entities: [] };
  let pages = 0;
  for (;;) {
    if (++pages > 100 || String(page.blockNumber) !== result.block)
      fail("Query pagination changed block or exceeded limit");
    for (const e of page.entities) {
      if (result.entities.length >= 10000) fail("Query record limit exceeded");
      result.entities.push({
        key: e.key,
        owner: e.owner,
        creator: e.creator,
        expiresAt: String(e.expiresAt),
      });
    }
    if (!page.hasNextPage()) return result;
    page = await page.next();
  }
}

async function observer() {
  const { config, filter, label } = workerData;
  const emit = (data) =>
    parentPort.postMessage({
      label,
      threadId,
      at: new Date().toISOString(),
      ...data,
    });
  const driver = createArkivListingDriver({
    namespace: "review-pass",
    rpcUrl: ARKIV,
    wsUrl: WS,
  });
  let records = 0;
  const bounded = (data) => {
    if (++records > 1200) throw Error("Observer evidence limit");
    emit(data);
  };
  const traced = {
    ...driver,
    async query(f) {
      const page = await driver.query(f);
      // Record the exact page stream consumed by the actual application board.
      const tracePage = (p) => {
        bounded({
          type: "query-page",
          predicates: listingQuery(f).map(render),
          block: String(p.blockNumber),
          entities: p.entities.map((e) => ({
            key: e.key,
            owner: e.owner,
            creator: e.creator,
            expiresAt: String(e.expiresAt),
          })),
          hasNextPage: p.hasNextPage(),
        });
        return {
          ...p,
          entities: p.entities,
          blockNumber: p.blockNumber,
          hasNextPage: () => p.hasNextPage(),
          next: async () => tracePage(await p.next()),
        };
      };
      return tracePage(page);
    },
    watch(stream) {
      return driver.watch({
        onHead: (block) => {
          bounded({ type: "head", block: String(block) });
          stream.onHead(block);
        },
        onEntity: (key, eventType) => {
          bounded({ type: "entity", key, eventType });
          stream.onEntity(key, eventType);
        },
        onDisconnect: () => {
          bounded({ type: "disconnect" });
          stream.onDisconnect();
        },
      });
    },
  };
  const board = createListingBoard({
    driver: traced,
    verify: (entity) => verifyListing(config, entity),
    onState: (state) => {
      bounded({
        type: "state",
        status: state.status,
        head: state.head === null ? null : String(state.head),
        listings: state.listings.map((e) => ({
          key: e.key,
          expiresAt: String(e.expiresAt),
          jobId: e.listing.jobId,
        })),
        removed: state.removed,
      });
    },
  });
  parentPort.on("message", (message) => {
    if (message === "stop") {
      board.stop();
      process.exit(0);
    }
  });
  try {
    await board.start(filter);
  } catch {
    emit({ type: "observer-error" });
    process.exit(1);
  }
}

async function main() {
  const values = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (["--publish", "--check"].includes(key)) {
      if (values[key]) fail("Duplicate option");
      values[key] = true;
    } else if (
      [
        "--config",
        "--job",
        "--wallet-file",
        "--lease-blocks",
        "--out",
      ].includes(key)
    ) {
      if (values[key] || !args[i + 1] || args[i + 1].startsWith("--"))
        fail("Missing or duplicate option");
      values[key] = args[++i];
    } else
      fail("Unknown option; use --check or --publish with --config and --job");
  }
  if (
    Boolean(values["--publish"]) === Boolean(values["--check"]) ||
    !values["--config"] ||
    !/^[1-9][0-9]{0,76}$/.test(values["--job"] ?? "")
  )
    fail(
      "Choose --check or --publish, with --config <Fuji manifest> and --job <funded ID>",
    );
  if (values["--publish"] && !values["--wallet-file"])
    fail("Publishing requires an explicit protected --wallet-file");
  const lease = Number(values["--lease-blocks"] ?? "30");
  if (!Number.isInteger(lease) || lease < 3 || lease > 60)
    fail("Lease must be3 through60 Arkiv blocks");
  const raw = JSON.parse(await readFile(resolve(values["--config"]), "utf8"));
  if (
    raw.chainId !== 43113 ||
    raw.environment !== "fuji-testnet" ||
    raw.testOnly !== true ||
    lower(raw.token ?? "") !== lower(USDC) ||
    !/^0x[0-9a-fA-F]{40}$/.test(raw.escrow ?? "") ||
    BigInt(raw.escrow) === 0n ||
    raw.rpcUrl !== FUJI
  )
    fail(
      "Canonical public Fuji manifest required; no local or custom RPC fallback",
    );
  const config = { escrow: lower(raw.escrow) };
  const id = values["--job"];
  let account;
  if (values["--wallet-file"]) {
    const path = resolve(values["--wallet-file"]);
    const walletFile = await open(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    let doc;
    try {
      const stat = await walletFile.stat();
      if (
        !stat.isFile() ||
        (stat.mode & 0o077) !== 0 ||
        stat.size > 4096 ||
        (typeof process.getuid === "function" && stat.uid !== process.getuid())
      )
        fail(
          "Wallet must be an owned private regular file, mode0600 or stricter",
        );
      doc = JSON.parse(await walletFile.readFile("utf8"));
    } finally {
      await walletFile.close();
    }
    if (
      Object.keys(doc).length !== 1 ||
      !/^0x[0-9a-fA-F]{64}$/.test(doc.privateKey ?? "")
    )
      fail("Wallet JSON must contain only privateKey");
    account = privateKeyToAccount(doc.privateKey);
    doc.privateKey = undefined;
  }
  const state = await funded(config, id);
  const signer = account?.address ?? state.job[0];
  if (lower(signer) !== lower(state.job[0]))
    fail("Signing account must own the funded Fuji task");
  const ar = arkiv();
  if ((await ar.getChainId()) !== 7738577) fail("Wrong Arkiv network");
  const balance = await ar.getBalance({ address: signer });
  if (balance === 0n) fail("The exact funding client has no Tiramisu GLM");
  const listing = projectListing({
    schema: 2,
    taskClass: "technical-review",
    qualificationClass: String(state.job[3]),
    settlementChain: 43113,
    escrow: config.escrow,
    jobId: id,
    client: lower(signer),
    paymentToken: USDC,
    reward: String(state.job[2]),
    acceptBefore: Number(state.job[4]),
    title: state.terms.title,
    publicScope: { reference: state.ref.slice(2), sha256: state.job[8] },
  });
  const filter = {
    namespace: "review-pass",
    taskClass: "technical-review",
    qualificationClass: listing.qualificationClass,
    settlementChain: 43113,
    escrow: config.escrow,
    paymentToken: USDC,
    minimumReward: listing.reward,
  };
  const driver = createArkivListingDriver({
    namespace: "review-pass",
    rpcUrl: ARKIV,
    wsUrl: WS,
  });
  const initial = await collect(await driver.query(filter));
  // Avoid overlapping leases for this job. Existing evidence must be inspected, never blindly duplicated.
  for (const e of initial.entities) {
    const record = await driver.get(e.key);
    let candidate;
    try {
      candidate = JSON.parse(new TextDecoder().decode(record.payload));
    } catch {
      continue;
    }
    if (
      String(candidate.jobId) === id &&
      lower(candidate.escrow ?? "") === config.escrow &&
      lower(e.owner) === lower(signer)
    )
      fail(
        "This client already has a matching active lease; inspect/reuse its evidence instead of publishing again",
      );
  }
  const preflight = {
    mode: "public-arkiv",
    endpoints: { fuji: FUJI, arkivHttp: ARKIV, arkivWebSocket: WS },
    status: "READY",
    writes: 0,
    signer: lower(signer),
    signerConfigured: Boolean(account),
    arkivBalanceWei: String(balance),
    config,
    jobId: id,
    finalizedFujiBlock: String(state.block),
    filter,
    predicates: listingQuery(filter).map(render),
    leaseBlocks: lease,
    initial,
    evidenceScope:
      "Two independent Node worker clients; no browser/UI or independent physical-user claim",
  };
  if (values["--check"]) {
    console.log(json(preflight));
    return;
  }
  const out = resolve(
    values["--out"] ?? `.runtime/review-pass-arkiv/${config.escrow}-${id}.json`,
  );
  await mkdir(dirname(out), { recursive: true, mode: 0o700 });
  // Exclusive, durable journal is also the per-job default lock. Never silently resume/overwrite it.
  const file = await open(out, "wx", 0o600);
  let journal;
  try {
    journal = await open(`${out}.journal.ndjson`, "wx", 0o600);
  } catch {
    await file.close();
    fail("Journal already exists; inspect prior publication before retrying");
  }
  const evidence = {
    ...preflight,
    status: "STARTED",
    startedAt: new Date().toISOString(),
    source: {
      commit: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: ROOT,
        encoding: "utf8",
      }).trim(),
      runnerSha256: sha(await readFile(fileURLToPath(import.meta.url))),
      listingsSha256: sha(
        await readFile(new URL("./listings.ts", import.meta.url)),
      ),
      uiPolicySha256: sha(
        await readFile(new URL("./web/main.ts", import.meta.url)),
      ),
    },
    transactions: [],
    observers: { A: [], B: [] },
    limitations: [
      "No browser UI recording",
      "No forced disconnect/reconnect in this run",
      "No deliberately written irrelevant entity",
    ],
  };
  let queue = Promise.resolve();
  const save = () => {
    queue = queue.then(async () => {
      await journal.write(
        JSON.stringify({
          at: new Date().toISOString(),
          status: evidence.status,
          transactions: evidence.transactions,
          publication: evidence.publication,
        }) + "\n",
      );
      await journal.sync();
      const bytes = Buffer.from(json(evidence) + "\n");
      await file.truncate(0);
      await file.write(bytes, 0, bytes.length, 0);
      await file.sync();
    });
    return queue;
  };
  const workers = [],
    listeners = new Set();
  let failure,
    attempted = false;
  const end = Date.now() + 240000;
  const signal = () => {
    for (const f of listeners) f();
  };
  const wait = (predicate, ms = 180000) =>
    new Promise((res, rej) => {
      let timer;
      const check = () => {
        if (failure) {
          cleanup();
          rej(new ProbeError(failure));
        } else if (predicate()) {
          cleanup();
          res();
        }
      };
      const cleanup = () => {
        clearTimeout(timer);
        listeners.delete(check);
      };
      timer = setTimeout(
        () => {
          cleanup();
          rej(
            new ProbeError(
              "Evidence deadline exceeded; inspect journal before retrying",
            ),
          );
        },
        Math.min(ms, Math.max(1, end - Date.now())),
      );
      listeners.add(check);
      check();
    });
  const bounded = (promise) =>
    Promise.race([
      promise,
      new Promise((_, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new ProbeError(
                "Publication deadline exceeded; inspect journal before retrying",
              ),
            ),
          Math.max(1, end - Date.now()),
        );
        timer.unref();
        promise.finally(() => clearTimeout(timer)).catch(() => {});
      }),
    ]);
  try {
    await save();
    for (const label of ["A", "B"]) {
      const worker = new Worker(new URL(import.meta.url), {
        workerData: { config, filter, label },
        env: {},
      });
      workers.push(worker);
      worker.on("message", (data) => {
        if (evidence.observers[label].length >= 1200)
          failure = "Observer record limit exceeded";
        else evidence.observers[label].push(data);
        if (data.type === "observer-error") failure = "Observer failed";
        signal();
      });
      worker.on("error", () => {
        failure = "Observer failed";
        signal();
      });
      worker.on("exit", (code) => {
        if (code !== 0) {
          failure = "Observer exited";
          signal();
        }
      });
    }
    const both = (predicate) =>
      ["A", "B"].every((label) => predicate(evidence.observers[label]));
    await wait(
      () =>
        both((records) =>
          records.some((e) => e.type === "state" && e.status === "live"),
        ),
      25000,
    );
    await save();
    const fresh = await funded(config, id);
    if (
      fresh.ref !== state.ref ||
      fresh.job[8] !== state.job[8] ||
      lower(fresh.job[0]) !== lower(signer)
    )
      fail("Funded task changed before publication");
    // Capture the tx hash at the RPC boundary, before SDK receipt waiting can time out.
    const transport = (options) => {
      const base = http(ARKIV, httpOptions)(options);
      return {
        ...base,
        request: async (request) => {
          if (Date.now() >= end) fail("Publication deadline exceeded");
          if (request.method.startsWith("eth_send")) {
            if (request.method !== "eth_sendRawTransaction" || attempted)
              fail("No repeated or alternate transaction send allowed");
            attempted = true;
            evidence.status = "SEND_ATTEMPTED";
            evidence.writes = 1;
            await save();
            const hash = await base.request(request);
            evidence.transactions.push({ hash, status: "BROADCAST" });
            await save();
            return hash;
          }
          return base.request(request);
        },
      };
    };
    const publisher = createArkivListingDriver({
      namespace: "review-pass",
      rpcUrl: ARKIV,
      wsUrl: WS,
      account,
      walletTransport: transport,
    });
    const result = await bounded(publisher.publish(listing, lease));
    evidence.publication = {
      entityKey: result.entityKey,
      txHash: result.txHash,
      expiresAt: String(result.expiresAt),
    };
    const creationReceipt = await ar.getTransactionReceipt({
      hash: result.txHash,
    });
    if (creationReceipt.status !== "success")
      fail("Arkiv creation receipt failed");
    evidence.creationReceipt = {
      status: creationReceipt.status,
      blockNumber: String(creationReceipt.blockNumber),
      blockHash: creationReceipt.blockHash,
      gasUsed: String(creationReceipt.gasUsed),
    };
    evidence.status = "PUBLISHED";
    await save();
    const key = lower(result.entityKey);
    await wait(
      () =>
        both((records) =>
          records.some(
            (e) =>
              e.type === "state" &&
              e.status === "live" &&
              e.listings.some((v) => lower(v.key) === key),
          ),
        ),
      45000,
    );
    evidence.beforeExpiry = await collect(await driver.query(filter));
    if (
      !evidence.beforeExpiry.entities.some((e) => lower(e.key) === key) ||
      BigInt(evidence.beforeExpiry.block) >= result.expiresAt
    )
      fail(
        "No pre-expiry query captured; publication remains real but evidence is incomplete",
      );
    await save();
    await wait(() =>
      both((records) =>
        records.some(
          (e) =>
            e.type === "state" &&
            e.removed.some(
              (v) => lower(v.key) === key && v.reason === "native-expired",
            ),
        ),
      ),
    );
    evidence.afterExpiry = await collect(await driver.query(filter));
    if (
      BigInt(evidence.afterExpiry.block) < result.expiresAt ||
      evidence.afterExpiry.entities.some((e) => lower(e.key) === key)
    )
      fail("Post-expiry query did not confirm absence");
    if (
      !both((records) =>
        records.some((e) => e.type === "entity" && lower(e.key) === key),
      )
    )
      fail("Both clients must receive the actual entity event");
    if (
      Object.values(evidence.observers)
        .flat()
        .some(
          (e) =>
            e.type === "entity" &&
            lower(e.key) === key &&
            /delete/i.test(e.eventType ?? ""),
        )
    )
      fail("Explicit deletion observed; cannot claim native expiry");
    if (
      Object.values(evidence.observers)
        .flat()
        .some((e) => e.type === "disconnect" || e.type === "observer-error")
    )
      fail(
        "Observer gap makes deletion history ambiguous; native-expiry evidence is incomplete",
      );
    if (
      !both((records) =>
        records
          .filter((e) => e.type === "query-page")
          .every(
            (e) =>
              JSON.stringify(e.predicates) ===
              JSON.stringify(preflight.predicates),
          ),
      )
    )
      fail("Observer predicates changed during the run");
    const survived = await funded(config, id);
    evidence.escrowAfterExpiry = {
      status: "Open",
      amount: String(survived.job[2]),
      finalizedBlock: String(survived.block),
      termsReference: survived.ref,
    };
    evidence.status = "PASS_PUBLIC_SOFTWARE_CLIENTS";
    evidence.finishedAt = new Date().toISOString();
    await save();
    console.log(
      json({
        status: evidence.status,
        evidence: out,
        publication: evidence.publication,
        writes: 1,
        browserUiVerified: false,
        reconnectVerified: false,
      }),
    );
  } catch (error) {
    evidence.status = "INCOMPLETE";
    evidence.failure =
      error instanceof ProbeError
        ? error.message
        : "Probe failed; inspect public journal and transaction receipts";
    await save();
    throw new ProbeError(evidence.failure);
  } finally {
    await Promise.all(workers.map((w) => w.terminate()));
    await queue.catch(() => {});
    await Promise.allSettled([file.close(), journal.close()]);
  }
}
if (!isMainThread) await observer();
else
  try {
    await main();
  } catch (error) {
    console.error(
      error instanceof ProbeError
        ? error.message
        : "Arkiv probe failed; no automatic retry. Inspect configuration and public journal.",
    );
    process.exitCode = 1;
  }
