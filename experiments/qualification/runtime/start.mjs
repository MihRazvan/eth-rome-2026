// SPDX-License-Identifier: MIT
// Local multi-role experiment. The helper holds separate TEST role files on this machine.
// It must never be hosted as a remote prover or used with real credentials/funds.
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import { beeBytes } from "../transport/bytes.ts";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http as rpcHttp,
  keccak256,
  stringToHex,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";

const exec = promisify(execFile);
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const local = path.join(root, ".runtime/qualification");
const contracts = path.join(root, "experiments/qualification/contracts");
const proverSource = path.join(root, "experiments/qualification/prover");
const binary = path.join(local, "prover");
const file = (name) => path.join(local, name);
const json = async (name) => JSON.parse(await readFile(file(name), "utf8"));
const save = (name, value) =>
  writeFile(
    file(name),
    JSON.stringify(
      value,
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ) + "\n",
    { mode: 0o600 },
  );
const proofCommand = (...args) =>
  exec(binary, args, { cwd: local, maxBuffer: 2 ** 20 });
const chain = defineChain({
  id: 31338,
  name: "Qualification local Anvil",
  nativeCurrency: { name: "Test Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:18547"] } },
});
const publicClient = createPublicClient({ chain, transport: rpcHttp() });
// Anvil's PUBLIC development mnemonic. It has no secrecy or production role.
const mnemonic = "test test test test test test test test test test test junk";
const roles = [
  "issuer",
  "client",
  "worker",
  "relayer",
  "arbitrator",
  "clientB",
];
const wallets = Object.fromEntries(
  roles.map((role, addressIndex) => [
    role,
    createWalletClient({
      account: mnemonicToAccount(mnemonic, { addressIndex }),
      chain,
      transport: rpcHttp(),
    }),
  ]),
);
const artifact = async (name) => {
  if (name === "Verifier") {
    // Fixed fixture and fresh runtime verifiers share a Solidity basename. Resolve by
    // compiler provenance, never by whichever output path Foundry assigned first.
    const out = path.join(contracts, "out");
    for (const entry of await readdir(out, { recursive: true })) {
      if (path.basename(entry) !== "Verifier.json") continue;
      const candidate = JSON.parse(
        await readFile(path.join(out, entry), "utf8"),
      );
      if (
        candidate.metadata?.settings?.compilationTarget?.[
          "src/generated/QualificationVerifier.sol"
        ] === "Verifier"
      )
        return candidate;
    }
    throw new Error(
      "Matching fresh runtime verifier artifact was not generated",
    );
  }
  return JSON.parse(
    await readFile(
      path.join(contracts, "out", `${name}.sol`, `${name}.json`),
      "utf8",
    ),
  );
};
let escrow,
  token,
  verifier,
  issuer,
  snapshot,
  child,
  busy = false;
let currentProof = null;
let storage, snapshotRef;
const documents = new Map();
let events = [];
const record = (action, details = {}) =>
  events.unshift({ time: new Date().toISOString(), action, ...details });
const read = (target, functionName, args = []) =>
  publicClient.readContract({
    address: target.address,
    abi: target.abi,
    functionName,
    args,
  });
