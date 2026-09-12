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
  } as any);
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
  $("#notice").textContent =
    "Transaction sent. Waiting for confirmed settlement…";
  const receipt = await waitForSettlement(client, {
    hash,
    chainId: config.chainId,
  });
  if (receipt.status !== "success") throw Error("Transaction reverted");
  return hash;
}
async function refresh() {
  const session = generation,
    owner = account,
    currentDevice = device;
  const count = Number(await read("nextJob"));
  const nextJobs: any[] = [];
  for (let i = 1; i <= count; i++) {
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
  ($("#mint") as HTMLButtonElement).hidden = !config.testOnly;
  $("#jobs").innerHTML = jobs.length
    ? [...jobs]
        .reverse()
        .map((j) => {
          const isClient = account?.toLowerCase() === j.client.toLowerCase(),
            isWorker = account?.toLowerCase() === j.worker.toLowerCase();
          let actions = "";
          if (j.status === "Open" && !j.scopeError)
            actions = `<details><summary>Generate your qualification proof locally</summary><p class="fine">Download the whole issuer snapshot. Reconstruct its root and path with your local credential; no credential identifier goes in the URL. The contract checks the authoritative root again at acceptance.</p><a href="/api/snapshot" download="snapshot.json">Download issuer snapshot</a><pre id="command-${j.id}">Connect your wallet, then prepare a proof request.</pre>${button("prepare", j.id, "Prepare local prover command")}</details><label class="fine">Import PUBLIC proof JSON (never your credential or holder file)<input type="file" accept=".json,application/json" data-proof="${j.id}"${!account ? " disabled" : ""}></label>${proofs.has(j.id) ? button("accept", j.id, "Verify proof & accept") : ""}`;
          if (j.status === "Accepted" && isWorker)
            actions = `<label class="fine" for="review-${j.id}">Private review for you and the client</label><textarea class="doc" id="review-${j.id}"></textarea>${button("submit", j.id, "Encrypt for client & submit")}`;
          if (["Submitted", "Paid", "Disputed", "Resolved"].includes(j.status))
            actions =
              button("retrieve", j.id, "Retrieve & decrypt review") +
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
          return `<article class="ticket"><div class="ticket-head"><span>ASSIGNMENT ${j.id}</span><span class="status">${j.status.toUpperCase()}</span></div><div class="ticket-body"><h3>${esc(j.scope?.title ?? "Technical review")}</h3>${j.scope ? `<p class="scope">${esc(j.scope.scope)}</p><p class="fine">Public scope verified against funding commitment.</p>` : `<p class="fine">${esc(j.scopeError || "Legacy assignment: no scope document attached.")}</p>`}<p class="fine">Client ${esc(j.client)}<br>${j.worker !== "0x" + "0".repeat(40) ? `Reviewer ${esc(j.worker)}` : "Open to a currently qualified reviewer"}</p><div class="reward"><strong>${formatUnits(j.amount, 6)} <small>${tokenSymbol}</small></strong><span>${isClient ? "YOUR COMMISSION" : isWorker ? "YOUR ASSIGNMENT" : "FUNDED"}</span></div><p class="fine">Accept ${new Date(Number(j.acceptBefore) * 1000).toLocaleString()} · submit ${new Date(Number(j.submitBefore) * 1000).toLocaleString()} · review ${new Date(Number(j.reviewBefore) * 1000).toLocaleString()}</p><div class="actions">${actions}</div><pre id="document-${j.id}"></pre></div></article>`;
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
      const bindings = await Promise.all([
        keyBinding(account!),
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
      const digest = sha256(
        bytesToHex(new TextEncoder().encode(JSON.stringify(envelope))),
      );
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
      const ref = await response.json();
      if (!response.ok) throw Error(ref.error);
      if (ref.sha256 !== digest)
        throw Error("Storage response digest mismatch");
      await tx("submitDocument", [BigInt(id), `0x${ref.reference}`, digest]);
      break;
    }
    case "retrieve": {
      const session = generation;
      const response = await fetch(`/api/document?job=${id}`);
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
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
          (b.disabled = !account && !["connect", "refresh"].includes(b.id)),
      );
  }
}
$("#connect").onclick = () => run(connect);
$("#refresh").onclick = () => run(refresh);
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
    if (!config.testOnly) throw Error("Test mint is disabled");
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
    const content = await response.json();
    if (!response.ok) throw Error(content.error || "Scope upload failed");
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
