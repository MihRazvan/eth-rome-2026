import "../../../qualification/runtime/style.css";
import "./pilot.css";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  custom,
  keccak256,
  stringToHex,
  sha256,
  bytesToHex,
  parseUnits,
  formatUnits,
  type Hex,
  type Address,
} from "viem";
import {
  loadOrCreateDeviceKey,
  getDevicePublicKey,
  encryptForRecipients,
  decryptForRecipient,
  rotateDeviceKey,
  listDeviceKeys,
  loadDeviceKey,
} from "../keys";
import {
  nextStep,
  deadlineEligibility,
  type Role,
  type Readiness,
} from "../journey";
import { proveInBrowser } from "../browser-prover";
import { uploadMessage } from "../upload-message";
import { encodeTerms, matchTerms, termsUploadMessage } from "../terms";
import { waitForSettlement } from "../settlement";
import {
  createArkivListingDriver,
  createListingBoard,
  type BoardState,
  type ListingEntity,
} from "../listings";
import { createSwarmStorage, type StorageRef } from "../swarm-id";
declare global {
  interface Window {
    ethereum?: {
      request(args: any): Promise<any>;
      on?(event: string, listener: (...args: any[]) => void): void;
    };
  }
}
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const config = await fetch("/api/config").then((r) => r.json());
if (!config.abi) throw Error("Pilot configuration unavailable");
const network = defineChain({
  id: config.chainId,
  name: config.environment,
  nativeCurrency: {
    name: config.chainId === 43113 ? "Avalanche" : "Test Ether",
    symbol: config.chainId === 43113 ? "AVAX" : "ETH",
    decimals: 18,
  },
  rpcUrls: { default: { http: [config.rpcUrl] } },
});
const client = createPublicClient({ chain: network, transport: http() });
let account: Address | undefined,
  wallet: any,
  device: any,
  busy = false,
  generation = 0;
let jobs: any[] = [];
const proofs = new Map<string, any>();
let proofController: AbortController | undefined;
let role: Role =
  new URL(location.href).searchParams.get("role") === "reviewer"
    ? "reviewer"
    : "client";
let readiness: Readiness = { key: false, gas: null, balance: null };
let chainNow = 0;
function currentReadiness() {
  return readiness.owner === account
    ? readiness
    : { key: false, gas: null, balance: null };
}
function chosenReward() {
  const value = ($("#task-reward") as HTMLInputElement).value;
  return /^\d{1,9}(\.\d{1,6})?$/.test(value) ? parseUnits(value, 6) : 0n;
}
function reveal(target: string) {
  const el = document.getElementById(target);
  if (!el) return;
  const details = el.closest("details");
  if (details) details.open = true;
  el.scrollIntoView({
    block: "center",
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
  if (el instanceof HTMLElement) el.focus({ preventScroll: true });
}
function renderGuide() {
  document.body.dataset.role = role;
  document
    .querySelectorAll<HTMLButtonElement>("button[data-role]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.role === role)),
    );
  $("#fuji-help").hidden = config.chainId !== 43113;
  $("#activity-title").textContent =
    !account && config.chainId === 31338
      ? "Local demo activity"
      : "Your review activity";
  const r = currentReadiness();
  const storageReady = !publicStorage || publicStorage.state.canUpload;
  const next = nextStep(
    role,
    Boolean(account),
    r,
    storageReady,
    chosenReward(),
    config.chainId === 31338,
  );
  $("#journey-role").textContent =
    role === "client" ? "YOUR CLIENT WORKSPACE" : "YOUR REVIEWER WORKSPACE";
  $("#journey-title").textContent = next.title;
  $("#journey-text").textContent = next.text;
  $("#next-step").textContent =
    next.target === "commission"
      ? "Write the review scope"
      : next.target === "opportunity-section"
        ? "Find a review"
        : next.title;
  $("#next-step").dataset.target = next.target;
  ($("#create") as HTMLButtonElement).dataset.eligible = String(
    Boolean(account) &&
      r.key &&
      storageReady &&
      r.balance !== null &&
      r.balance >= chosenReward() &&
      chosenReward() > 0n &&
      r.gas !== null &&
      r.gas > 0n,
  );
  syncButtons();
  const checks = [
    [
      Boolean(account),
      "Payment wallet",
      account
        ? `${account.slice(0, 8)}…${account.slice(-6)} · ${config.chainId === 43113 ? "Fuji" : "local test chain"}`
        : "Connect a test wallet to continue",
    ],
    [
      r.gas !== null && r.gas > 0n,
      "Transaction gas",
      r.gas === null
        ? "Not checked"
        : `${formatUnits(r.gas, 18).slice(0, 10)} ${network.nativeCurrency.symbol}`,
    ],
    [
      r.key,
      "Private reports",
      r.key
        ? "This browser can receive new reports"
        : "Enable this browser’s encryption key",
    ],
    [
      storageReady,
      "Document storage",
      publicStorage
        ? storageReady
          ? "Swarm ID can upload"
          : "Sign in and provide usable postage"
        : "Local Bee rehearsal only",
    ],
    ...(role === "client"
      ? [
          [
            r.balance !== null && r.balance >= chosenReward(),
            "Review reward",
            r.balance === null
              ? "Balance not checked"
              : `${formatUnits(r.balance, 6)} ${tokenSymbol} available`,
          ],
        ]
      : [
          [
            false,
            "Qualification",
            "An issuer credential and fresh task proof are required",
          ],
        ]),
  ];
  $("#readiness").innerHTML = checks
    .map(
      ([done, title, detail], i) =>
        `<li data-complete="${done}"><span class="check">${done ? "✓" : i + 1}</span><span>${esc(title)}<small>${esc(detail)}</small></span></li>`,
    )
    .join("");
  $("#network-help").textContent =
    config.chainId === 43113
      ? `This app uses Fuji (43113). Reward token: ${config.token}. Test tokens have no monetary value.`
      : `This is a local rehearsal on chain31338 at ${config.rpcUrl}. Public faucets cannot fund this local chain. The demo operator provides local test wallets.`;
}
function syncButtons() {
  const walletFree = new Set([
    "connect",
    "refresh",
    "filter-board",
    "refresh-board",
    "connect-storage",
    "next-step",
    "start-client",
    "start-reviewer",
  ]);
  document.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    b.disabled =
      (busy && b.dataset.action !== "cancel-proof") ||
      b.dataset.eligible === "false" ||
      (b.dataset.viewJob
        ? boardState?.status !== "live"
        : !account && !walletFree.has(b.id) && b.dataset.action !== "export");
  });
}
function chooseRole(next: Role) {
  role = next;
  const url = new URL(location.href);
  url.searchParams.set("role", role);
  history.replaceState(null, "", url);
  document.body.dataset.role = role;
  document
    .querySelectorAll<HTMLButtonElement>("button[data-role]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.role === role)),
    );
  renderGuide();
  reveal("journey");
}