async function write(role, target, functionName, args = []) {
  const hash = await wallets[role].writeContract({
    address: target.address,
    abi: target.abi,
    functionName,
    args,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success")
    throw new Error(`${functionName} transaction reverted`);
  record(functionName, { hash, gas: receipt.gasUsed.toString() });
  return receipt;
}
async function deploy(name, args = []) {
  const a = await artifact(name);
  const hash = await wallets.issuer.deployContract({
    abi: a.abi,
    bytecode: a.bytecode.object,
    args,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success");
  return { address: receipt.contractAddress, abi: a.abi };
}
async function newJob(clientRole = "client") {
  const now = (await publicClient.getBlock()).timestamp;
  await write(clientRole, escrow, "createJob", [
    250_000_000n,
    7n,
    now + 3600n,
    now + 7200n,
    now + 10800n,
    keccak256(
      stringToHex(
        "Confidential technical review; qUSD test reward; trusted test arbitrator; review timeout pays timely submissions.",
      ),
    ),
  ]);
  currentProof = null;
  return read(escrow, "nextJob");
}
async function generate(id, overrides = {}) {
  const job = await read(escrow, "jobs", [id]);
  // Fetch the WHOLE issuer snapshot; credential index is only used by the local helper.
  const downloaded = await storage.download(snapshotRef);
  const advertised = JSON.parse(new TextDecoder().decode(downloaded));
  assert.equal(
    advertised.root,
    String(await read(escrow, "revocationRoot")),
    "Downloaded snapshot must match authoritative onchain root",
  );
  await writeFile(file("downloaded-snapshot.json"), downloaded, {
    mode: 0o600,
  });
  await proofCommand(
    "state",
    "--credential",
    file("credential.json"),
    "--snapshot",
    file("downloaded-snapshot.json"),
    "--out",
    file("private-state.json"),
  );
  const start = performance.now();
  await proofCommand(
    "prove",
    "--setup",
    file("setup"),
    "--credential",
    overrides.credential ?? file("credential.json"),
    "--holder",
    file("holder.json"),
    "--state",
    file("private-state.json"),
    "--context",
    String(overrides.context ?? (await read(escrow, "contextFor", [id]))),
    "--recipient",
    overrides.recipient ?? wallets.worker.account.address,
    "--deadline",
    String(job[4] - 1n),
    "--class",
    String(overrides.class ?? 7),
    "--out",
    file("proof.json"),
  );
  const proof = await json("proof.json");
  proof.totalHelperMs = Math.round(performance.now() - start);
  proof.jobId = id.toString();
  record("Proof generated locally", {
    proveMs: proof.proveMs,
    totalHelperMs: proof.totalHelperMs,
    bytes: proof.proofBytes,
  });
  return proof;
}
async function updateRoot(revoked) {
  await proofCommand(
    "snapshot",
    "--revoke",
    revoked ? "42" : "",
    "--out",
    file("snapshot.json"),
  );
  snapshot = await json("snapshot.json");
  snapshotRef = await storage.upload(
    new Uint8Array(await readFile(file("snapshot.json"))),
  );
  await write("issuer", escrow, "setRoot", [BigInt(snapshot.root)]);
  record("Issuer-wide snapshot stored on local Bee", snapshotRef);
}
async function state() {
  const count = await read(escrow, "nextJob");
  const jobs = [];
  for (let id = 1n; id <= count; id++) {
    const j = await read(escrow, "jobs", [id]);
    jobs.push({
      id,
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
      terms: j[8],
      deliverable: j[9],
    });
  }
  return {
    mode: "LOCAL EXPERIMENT — test issuer, test money, separate role files in one local helper",
    chainId: chain.id,
    storage: { environment: storage.environment, snapshot: snapshotRef },
    addresses: Object.fromEntries(
      roles.map((r) => [r, wallets[r].account.address]),
    ),
    escrow: escrow.address,
    verifier: verifier.address,
    root: await read(escrow, "revocationRoot"),
    epoch: await read(escrow, "rootEpoch"),
    revoked: snapshot.revokedIndices.includes(42),
    workerBalance: await read(token, "balanceOf", [
      wallets.worker.account.address,
    ]),
    jobs,
    proof: currentProof,
    events: events.slice(0, 25),
  };
}
async function rejects(label, fn, results) {
  let rejected = false;
  try {
    await fn();
  } catch {
    rejected = true;
  }
  assert.ok(rejected, `${label} unexpectedly succeeded`);
  results.push({ check: label, result: "PASS" });
}
async function selfTest() {
  const results = [];
  const checkpoint = await publicClient.request({ method: "evm_snapshot" });
  const id = await newJob();
  const proof = await generate(id);
  await save("integration-proof.json", proof);
  await writeFile(
    file("integration-verifier.sol"),
    await readFile(
      path.join(contracts, "src/generated/QualificationVerifier.sol"),
    ),
  );
  const inputs = proof.publicInputs.map(BigInt);
  await read(verifier, "verifyProof", [proof.proof, inputs]);
  results.push({
    check:
      "Actual Groth16 proof verified by exported Solidity verifier on local Anvil",
    result: "PASS",
    proveMs: proof.proveMs,
    totalHelperMs: proof.totalHelperMs,
    bytes: proof.proofBytes,
    constraints: proof.constraints,
  });
  results.push({
    check:
      "Issuer-wide snapshot uploaded to local Bee1633, retrieved through1635, MiMC root reconstructed locally and matched onchain state before proving",
    result: "PASS",
    reference: snapshotRef.reference,
  });
  for (let index = 0; index < 9; index++) {
    const changed = [...inputs];
    changed[index]++;
    await rejects(
      `Solidity verifier rejects modified ${proof.publicInputNames[index]}`,
      () => read(verifier, "verifyProof", [proof.proof, changed]),
      results,
    );
  }
  await rejects(
    "Malformed proof rejected",
    () => read(verifier, "verifyProof", ["0x", inputs]),
    results,
  );
  const copy = { ...(await json("credential.json")), class: 8 };
  await save("forged-credential.json", copy);
  await rejects(
    "Changing issuer-signed qualification cannot generate proof",
    () =>
      generate(id, { credential: file("forged-credential.json"), class: 8 }),
    results,
  );
  await rejects(
    "Wrong required class cannot generate proof",
    () => generate(id, { class: 8 }),
    results,
  );
  const receipt = await write("relayer", escrow, "accept", [
    id,
    proof.proof,
    inputs,
  ]);
  results.push({
    check: "Third-party relay assigns proven worker, with real proof",
    result: "PASS",
    gas: receipt.gasUsed,
    transaction: receipt.transactionHash,
  });
  assert.equal(
    (await read(escrow, "jobs", [id]))[1].toLowerCase(),
    wallets.worker.account.address.toLowerCase(),
  );
  await rejects(
    "Accepted assignment cannot replay",
    () => write("relayer", escrow, "accept", [id, proof.proof, inputs]),
    results,
  );
  const next = await newJob("clientB");
  const nextProof = await generate(next);
  const independent = await exec(
    "node",
    [
      path.join(
        root,
        "experiments/qualification/runtime/verify-presentation.mjs",
      ),
      "--rpc",
      chain.rpcUrls.default.http[0],
      "--escrow",
      escrow.address,
      "--job",
      String(next),
      "--proof",
      file("proof.json"),
    ],
    { cwd: root },
  );
  assert.equal(JSON.parse(independent.stdout).valid, true);
  results.push({
    check:
      "Second client funds its own assignment; separate verifier process validates public presentation without credential or issuer key files",
    result: "PASS",
    client: wallets.clientB.account.address,
  });
  assert.notEqual(nextProof.publicInputs[7], proof.publicInputs[7]);
  results.push({
    check: "Different assignment creates a different scoped nullifier",
    result: "PASS",
    caveat: "Reused payout address still links these test assignments",
  });
  await rejects(
    "Proof for first assignment cannot accept second assignment",
    () => write("relayer", escrow, "accept", [next, proof.proof, inputs]),
    results,
  );
  await updateRoot(true);
  await rejects(
    "Previously valid proof rejected after issuer root changes",
    () =>
      write("relayer", escrow, "accept", [
        next,
        nextProof.proof,
        nextProof.publicInputs.map(BigInt),
      ]),
    results,
  );
  await rejects(
    "Revoked credential cannot generate new proof",
    () => generate(next),
    results,
  );
  await write("worker", escrow, "submit", [
    id,
    keccak256(stringToHex("Local acceptance test deliverable commitment")),
  ]);
  await write("client", escrow, "approveAndPay", [id]);
  assert.equal(
    await read(token, "balanceOf", [wallets.worker.account.address]),
    250_000_000n,
  );
  results.push({
    check:
      "Revocation blocks new assignment but submitted work still receives 250 qUSD",
    result: "PASS",
  });
  await rejects(
    "Payment cannot be repeated",
    () => write("client", escrow, "approveAndPay", [id]),
    results,
  );
  await save("acceptance.json", {
    sourceRevision: (
      await exec("git", ["rev-parse", "HEAD"], { cwd: root })
    ).stdout.trim(),
    recordedAt: new Date().toISOString(),
    chain: chain.name,
    chainId: chain.id,
    testOnly: true,
    setupTrust: "Local single-process Groth16 setup; no production ceremony",
    deployedVerifier: verifier.address,
    deployedVerifierCodeHash: keccak256(
      await publicClient.getCode({ address: verifier.address }),
    ),
    escrow: escrow.address,
    results,
  });
  assert.equal(
    await publicClient.request({ method: "evm_revert", params: [checkpoint] }),
    true,
  );
  await proofCommand(
    "snapshot",
    "--revoke",
    "",
    "--out",
    file("snapshot.json"),
  );
  snapshot = await json("snapshot.json");
  snapshotRef = await storage.upload(
    new Uint8Array(await readFile(file("snapshot.json"))),
  );
  currentProof = null;
  events = [];
  console.log(
    `Actual-proof integration: ${results.length} checks passed. Evidence: .runtime/qualification/acceptance.json`,
  );
}
async function bootstrap() {
  await mkdir(local, { recursive: true, mode: 0o700 });
  try {
    await publicClient.getChainId();
    throw new Error(
      "Port18547 already has an RPC. Stop this experiment intentionally before restarting; refusing to reset it.",
    );
  } catch (error) {
    if (error.message.startsWith("Port18547")) throw error;
  }
  const log = await import("node:fs").then((fs) =>
    fs.openSync(file("anvil.log"), "a", 0o600),
  );
  child = spawn(
    "anvil",
    [
      "--host",
      "127.0.0.1",
      "--port",
      "18547",
      "--chain-id",
      String(chain.id),
      "--silent",
    ],
    { stdio: ["ignore", log, log] },
  );
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      await publicClient.getChainId();
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  console.log("Building local prover and generating fresh test setup…");
  await exec("go", ["build", "-o", binary, "."], {
    cwd: proverSource,
    maxBuffer: 2 ** 20,
  });
  await proofCommand(
    "setup",
    "--dir",
    file("setup"),
    "--verifier",
    path.join(contracts, "src/generated/QualificationVerifier.sol"),
  );
  await proofCommand("holder-new", "--out", file("holder.json"));
  await proofCommand("issuer-new", "--out", file("issuer.json"));
  const holder = await json("holder.json");
  issuer = await json("issuer.json");
  await proofCommand(
    "issue",
    "--issuer-key",
    file("issuer.json"),
    "--commitment",
    holder.holderCommitment,
    "--index",
    "42",
    "--class",
    "7",
    "--expiry",
    String(Math.floor(Date.now() / 1000) + 86400),
    "--out",
    file("credential.json"),
  );
  assert.equal(
    Object.hasOwn(await json("credential.json"), "holderSecret"),
    false,
  );
  await proofCommand(
    "snapshot",
    "--revoke",
    "",
    "--out",
    file("snapshot.json"),
  );
  snapshot = await json("snapshot.json");
  const stack = JSON.parse(
    await readFile(
      path.join(root, "experiments/qualification/transport/local-stack.json"),
      "utf8",
    ),
  );
  storage = beeBytes({
    environment: "local-bee",
    uploadUrl: "http://127.0.0.1:1633",
    downloadUrl: "http://127.0.0.1:1635",
    postageBatchId:
      process.env.QUALIFICATION_LOCAL_POSTAGE ?? stack.localPostage.batchID,
  });
  snapshotRef = await storage.upload(
    new Uint8Array(await readFile(file("snapshot.json"))),
  );
  await exec("forge", ["build", "--root", contracts], {
    cwd: root,
    maxBuffer: 4 * 2 ** 20,
  });
  verifier = await deploy("Verifier");
  token = await deploy("DemoUSD");
  escrow = await deploy("QualificationEscrow", [
    token.address,
    verifier.address,
    BigInt(issuer.issuerX),
    BigInt(issuer.issuerY),
    BigInt(snapshot.root),
    wallets.arbitrator.account.address,
  ]);
  await write("issuer", token, "mint", [
    wallets.client.account.address,
    10_000_000_000n,
  ]);
  await write("client", token, "approve", [escrow.address, 10_000_000_000n]);
  await write("issuer", token, "mint", [
    wallets.clientB.account.address,
    10_000_000_000n,
  ]);
  await write("clientB", token, "approve", [escrow.address, 10_000_000_000n]);
  await save("deployment.json", {
    chainId: chain.id,
    escrow: escrow.address,
    token: token.address,
    verifier: verifier.address,
    testOnly: true,
  });
}
async function action(input) {
  const id = BigInt(input.id ?? 0);
  switch (input.action) {
    case "create":
      return newJob();
    case "prove":
      currentProof = null;
      currentProof = await generate(id);
      return null;
    case "accept":
      if (!currentProof || currentProof.jobId !== String(id))
        throw new Error("Generate a proof for this assignment first.");
      await write("relayer", escrow, "accept", [
        id,
        currentProof.proof,
        currentProof.publicInputs.map(BigInt),
      ]);
      return null;
    case "revoke":
      return updateRoot(true);
    case "restore":
      return updateRoot(false);
    case "submit-document": {
      if (
        typeof input.envelope !== "string" ||
        !/^(?:[a-f0-9]{2}){1,6000}$/.test(input.envelope)
      )
        throw new Error("Bounded ciphertext envelope required");
      const bytes = new Uint8Array(Buffer.from(input.envelope, "hex"));
      const envelope = JSON.parse(new TextDecoder().decode(bytes));
      if (
        Object.keys(envelope).sort().join(",") !==
          "algorithm,ciphertext,iv,version" ||
        envelope.algorithm !== "A256GCM" ||
        envelope.version !== 1
      )
        throw new Error("Encrypted document envelope required");
      const ref = await storage.upload(bytes);
      await write("worker", escrow, "submit", [id, `0x${ref.reference}`]);
      documents.set(id.toString(), ref);
      record("Ciphertext stored; key remains in browser", ref);
      return null;
    }
    case "retrieve": {
      const ref = documents.get(id.toString());
      if (!ref)
        throw new Error("No encrypted document recorded for this assignment.");
      const bytes = await storage.download(ref);
      return {
        envelope: Buffer.from(bytes).toString("hex"),
        reference: ref.reference,
      };
    }
    case "pay":
      return write("client", escrow, "approveAndPay", [id]);
    case "dispute":
      return write("client", escrow, "dispute", [id]);
    case "resolve":
      return write("arbitrator", escrow, "resolveDispute", [id, 125_000_000n]);
    default:
      throw new Error("Unknown action");
  }
}
async function serve() {
  const origin = "http://127.0.0.1:18787";
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    );
    const send = (code, value) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(value, (_, v) =>
          typeof v === "bigint" ? String(v) : v,
        ),
      );
    };
    if (req.headers.host !== "127.0.0.1:18787")
      return send(403, { error: "Use the exact local URL." });
    try {
      if (req.method === "GET" && req.url === "/api/state")
        return send(200, await state());
      if (req.method === "GET" && req.url === "/favicon.ico") {
        res.writeHead(204);
        return res.end();
      }
      if (req.method === "POST" && req.url === "/api/action") {
        if (
          req.headers.origin !== origin ||
          req.headers["content-type"] !== "application/json"
        )
          return send(403, { error: "Local same-origin JSON required." });
        if (busy)
          return send(409, { error: "A local operation is in progress." });
        req.setTimeout(5000, () => req.destroy());
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 16384)
            return send(413, { error: "Request too large" });
        }
        // Body reads yield. Recheck before taking the single-writer lock.
        if (busy)
          return send(409, { error: "A local operation is in progress." });
        busy = true;
        try {
          const input = JSON.parse(body);
          const result = await action(input);
          return send(
            200,
            input.action === "retrieve" ? result : await state(),
          );
        } finally {
          busy = false;
        }
      }
      if (req.method === "GET" && req.url === "/cipher.js") {
        res.writeHead(200, { "Content-Type": "text/javascript" });
        return res.end(
          stripTypeScriptTypes(
            await readFile(
              path.join(root, "experiments/qualification/transport/cipher.ts"),
              "utf8",
            ),
          ),
        );
      }
      const assets = {
        "/": ["index.html", "text/html"],
        "/app.js": ["app.js", "text/javascript"],
        "/style.css": ["style.css", "text/css"],
      };
      if (req.method !== "GET" || !assets[req.url])
        return send(404, { error: "Not found" });
      const [name, type] = assets[req.url];
      res.writeHead(200, { "Content-Type": type });
      res.end(
        await readFile(
          path.join(root, "experiments/qualification/runtime", name),
        ),
      );
    } catch (error) {
      send(400, { error: (error.shortMessage ?? error.message).slice(0, 300) });
    }
  });
  await save("pids.json", {
    runtime: process.pid,
    anvil: child.pid,
    webPort: 18787,
    rpcPort: 18547,
  });
  server.listen(18787, "127.0.0.1", () =>
    console.log(`Qualification workbench: ${origin}`),
  );
  server.on("error", (error) => {
    console.error(error.message);
    child?.kill();
    process.exitCode = 1;
  });
}
process.on("SIGINT", () => {
  child?.kill();
  process.exit(0);
});
process.on("SIGTERM", () => {
  child?.kill();
  process.exit(0);
});
try {
  await bootstrap();
  await selfTest();
  if (process.argv.includes("--test-only")) {
    child?.kill();
  } else {
    await newJob();
    await serve();
  }
} catch (error) {
  console.error(error.shortMessage ?? error.message);
  child?.kill();
  process.exitCode = 1;
}
