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
const button = (action: string, id: string, label: string) =>
  `<button data-action="${action}" data-id="${id}"${!account || busy ? " disabled" : ""}>${label}</button>`;
$("#environment").textContent =
  `${config.environment.toUpperCase()} · ${config.testOnly ? "TEST ISSUER / TEST ASSETS" : "CONFIGURED PUBLIC TESTNET"} · WALLET-SIGNED TRANSACTIONS`;
$("#contracts").textContent =
  `Chain ${config.chainId} · escrow ${config.escrow.slice(0, 10)}…`;
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
    const binding = await keyBinding(owner);
    const pub = await getDevicePublicKey(currentDevice);
    const now = (await client.getBlock()).timestamp;
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
          let actions = "";
          const publish =
            j.status === "Open" && isClient && j.scope && !j.scopeError
              ? button("publish", j.id, "Publish discovery lease on Arkiv")
              : "";
          if (j.status === "Open" && !j.scopeError)
            actions = `<details><summary>Generate your qualification proof locally</summary><p class="fine">Download the whole issuer snapshot. Reconstruct its root and path with your local credential; no credential identifier goes in the URL. The contract checks the authoritative root again at acceptance.</p><a href="/api/snapshot" download="snapshot.json">Download issuer snapshot</a><pre id="command-${j.id}">Connect your wallet, then prepare a proof request.</pre>${button("prepare", j.id, "Prepare local prover command")}</details><label class="fine">Import PUBLIC proof JSON (never your credential or holder file)<input type="file" accept=".json,application/json" data-proof="${j.id}"${!account ? " disabled" : ""}></label>${proofs.has(j.id) ? button("accept", j.id, "Verify proof & accept") : ""}`;
          if (j.status === "Accepted" && isWorker)
            actions = `<label class="fine" for="review-${j.id}">Private review for you and the client</label><textarea class="doc" id="review-${j.id}"></textarea>${button("submit", j.id, "Encrypt for client & submit")}`;
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
              button("dispute", j.id, "Dispute review");
          if (j.status === "Submitted" && isWorker)
            actions += button("claim", j.id, "Claim after review deadline");
          if (["Open", "Accepted"].includes(j.status) && isClient)
            actions += button(
              "refund",
              j.id,
              "Refund after applicable deadline",
            );
          if (
            j.status === "Disputed" &&
            account?.toLowerCase() === config.arbitrator.toLowerCase()
          )
            actions += button("resolve", j.id, "Arbitrate 50 / 50 split");
          return `<article class="ticket" id="job-${j.id}"><div class="ticket-head"><span>ASSIGNMENT ${j.id}</span><span class="status">${j.status.toUpperCase()}</span></div><div class="ticket-body"><h3>${esc(j.scope?.title ?? "Technical review")}</h3>${j.scope ? `<p class="scope">${esc(j.scope.scope)}</p><p class="fine">Public scope verified against funding commitment.</p>` : `<p class="fine">${esc(j.scopeError || "Legacy assignment: no scope document attached.")}</p>`}<p class="fine">Client ${esc(j.client)}<br>${j.worker !== "0x" + "0".repeat(40) ? `Reviewer ${esc(j.worker)}` : "Open to a currently qualified reviewer"}</p><div class="reward"><strong>${formatUnits(j.amount, 6)} <small>${tokenSymbol}</small></strong><span>${isClient ? "YOUR COMMISSION" : isWorker ? "YOUR ASSIGNMENT" : j.status.toUpperCase()}</span></div><p class="fine">Accept ${new Date(Number(j.acceptBefore) * 1000).toLocaleString()} · submit ${new Date(Number(j.submitBefore) * 1000).toLocaleString()} · review ${new Date(Number(j.reviewBefore) * 1000).toLocaleString()}</p><div class="actions">${publish}${actions}</div><pre id="document-${j.id}"></pre></div></article>`;
        })
        .join("")
    : '<article class="ticket"><div class="ticket-body"><h3>No assignments yet.</h3><p class="terms">Connect a client wallet, register its document key and fund the first review.</p></div></article>';
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
async function connect() {
  const provider = window.ethereum;
  if (!provider)
    throw Error(
      "Install or enable an EIP-1193 wallet. No server wallet is substituted.",
    );
  await provider.request({ method: "eth_requestAccounts" });
  const session = generation;
  const assertCurrent = () => {
    if (session !== generation)
      throw Error("Wallet changed during connection. Connect again.");
  };
  const chainId = Number(await provider.request({ method: "eth_chainId" }));
  assertCurrent();
  if (chainId !== config.chainId) {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${config.chainId.toString(16)}` }],
    });
    throw Error("Network selected. Connect again to authorize this session.");
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
async function action(name: string, id: string) {
  const j = jobs.find((v) => v.id === id);
  switch (name) {
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
      return "preserve";
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
      return "preserve";
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
    $("#notice").textContent = "Operation confirmed.";
    if (result !== "preserve") await refresh();
  } catch (error: any) {
    if (session === generation) {
      $("#notice").className = "error";
      $("#notice").textContent = error.shortMessage ?? error.message;
    }
  } finally {
    busy = false;
    document
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach(
        (b) =>
          (b.disabled = b.dataset.viewJob
            ? boardState?.status !== "live"
            : !account &&
              ![
                "connect",
                "refresh",
                "filter-board",
                "refresh-board",
                "connect-storage",
              ].includes(b.id)),
      );
  }
}
$("#connect").onclick = () => run(connect);
$("#refresh").onclick = () => run(refresh);
$("#filter-board").onclick = () => run(startBoard);
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
window.addEventListener("pagehide", () => board.stop());
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
  if (b) run(() => action(b.dataset.action!, b.dataset.id!));
});
document.addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  if (!input.dataset.proof) return;
  run(async () => {
    const f = input.files?.[0];
    if (!f || f.size > 10000)
      throw Error("Choose a public proof JSON below 10KB");
    const p = JSON.parse(await f.text());
    if (
      !/^0x[a-f0-9]{512}$/i.test(p.proof) ||
      !Array.isArray(p.publicInputs) ||
      p.publicInputs.length !== 9 ||
      p.publicInputs.some((x: any) => typeof x !== "string" || !/^\d+$/.test(x))
    )
      throw Error("This is not a public qualification proof");
    if (BigInt(p.publicInputs[6]) !== BigInt(account!))
      throw Error("Proof belongs to another payment wallet");
    proofs.set(input.dataset.proof!, p);
  });
});
for (const event of ["accountsChanged", "chainChanged", "disconnect"])
  window.ethereum?.on?.(event, () => {
    generation++;
    account = undefined;
    device = undefined;
    wallet = undefined;
    proofs.clear();
    $("#key-status").textContent =
      "Wallet session changed. Reconnect to continue.";
    $("#notice").textContent =
      "Private document views cleared after wallet change.";
    render();
  });
await refresh();