const tokenSymbol = config.chainId === 43113 ? "test USDC" : "qUSD";
let boardState: BoardState | undefined;
const selectedJobs = new Set<string>();
const arkivConfig = config.arkiv ?? {
  rpcUrl: "https://rpc.tiramisu.db-chain.testnet.arkiv.network",
  wsUrl: "wss://rpc.tiramisu.db-chain.testnet.arkiv.network",
};
const publicStorage =
  config.storageMode === "swarm-id"
    ? createSwarmStorage({
        gatewayUrl: config.gatewayUrl,
        onState: (state) => {
          $("#storage-status").textContent = state.canUpload
            ? `Swarm ID connected · ${state.mode} uploads available`
            : state.connected
              ? `Connected; upload unavailable (${state.reason ?? "postage required"})`
              : "Connect Swarm ID to upload. Storage identity is separate from your payment wallet.";
          renderGuide();
        },
      })
    : undefined;
async function fetchDocument(id: string) {
  const job: any = await read("jobs", [BigInt(id)]);
  const digest: any = await read("documentDigests", [BigInt(id)]);
  let envelope: any;
  if (publicStorage) {
    const bytes = await publicStorage.download({
      reference: job[9].slice(2),
      sha256: digest,
    });
    envelope = JSON.parse(new TextDecoder().decode(bytes));
  } else {
    const response = await fetch(`/api/document?job=${id}`),
      result = await response.json();
    if (!response.ok) throw Error(result.error);
    envelope = result.envelope;
  }
  if (
    sha256(bytesToHex(new TextEncoder().encode(JSON.stringify(envelope)))) !==
    digest
  )
    throw Error("Envelope differs from worker commitment");
  return { envelope, digest, reference: job[9] };
}
function saveFile(name: string, bytes: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const namespace = () =>
  `review-pass:${config.chainId}:${config.keyRegistry}:${account?.toLowerCase()}`;
const context = (jobId: string) => ({
  chainId: config.chainId,
  escrow: config.escrow as Hex,
  jobId,
  purpose: "review-result" as const,
  version: 1 as const,
});
const read = (
  name: string,
  args: any[] = [],
  target = "QualificationEscrow",
  address = config.escrow,
) =>
  client.readContract({
    address,
    abi: config.abi[target],
    functionName: name,
    args,
    blockTag: config.chainId === 43113 ? "finalized" : "latest",
  } as any);
async function verifyListing(entity: ListingEntity) {
  const a = entity.listing;
  if (
    a.settlementChain !== config.chainId ||
    a.escrow.toLowerCase() !== config.escrow.toLowerCase() ||
    a.paymentToken.toLowerCase() !== config.token.toLowerCase()
  )
    return false;
  const block = await client.getBlock({
    blockTag: config.chainId === 43113 ? "finalized" : "latest",
  });
  const job: any = await client.readContract({
    address: config.escrow,
    abi: config.abi.QualificationEscrow,
    functionName: "jobs",
    args: [BigInt(a.jobId)],
    blockNumber: block.number,
  });
  const ref: any = await client.readContract({
    address: config.escrow,
    abi: config.abi.QualificationEscrow,
    functionName: "termsReferences",
    args: [BigInt(a.jobId)],
    blockNumber: block.number,
  });
  if (
    job[7] !== 0 ||
    job[0].toLowerCase() !== a.client ||
    entity.owner !== a.client ||
    entity.creator !== a.client ||
    String(job[2]) !== a.reward ||
    String(job[3]) !== a.qualificationClass ||
    Number(job[4]) !== a.acceptBefore ||
    block.timestamp >= job[4] ||
    ref.slice(2).toLowerCase() !== a.publicScope.reference ||
    job[8].toLowerCase() !== a.publicScope.sha256
  )
    return false;
  const response = await fetch(`/api/terms?job=${a.jobId}`);
  if (!response.ok) throw Error("Scope verification unavailable");
  const body = await response.json(),
    encoded = encodeTerms(body.terms);
  return (
    encoded.digest === job[8] &&
    encoded.terms.title === a.title &&
    matchTerms(encoded.terms, config.chainId, config.escrow, config.token, job)
  );
}
function renderBoard() {
  const state = boardState;
  $("#discovery-status").textContent = state
    ? `Arkiv ${state.status}${state.head === null ? "" : ` · observed block ${state.head}`}${state.reason ? ` · ${state.reason}` : ""}`
    : "Connecting to public opportunity listings…";
  $("#opportunities").innerHTML = state?.listings.length
    ? state.listings
        .map(
          (e) =>
            `<article class="listing"><h3>${esc(e.listing.title)}</h3><p>${formatUnits(BigInt(e.listing.reward), 6)} ${tokenSymbol} · qualification class ${esc(e.listing.qualificationClass)}</p><p class="fine">Discovery lease ends at Arkiv block ${e.expiresAt}. Funding follows its own deadlines.</p><button data-view-job="${e.listing.jobId}" ${state.status !== "live" ? "disabled" : ""}>View verified scope</button></article>`,
        )
        .join("")
    : `<p class="fine">${state?.status === "live" ? "No matching live listings. A funded review appears here after its client publishes a discovery lease." : "Discovery is not yet available. Existing funded work remains accessible below."}</p>`;
  if (state?.removed.some((x) => x.reason === "native-expired"))
    $("#discovery-change").textContent =
      "A discovery lease is no longer active. Its escrow and accepted work remain on the settlement chain.";
}
const board = createListingBoard({
  driver: createArkivListingDriver({
    namespace: "review-pass",
    ...arkivConfig,
  }),
  verify: verifyListing,
  onState: (state) => {
    boardState = state;
    renderBoard();
  },
});
async function startBoard() {
  const raw = ($("#minimum-reward") as HTMLInputElement).value;
  if (!/^\d{1,9}(\.\d{1,6})?$/.test(raw)) throw Error("Invalid minimum reward");
  await board.start({
    namespace: "review-pass",
    taskClass: "technical-review",
    qualificationClass: "7",
    settlementChain: config.chainId,
    escrow: config.escrow,
    paymentToken: config.token,
    minimumReward: String(parseUnits(raw, 6)),
  });
}
const button = (action: string, id: string, label: string, eligible = true) =>
  `<button data-action="${action}" data-id="${id}" data-eligible="${eligible}"${(!account && action !== "export") || busy || !eligible ? " disabled" : ""}>${label}</button>`;
$("#environment").textContent =
  `${config.environment.toUpperCase()} · ${config.testOnly ? "TEST ISSUER / TEST ASSETS" : "CONFIGURED PUBLIC TESTNET"} · WALLET-SIGNED TRANSACTIONS`;
$("#contracts").textContent = `Chain ${config.chainId} · `;
if (config.chainId === 43113) {
  const link = document.createElement("a");
  link.href = `https://testnet.snowtrace.io/address/${config.escrow}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "View escrow on Avalanche";
  $("#contracts").append(link);
} else
  $("#contracts").append(
    document.createTextNode(`local escrow ${config.escrow.slice(0, 10)}…`),
  );
async function keyBinding(owner: Address) {
  const b: any = await read(
    "keys",
    [owner],
    "QualificationKeys",
    config.keyRegistry,
  );
  return {
    owner,
    publicKey: b[0] as Hex,
    expiresAt: Number(b[1]),
    version: String(b[2]),
  };
}
async function tx(
  name: string,
  args: any[] = [],
  target = "QualificationEscrow",
  address = config.escrow,
) {
  if (!account || !wallet) throw Error("Connect your wallet");
  const hash = await wallet.writeContract({
    address,
    abi: config.abi[target],
    functionName: name,
    args,
    account,
    chain: network,
  });
  const row = document.createElement("li");
  const receiptText = (hash: string, state: string) => {
    row.replaceChildren();
    row.append(document.createTextNode(`${name}: ${state} · `));
    if (config.chainId === 43113) {
      const link = document.createElement("a");
      link.href = `https://testnet.snowtrace.io/tx/${hash}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = hash;
      row.append(link);
    } else row.append(document.createTextNode(hash));
  };
  receiptText(hash, "sent, settlement unconfirmed");
  $("#transactions").prepend(row);
  $("#notice").textContent =
    "Transaction sent. Waiting for confirmed settlement…";
  const receipt = await waitForSettlement(client, {
    hash,
    chainId: config.chainId,
  });
  if (receipt.status !== "success") throw Error("Transaction reverted");
  receiptText(
    receipt.transactionHash,
    config.chainId === 43113
      ? "finalized on Fuji"
      : "confirmed on local test chain",
  );
  return receipt.transactionHash;
}
async function refresh() {
  const session = generation,
    owner = account,
    currentDevice = device;
  chainNow = Number(
    (
      await client.getBlock({
        blockTag: config.chainId === 43113 ? "finalized" : "latest",
      })
    ).timestamp,
  );
  const ids = new Set<string>(selectedJobs);
  if (config.environment === "local-pilot") {
    const count = Number(await read("nextJob"));
    if (count > 1000)
      throw Error(
        "Local rehearsal has too many jobs; use a fresh local deployment",
      );
    for (let i = 1; i <= count; i++) ids.add(String(i));
  } else if (owner) {
    if (!/^[0-9]+$/.test(String(config.deploymentBlock)))
      throw Error(
        "Deployment start block missing; cannot recover personal assignments",
      );
    const head = await client.getBlock({ blockTag: "finalized" });
    const start = BigInt(config.deploymentBlock);
    if (head.number - start > 1_000_000n)
      throw Error(
        "Deployment history exceeds this pilot's recovery window; use an indexed account history service",
      );
    for (let from = start; from <= head.number; from += 2000n) {
      const to = from + 1999n > head.number ? head.number : from + 1999n;
      const results = await Promise.all([
        client.getContractEvents({
          address: config.escrow,
          abi: config.abi.QualificationEscrow,
          eventName: "JobFunded",
          args: { client: owner },
          fromBlock: from,
          toBlock: to,
          strict: true,
        }),
        client.getContractEvents({
          address: config.escrow,
          abi: config.abi.QualificationEscrow,
          eventName: "Accepted",
          args: { worker: owner },
          fromBlock: from,
          toBlock: to,
          strict: true,
        }),
      ]);
      if (session !== generation) return;
      for (const logs of results)
        for (const log of logs) ids.add(String((log as any).args.job));
      if (ids.size > 1000)
        throw Error(
          "Account history exceeds this pilot's 1000-assignment view limit",
        );
    }
  }
  const nextJobs: any[] = [];
  for (const i of [...ids].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))) {
    const j: any = await read("jobs", [BigInt(i)]);
    let scope: any;
    let scopeError = "";
    const termsReference: any = await read("termsReferences", [BigInt(i)]);
    if (termsReference !== `0x${"0".repeat(64)}`) {
      try {
        const response = await fetch(`/api/terms?job=${i}`);
        if (!response.ok) throw Error("Public scope is unavailable");
        const body = await response.json(),
          encoded = encodeTerms(body.terms);
        if (
          encoded.digest !== j[8] ||
          body.reference !== termsReference ||
          !matchTerms(
            encoded.terms,
            config.chainId,
            config.escrow,
            config.token,
            j,
          )
        )
          throw Error("Public scope does not match the funded commitment");
        scope = encoded.terms;
      } catch (e) {
        scopeError = e instanceof Error ? e.message : "Scope unavailable";
      }
    }
    if (session !== generation) return;
    nextJobs.push({
      id: String(i),
      client: j[0],
      worker: j[1],
      amount: j[2],
      class: j[3],
      acceptBefore: j[4],
      submitBefore: j[5],
      reviewBefore: j[6],
      status: [
        "Open",
        "Accepted",
        "Submitted",
        "Paid",
        "Refunded",
        "Disputed",
        "Resolved",
      ][j[7]],
      reference: j[9],
      termsDigest: j[8],
      termsReference,
      scope,
      scopeError,
    });
  }
  let keyStatus: string | undefined;
  if (owner && currentDevice) {
    const [binding, gas, balance] = await Promise.all([
      keyBinding(owner),
      client.getBalance({ address: owner }),
      read("balanceOf", [owner], "DemoUSD", config.token),
    ]);
    const pub = await getDevicePublicKey(currentDevice);
    const now = (await client.getBlock()).timestamp;
    const keyReady =
      binding.publicKey.toLowerCase() === pub.toLowerCase() &&
      binding.expiresAt > Number(now);
    if (session === generation && owner === account)
      readiness = { owner, gas, balance: balance as bigint, key: keyReady };
    keyStatus =
      binding.publicKey.toLowerCase() === pub.toLowerCase() &&
      binding.expiresAt > Number(now)
        ? `Registered onchain · version ${binding.version} · private key saved only in this browser profile`
        : "This device key is not the current usable onchain binding. Register it before exchanging documents.";
  }
  if (session !== generation || owner !== account) return;
  jobs = nextJobs;
  if (keyStatus) $("#key-status").textContent = keyStatus;
  render();
}
function render() {
  renderGuide();
  $("#wallet").textContent = account
    ? `${account.slice(0, 10)}…${account.slice(-6)}`
    : "Connect to begin";
  for (const id of ["register", "rotate", "revoke-key", "mint", "create"])
    ($("#" + id) as HTMLButtonElement).disabled = !account || busy;
  ($("#mint") as HTMLButtonElement).hidden =
    !config.testOnly || config.chainId !== 31338;
  const visibleJobs = jobs.filter(
    (j) =>
      config.environment === "local-pilot" ||
      j.client.toLowerCase() === account?.toLowerCase() ||
      j.worker.toLowerCase() === account?.toLowerCase() ||
      selectedJobs.has(j.id),
  );
  $("#jobs").innerHTML = visibleJobs.length
    ? [...visibleJobs]
        .reverse()
        .map((j) => {
          const isClient = account?.toLowerCase() === j.client.toLowerCase(),
            isWorker = account?.toLowerCase() === j.worker.toLowerCase();
          const eligibility = deadlineEligibility(
            j.status,
            chainNow,
            j.acceptBefore,
            j.submitBefore,
            j.reviewBefore,
          );
          const date = (n: bigint) =>
            new Date(Number(n) * 1000).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            });
          const stageHint =
            j.status === "Open"
              ? eligibility.accept
                ? `Waiting for a qualified reviewer. Accept by ${date(j.acceptBefore)}.`
                : "The acceptance window is closed. The client can reclaim the reward."
              : j.status === "Accepted"
                ? `The reviewer is working. Deliver by ${date(j.submitBefore)}. After that, an undelivered task can be refunded.`
                : j.status === "Submitted"
                  ? `Report delivered. The client can approve payment or dispute by ${date(j.reviewBefore)}. After that, the reviewer can claim payment unless disputed.`
                  : j.status === "Paid"
                    ? "Complete. The funded reward was paid to the assigned reviewer. The encrypted report remains retrievable."
                    : j.status === "Refunded"
                      ? "Closed. The reward was returned to the client."
                      : j.status === "Disputed"
                        ? "Payment is held pending the configured arbitrator’s decision. Qualification does not decide work quality."
                        : "The arbitrator resolved this dispute and distributed the reward.";
          const stageIndex = (
            {
              Open: 0,
              Accepted: 1,
              Submitted: 2,
              Paid: 3,
              Refunded: 0,
              Disputed: 2,
              Resolved: 3,
            } as Record<string, number>
          )[j.status];
          const progress = `<ol class="workflow" aria-label="Review progress">${["Funded", "Qualified", "Delivered", "Settled"].map((label, i) => `<li data-done="${i <= stageIndex}">${label}</li>`).join("")}</ol>`;
          let actions = "";
          const publish =
            eligibility.accept && isClient && j.scope && !j.scopeError
              ? button("publish", j.id, "Publish discovery lease on Arkiv")
              : "";
          if (eligibility.accept && !j.scopeError && !isClient)
            actions = `${config.browserProver ? `<div class="local-prover"><h4>Prove qualification in this browser</h4><p class="fine">Select your issued credential and holder file. They are read locally, never uploaded. A fresh proof is bound to this assignment and your connected payment wallet.</p><label class="fine">Credential JSON<input type="file" accept=".json,application/json" data-credential="${j.id}"${!account ? " disabled" : ""}></label><label class="fine">Private holder JSON<input type="file" accept=".json,application/json" data-holder="${j.id}"${!account ? " disabled" : ""}></label>${button("generate", j.id, "Generate qualification proof")}${button("cancel-proof", j.id, "Cancel proof", false)}<p class="fine" id="proof-progress-${j.id}" role="status"></p></div>` : ""}<details><summary>Advanced: use a local proving CLI</summary><p class="fine">Download the whole issuer snapshot; no credential identifier goes in the URL. The contract checks the authoritative root again at acceptance.</p><a href="/api/snapshot" download="snapshot.json">Download issuer snapshot</a><pre id="command-${j.id}">Connect your wallet, then prepare a proof request.</pre>${button("prepare", j.id, "Prepare local prover command")}<label class="fine">Import PUBLIC proof JSON (never your credential or holder file)<input type="file" accept=".json,application/json" data-proof="${j.id}"${!account ? " disabled" : ""}></label></details>${proofs.has(j.id) ? `<p class="fine">Proof checked against the current contract. Accepting still requires your wallet signature.</p>${button("accept", j.id, "Verify proof & accept")}` : ""}`;
          if (j.status === "Accepted" && isWorker)
            actions = `<label class="fine" for="review-${j.id}">Private review for you and the client</label><textarea class="doc" id="review-${j.id}"></textarea>${button("submit", j.id, "Encrypt for client & submit", eligibility.submit)}`;
          if (["Submitted", "Paid", "Disputed", "Resolved"].includes(j.status))
            actions =
              button("retrieve", j.id, "Retrieve & decrypt review") +
              button("export", j.id, "Export encrypted review") +
              (isClient || isWorker
                ? button("save", j.id, "Save decrypted report")
                : "") +
              `<label class="fine">Device key<select data-history="${j.id}"><option value="">Current device key</option></select></label>`;
          if (j.status === "Submitted" && isClient)
            actions +=
              button("pay", j.id, "Approve & pay") +
              button("dispute", j.id, "Dispute review", eligibility.dispute);
          if (j.status === "Submitted" && isWorker)
            actions += button(
              "claim",
              j.id,
              "Claim after review deadline",
              eligibility.claim,
            );
          if (["Open", "Accepted"].includes(j.status) && isClient)
            actions += button(
              "refund",
              j.id,
              "Refund after applicable deadline",
              eligibility.refund,
            );
          if (
            j.status === "Disputed" &&
            account?.toLowerCase() === config.arbitrator.toLowerCase()
          )
            actions += button("resolve", j.id, "Arbitrate 50 / 50 split");
          return `<article class="ticket" id="job-${j.id}"><div class="ticket-head"><span>ASSIGNMENT ${j.id}</span><span class="status">${j.status.toUpperCase()}</span></div><div class="ticket-body">${progress}<h3>${esc(j.scope?.title ?? "Technical review")}</h3>${j.scope ? `<p class="scope">${esc(j.scope.scope)}</p><p class="fine">Public scope verified against funding commitment.</p>` : `<p class="fine">${esc(j.scopeError || "Legacy assignment: no scope document attached.")}</p>`}<p class="fine">Client ${esc(j.client)}<br>${j.worker !== "0x" + "0".repeat(40) ? `Reviewer ${esc(j.worker)}` : "Open to a currently qualified reviewer"}</p><div class="reward"><strong>${formatUnits(j.amount, 6)} <small>${tokenSymbol}</small></strong><span>${isClient ? "YOUR COMMISSION" : isWorker ? "YOUR ASSIGNMENT" : j.status.toUpperCase()}</span></div><p class="fine">Accept ${new Date(Number(j.acceptBefore) * 1000).toLocaleString()} · submit ${new Date(Number(j.submitBefore) * 1000).toLocaleString()} · review ${new Date(Number(j.reviewBefore) * 1000).toLocaleString()}</p><p class="stage-hint">${esc(stageHint)}</p><div class="actions">${publish}${actions}</div><pre id="document-${j.id}"></pre></div></article>`;
        })
        .join("")
    : '<article class="ticket"><div class="ticket-body"><h3>No assignments yet.</h3><p class="terms">Connect a client wallet, register its document key and fund the first review.</p></div></article>';
  syncButtons();
  if (account) {
    const session = generation,
      owner = account;
    listDeviceKeys(namespace())
      .then((history: any[]) => {
        if (session !== generation || owner !== account) return;
        document
          .querySelectorAll<HTMLSelectElement>("[data-history]")
          .forEach((select) =>
            history.forEach((d) => {
              if (d.keyId !== device?.keyId) {
                const option = document.createElement("option");
                option.value = d.keyId;
                option.textContent = `Previous key ${d.keyId.slice(0, 12)}…`;
                select.append(option);
              }
            }),
          );
      })
      .catch(() => {
        if (session === generation)
          $("#key-status").textContent =
            "Device key storage unavailable. Check browser storage permissions.";
      });
  }
}
async function connect(allowSwitch = true) {
  const provider = window.ethereum;
  if (!provider) {
    reveal("funding-help");
    throw Error(
      "No wallet found. Install a wallet using the link in network help, or open this page inside your mobile wallet.",
    );
  }
  await provider.request({ method: "eth_requestAccounts" });
  const session = generation;
  const assertCurrent = () => {
    if (session !== generation)
      throw Error("Wallet changed during connection. Connect again.");
  };
  const chainId = Number(await provider.request({ method: "eth_chainId" }));
  assertCurrent();
  if (chainId !== config.chainId) {
    if (!allowSwitch)
      throw Error(
        "Your wallet did not select the required network. Open network help, then reconnect.",
      );
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${config.chainId.toString(16)}` }],
      });
    } catch (error: any) {
      if (error?.code !== 4902 || config.chainId !== 43113) {
        reveal("funding-help");
        throw error;
      }
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xa869",
            chainName: "Avalanche Fuji",
            nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
            rpcUrls: [config.rpcUrl],
            blockExplorerUrls: ["https://testnet.snowtrace.io"],
          },
        ],
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xa869" }],
      });
    }
    return connect(false);
  }
  const addresses = await provider.request({ method: "eth_accounts" });
  assertCurrent();
  const owner = addresses[0] as Address;
  if (!owner) throw Error("Wallet has no authorized account");
  const nextDevice = await loadOrCreateDeviceKey(
    `review-pass:${config.chainId}:${config.keyRegistry}:${owner.toLowerCase()}`,
  );
  assertCurrent();
  const currentAccounts = await provider.request({ method: "eth_accounts" });
  assertCurrent();
  const currentChain = Number(
    await provider.request({ method: "eth_chainId" }),
  );
  assertCurrent();
  if (
    currentAccounts[0]?.toLowerCase() !== owner.toLowerCase() ||
    currentChain !== config.chainId
  )
    throw Error("Wallet changed during connection. Connect again.");
  account = owner;
  device = nextDevice;
  wallet = createWalletClient({
    account: owner,
    chain: network,
    transport: custom(provider),
  });
  generation++;
  await refresh();
  if (account === owner)
    $("#notice").textContent =
      "Wallet connected. Your device key stays in this browser profile.";
}
async function register() {
  const session = generation,
    currentDevice = device;
  const pub = await getDevicePublicKey(currentDevice);
  const now = (await client.getBlock()).timestamp;
  if (session !== generation) throw Error("Wallet session changed");
  await tx(
    "register",
    [pub, now + 30n * 86400n],
    "QualificationKeys",
    config.keyRegistry,
  );
}
async function validatePresentation(id: string, p: any, owner: Address) {
  if (
    !/^0x[a-f0-9]{512}$/i.test(p.proof) ||
    !Array.isArray(p.publicInputs) ||
    p.publicInputs.length !== 9 ||
    p.publicInputs.some(
      (x: unknown) => typeof x !== "string" || !/^[0-9]{1,78}$/.test(x),
    )
  )
    throw Error("This is not a public qualification proof");
  if (BigInt(p.publicInputs[6]) !== BigInt(owner))
    throw Error("Proof belongs to another payment wallet");
  // Contract simulation verifies the actual deployed verifier AND current issuer/root,
  // scope, class, context, nullifier, deadlines and recipient. No transaction is sent.
  try {
    await client.simulateContract({
      address: config.escrow,
      abi: config.abi.QualificationEscrow,
      functionName: "accept",
      args: [BigInt(id), p.proof, p.publicInputs.map(BigInt)],
      account: owner,
    });
  } catch {
    throw Error(
      "Proof is not valid for this open assignment and current issuer state. Refresh and generate a new proof.",
    );
  }
}
function withCancellation<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () =>
      reject(Error("Proof generation cancelled; no transaction was sent"));
    if (signal.aborted) return cancel();
    signal.addEventListener("abort", cancel, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", cancel));
  });
}
async function generatePresentation(id: string) {
  const j = jobs.find((v) => v.id === id),
    owner = account!,
    session = generation;
  if (
    !owner ||
    !j ||
    !config.browserProver ||
    config.browserProver.verifier.toLowerCase() !==
      config.verifier.toLowerCase()
  )
    throw Error("Connect your wallet to a configured browser prover");
  const controller = new AbortController();
  proofController = controller;
  const timeout = setTimeout(() => controller.abort(), 180_000);
  const current = () => {
    if (
      controller.signal.aborted ||
      session !== generation ||
      account !== owner
    )
      throw Error("Proof generation cancelled; no transaction was sent");
  };
  const progress = (text: string) => {
    current();
    const el = document.getElementById(`proof-progress-${id}`);
    if (el) el.textContent = text;
    $("#notice").textContent = text;
  };
  const cancel = document.querySelector<HTMLButtonElement>(
    `[data-action="cancel-proof"][data-id="${id}"]`,
  )!;
  cancel.dataset.eligible = "true";
  syncButtons();
  const inputs = ["credential", "holder"].map((kind) =>
    document.querySelector<HTMLInputElement>(`[data-${kind}="${id}"]`)!,
  );
  try {
    const privateFiles = await Promise.all(
      inputs.map(async (input) => {
        const file = input.files?.[0];
        if (!file || file.size > 16_384)
          throw Error("Select credential and holder JSON files below16KB each");
        try {
          return JSON.parse(await file.text());
        } catch {
          throw Error("A selected private file is not valid JSON");
        }
      }),
    );
    inputs.forEach((input) => {
      input.value = "";
    });
    current();
    progress("Retrieving the whole public issuer snapshot…");
    const response = await fetch("/api/snapshot", {
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok)
      throw Error(
        "The current issuer snapshot is unavailable. Ask the issuer to publish its latest snapshot.",
      );
    if (!response.body) throw Error("Issuer snapshot response is empty");
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.length;
        if (length > 1_048_576)
          throw Error("Issuer snapshot exceeds browser limit");
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    const snapshotBytes = new Uint8Array(length);
    let offset = 0;
    for (const part of chunks) {
      snapshotBytes.set(part, offset);
      offset += part.length;
    }
    let snapshot: unknown;
    try {
      snapshot = JSON.parse(new TextDecoder().decode(snapshotBytes));
    } catch {
      throw Error("Issuer snapshot is not valid JSON");
    }
    const [ctx, block] = await withCancellation(
      Promise.all([read("contextFor", [BigInt(id)]), client.getBlock()]),
      controller.signal,
    );
    current();
    const expiry = privateFiles[0]?.expiry;
    if (!Number.isSafeInteger(expiry) || expiry <= Number(block.timestamp))
      throw Error(
        "The selected credential has expired or has an invalid expiry",
      );
    const deadline = [
      j.acceptBefore - 1n,
      BigInt(expiry),
      block.timestamp + 600n,
    ].reduce((a, b) => (a < b ? a : b));
    if (deadline <= block.timestamp)
      throw Error("The assignment acceptance deadline has passed");
    const p = await proveInBrowser(
      config.browserProver,
      {
        credential: privateFiles[0],
        holder: privateFiles[1],
        snapshot,
        context: String(ctx),
        recipient: owner,
        deadline: String(deadline),
        class: String(j.class),
      },
      { signal: controller.signal, onProgress: progress },
    );
    privateFiles.length = 0;
    current();
    progress("Checking the proof against the deployed contract…");
    await withCancellation(
      validatePresentation(id, p, owner),
      controller.signal,
    );
    current();
    proofs.set(id, p);
    return {
      message:
        "Qualification proof verified. Review the scope, then select Verify proof & accept to sign with your wallet.",
    };
  } finally {
    controller.abort();
    clearTimeout(timeout);
    inputs.forEach((input) => {
      input.value = "";
    });
    cancel.dataset.eligible = "false";
    if (proofController === controller) proofController = undefined;
  }
}

async function action(name: string, id: string) {
  const j = jobs.find((v) => v.id === id);
  switch (name) {
    case "generate":
      return generatePresentation(id);
    case "publish": {
      if (!j.scope || j.client.toLowerCase() !== account?.toLowerCase())
        throw Error("Only the funding client can publish verified scope");
      const owner = account!;
      const listing = {
        schema: 2 as const,
        taskClass: "technical-review" as const,
        qualificationClass: String(j.class),
        settlementChain: config.chainId,
        escrow: config.escrow,
        jobId: id,
        client: owner.toLowerCase() as Hex,
        paymentToken: config.token,
        reward: String(j.amount),
        acceptBefore: Number(j.acceptBefore),
        title: j.scope.title,
        publicScope: {
          reference: j.termsReference.slice(2),
          sha256: j.termsDigest,
        },
      };
      const leaseBlocks = Number(
        ($("#lease-blocks") as HTMLInputElement).value,
      );
      if (
        !Number.isInteger(leaseBlocks) ||
        leaseBlocks < 3 ||
        leaseBlocks > 43200
      )
        throw Error("Choose a discovery lease between3and43200blocks");
      const entity = {
        key: `0x${"1".repeat(64)}` as Hex,
        owner: listing.client,
        creator: listing.client,
        expiresAt: 1n,
        readonly: true,
        permissionlessExtension: false,
        listing,
      };
      if (!(await verifyListing(entity)))
        throw Error(
          "Refresh the assignment: its funding, scope or acceptance state changed",
        );
      try {
        await window.ethereum!.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${(7738577).toString(16)}` }],
        });
        const driver = createArkivListingDriver({
          namespace: "review-pass",
          ...arkivConfig,
          account: { address: owner, type: "json-rpc" },
          walletTransport: custom(window.ethereum!),
        });
        const result = await driver.publish(listing, leaseBlocks);
        $("#discovery-change").textContent =
          `Listing published: ${result.entityKey}; transaction ${result.txHash}; expires at Arkiv block ${result.expiresAt}. Reconnect your settlement wallet to continue.`;
        try {
          await window.ethereum!.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${config.chainId.toString(16)}` }],
          });
        } catch {
          $("#discovery-change").textContent +=
            " The return network switch was not completed. Your listing is published; switch back to the settlement network manually.";
        }
      } catch (error) {
        $("#discovery-change").textContent =
          `Publication was not confirmed: ${error instanceof Error ? error.message.slice(0, 160) : "wallet or network failure"}. Check your Arkiv wallet activity before retrying, then reconnect the settlement wallet.`;
        return "preserve";
      }
      return "preserve";
    }
    case "prepare": {
      const ctx = await read("contextFor", [BigInt(id)]);
      $(`#command-${id}`).textContent =
        `qualification-prover state --snapshot snapshot.json --credential credential.json --out private-state.json\nqualification-prover prove --setup setup --credential credential.json --holder holder.json --state private-state.json --context ${ctx} --recipient ${account} --deadline ${j.acceptBefore - 1n} --class ${j.class} --out presentation.json`;
      return "preserve";
    }
    case "accept": {
      if (j.scopeError)
        throw Error("Verify the funded public scope before accepting");
      const p = proofs.get(id);
      if (!p || BigInt(p.publicInputs[6]) !== BigInt(account!))
        throw Error("Proof recipient must be your connected wallet");
      await tx("accept", [BigInt(id), p.proof, p.publicInputs.map(BigInt)]);
      proofs.delete(id);
      break;
    }
    case "submit": {
      const session = generation,
        worker = account!;
      const bindings = await Promise.all([
        keyBinding(worker),
        keyBinding(j.client),
      ]);
      if (
        (await getDevicePublicKey(device)).toLowerCase() !==
        bindings[0].publicKey.toLowerCase()
      )
        throw Error("Register this device key before submitting");
      const text = ($(`#review-${id}`) as HTMLTextAreaElement).value;
      if (!text.trim() || text.length > 50000)
        throw Error("Write a review up to 50,000 characters");
      const envelope = await encryptForRecipients(
        new TextEncoder().encode(text),
        context(id),
        bindings,
        { now: Number((await client.getBlock()).timestamp) },
      );
      const ensureBindings = async () => {
        const current = await Promise.all([
          keyBinding(worker),
          keyBinding(j.client),
        ]);
        const now = Number((await client.getBlock()).timestamp);
        if (generation !== session || account !== worker)
          throw Error("Wallet changed during delivery");
        if (
          current.some(
            (binding, i) =>
              binding.publicKey.toLowerCase() !==
                bindings[i].publicKey.toLowerCase() ||
              binding.version !== bindings[i].version ||
              binding.expiresAt !== bindings[i].expiresAt ||
              binding.expiresAt <= now,
          )
        )
          throw Error(
            "A recipient key changed or expired. Encrypt the report again with current keys.",
          );
      };
      const digest = sha256(
        bytesToHex(new TextEncoder().encode(JSON.stringify(envelope))),
      );
      await ensureBindings();
      if (generation !== session) throw Error("Wallet changed before upload");
      let ref: StorageRef;
      if (publicStorage) {
        ref = await publicStorage.upload(
          new TextEncoder().encode(JSON.stringify(envelope)),
        );
      } else {
        const expiresAt = Number((await client.getBlock()).timestamp) + 240;
        const signature = await wallet.signMessage({
          account,
          message: uploadMessage(
            config.chainId,
            config.escrow,
            id,
            digest,
            expiresAt,
          ),
        });
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: id, envelope, expiresAt, signature }),
        });
        const body = await response.json();
        if (!response.ok) throw Error(body.error);
        ref = body;
      }
      if (generation !== session)
        throw Error("Wallet changed; uploaded review was not submitted");
      if (ref.sha256 !== digest)
        throw Error("Storage response digest mismatch");
      await ensureBindings();
      await tx("submitDocument", [BigInt(id), `0x${ref.reference}`, digest]);
      break;
    }
    case "retrieve": {
      const session = generation;
      const result = await fetchDocument(id);
      const digest = await read("documentDigests", [BigInt(id)]);
      if (
        sha256(
          bytesToHex(new TextEncoder().encode(JSON.stringify(result.envelope))),
        ) !== digest
      )
        throw Error(
          "Envelope differs from the assigned worker’s onchain commitment",
        );
      const selected = (
        document.querySelector(`[data-history="${id}"]`) as HTMLSelectElement
      ).value as Hex;
      const key = selected
        ? await loadDeviceKey(namespace(), selected)
        : device;
      const plaintext = await decryptForRecipient(
        result.envelope,
        context(id),
        account!,
        key,
      );
      if (session !== generation) throw Error("Wallet session changed");
      $(`#document-${id}`).textContent = new TextDecoder().decode(plaintext);
      return "preserve";
    }
    case "export": {
      const result = await fetchDocument(id);
      saveFile(
        `review-pass-${id}-encrypted.json`,
        JSON.stringify(
          {
            format: "review-pass-export",
            version: 1,
            chainId: config.chainId,
            escrow: config.escrow,
            jobId: id,
            ...result,
          },
          null,
          2,
        ),
        "application/json",
      );
      return {
        preserve: true,
        message: `Downloaded review-pass-${id}-encrypted.json. This export contains ciphertext; an authorized recipient key is still required to decrypt it.`,
      };
    }
    case "save": {
      if (
        account?.toLowerCase() !== j.client.toLowerCase() &&
        account?.toLowerCase() !== j.worker.toLowerCase()
      )
        throw Error("Only a recipient can save a decrypted report");
      const text = $(`#document-${id}`).textContent;
      if (!text) throw Error("Retrieve and decrypt this report first");
      saveFile(`review-pass-${id}-PRIVATE.txt`, text, "text/plain");
      return {
        preserve: true,
        message: `Saved your decrypted report locally as review-pass-${id}-PRIVATE.txt.`,
      };
    }
    case "pay":
      await tx("approveAndPay", [BigInt(id)]);
      break;
    case "dispute":
      await tx("dispute", [BigInt(id)]);
      break;
    case "claim":
      await tx("claimAfterReview", [BigInt(id)]);
      break;
    case "refund":
      await tx("refund", [BigInt(id)]);
      break;
    case "resolve":
      await tx("resolveDispute", [BigInt(id), j.amount / 2n]);
      break;
  }
}
async function run(fn: () => Promise<any>) {
  if (busy) return;
  busy = true;
  const session = generation;
  $("#notice").className = "";
  $("#notice").textContent =
    "Waiting for your wallet or the configured network…";
  document.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    const result = await fn();
    if (session !== generation) return;
    $("#notice").textContent = result?.message ?? "Operation confirmed.";
    if (result !== "preserve" && !result?.preserve) await refresh();
  } catch (error: any) {
    if (session === generation) {
      $("#notice").className = "error";
      $("#notice").textContent = error.shortMessage ?? error.message;
    }
  } finally {
    busy = false;
    syncButtons();
    renderGuide();
  }
}
$("#start-client").onclick = () => chooseRole("client");
$("#start-reviewer").onclick = () => chooseRole("reviewer");
$("#task-reward").addEventListener("input", () => renderGuide());
$("#next-step").onclick = () => {
  const target = $("#next-step").dataset.target!;
  if (
    ["connect", "register", "mint", "connect-storage", "refresh"].includes(
      target,
    )
  )
    (document.getElementById(target) as HTMLButtonElement).click();
  else reveal(target);
};
$("#connect").onclick = () => run(() => connect());
$("#refresh").onclick = () => run(refresh);
$("#filter-board").onclick = () =>
  run(async () => {
    await startBoard();
    return {
      preserve: true,
      message: "Reward filter applied to live Arkiv listings.",
    };
  });
$("#refresh-board").onclick = () => run(() => board.refresh());
$("#opportunities").onclick = (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("[data-view-job]");
  if (b && boardState?.status === "live")
    run(async () => {
      selectedJobs.add(b.dataset.viewJob!);
      await refresh();
      document
        .getElementById(`job-${b.dataset.viewJob}`)
        ?.scrollIntoView({ block: "start" });
    });
};
void startBoard().catch(() => {
  $("#discovery-status").textContent = "Arkiv discovery unavailable";
});
window.addEventListener("pagehide", () => {
  board.stop();
  proofController?.abort();
});
if (publicStorage) {
  $("#connect-storage").onclick = () => run(() => publicStorage.connect());
  void publicStorage.initialize().catch(() => {
    $("#storage-status").textContent =
      "Swarm ID initialization failed. Reload to retry; no storage fallback is used.";
  });
  window.addEventListener("pagehide", () => publicStorage.destroy());
} else {
  $("#connect-storage").hidden = true;
  $("#storage-status").textContent =
    "Local rehearsal: real uploads and independent retrieval use the local Bee nodes. Public deployments use Swarm ID.";
}
$("#register").onclick = () => run(register);
$("#rotate").onclick = () =>
  run(async () => {
    const session = generation;
    const nextDevice = await rotateDeviceKey(namespace());
    if (session !== generation) throw Error("Wallet session changed");
    device = nextDevice;
    await register();
  });
$("#revoke-key").onclick = () =>
  run(async () => {
    await tx("revoke", [], "QualificationKeys", config.keyRegistry);
  });
$("#mint").onclick = () =>
  run(async () => {
    if (!config.testOnly || config.chainId !== 31338)
      throw Error(
        "Test mint is disabled; obtain canonical Fuji test USDC from Circle's faucet",
      );
    await tx("mint", [account, 1_000_000_000n], "DemoUSD", config.token);
  });
$("#create").onclick = () =>
  run(async () => {
    const session = generation,
      owner = account!;
    const binding = await keyBinding(account!);
    if (
      binding.publicKey === "0x" ||
      binding.expiresAt <= Number((await client.getBlock()).timestamp)
    )
      throw Error("Register a current client document key first");
    const now = (await client.getBlock()).timestamp;
    const value = (id: string) => ($(`#${id}`) as HTMLInputElement).value;
    if (!/^\d{1,9}(\.\d{1,6})?$/.test(value("task-reward")))
      throw Error("Enter a positive reward with at most6decimal places");
    const amount = parseUnits(value("task-reward"), 6);
    const minutes = ["accept-minutes", "submit-minutes", "review-minutes"].map(
      (id) => Number(value(id)),
    );
    if (minutes.some((v) => !Number.isInteger(v) || v < 2 || v > 10080))
      throw Error("Each stage must last between2minutes and7days");
    const acceptBefore = Number(now) + minutes[0] * 60,
      submitBefore = acceptBefore + minutes[1] * 60,
      reviewBefore = submitBefore + minutes[2] * 60;
    if (!($(`#scope-public`) as HTMLInputElement).checked)
      throw Error("Confirm this scope is safe to publish");
    const encoded = encodeTerms({
      format: "review-pass-public-terms",
      version: 1,
      chainId: config.chainId,
      escrow: config.escrow,
      client: owner,
      token: config.token,
      qualificationClass: "7",
      amount: String(amount),
      acceptBefore,
      submitBefore,
      reviewBefore,
      title: value("task-title"),
      scope: value("task-scope"),
      policy: "approval-timeout-arbitration-v1",
    });
    const expiresAt = Number(now) + 240;
    let content: StorageRef;
    if (generation !== session || account !== owner)
      throw Error("Wallet changed before scope upload");
    if (publicStorage) {
      content = await publicStorage.upload(encoded.bytes);
    } else {
      const signature = await wallet.signMessage({
        account: owner,
        message: termsUploadMessage(encoded.terms, encoded.digest, expiresAt),
      });
      if (generation !== session || account !== owner)
        throw Error("Wallet changed; task was not funded");
      const response = await fetch("/api/terms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ terms: encoded.terms, signature, expiresAt }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || "Scope upload failed");
      content = body;
    }
    if (
      !/^[0-9a-f]{64}$/i.test(content.reference) ||
      content.sha256 !== encoded.digest
    )
      throw Error("Invalid scope storage receipt");
    if (generation !== session)
      throw Error("Wallet changed; scope uploaded but task not funded");
    await tx("approve", [config.escrow, amount], "DemoUSD", config.token);
    if (generation !== session)
      throw Error("Wallet changed; allowance approved but task not funded");
    await tx("createJobWithDocument", [
      amount,
      7n,
      BigInt(acceptBefore),
      BigInt(submitBefore),
      BigInt(reviewBefore),
      encoded.digest,
      `0x${content.reference}`,
    ]);
  });
document.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>(
    "button[data-action]",
  );
  if (b?.dataset.action === "cancel-proof") {
    proofController?.abort();
    return;
  }
  if (b) run(() => action(b.dataset.action!, b.dataset.id!));
});
document.addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  if (!input.dataset.proof) return;
  run(async () => {
    const session = generation,
      owner = account!;
    const f = input.files?.[0];
    if (!f || f.size > 10000)
      throw Error("Choose a public proof JSON below10KB");
    let p: any;
    try {
      p = JSON.parse(await f.text());
    } catch {
      throw Error("This is not valid public proof JSON");
    }
    await validatePresentation(input.dataset.proof!, p, owner);
    if (session !== generation || owner !== account)
      throw Error("Wallet session changed");
    proofs.set(input.dataset.proof!, {
      proof: p.proof,
      publicInputs: p.publicInputs,
    });
  });
});
for (const event of ["accountsChanged", "chainChanged", "disconnect"])
  window.ethereum?.on?.(event, () => {
    proofController?.abort();
    generation++;
    account = undefined;
    device = undefined;
    wallet = undefined;
    proofs.clear();
    readiness = { key: false, gas: null, balance: null };
    $("#key-status").textContent =
      "Wallet session changed. Reconnect to continue.";
    $("#notice").textContent =
      "Private document views cleared after wallet change.";
    render();
  });
await refresh();

if (config.browserProver)
  $("#prover-help").textContent =
    "Bring the credential issued for you and your private holder file. Select them on an open task to generate a proof inside this browser. No private file is uploaded or stored by the app. First-time reviewers still need enrollment by the configured test issuer.";
