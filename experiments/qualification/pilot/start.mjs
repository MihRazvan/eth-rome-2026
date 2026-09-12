// SPDX-License-Identifier: MIT
// Public-data/storage API: no issuer/holder secrets and no transaction signer.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { build } from "vite";
import {
  createPublicClient,
  http as rpc,
  sha256,
  bytesToHex,
  verifyMessage,
} from "viem";
import { beeBytes } from "../transport/bytes.ts";
import { uploadMessage } from "./upload-message.ts";
import { encodeTerms, matchTerms, termsUploadMessage } from "./terms.ts";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const local = resolve(
  root,
  process.env.QUALIFICATION_PILOT_DIR ?? ".runtime/qualification-pilot",
);
const port = Number(process.env.QUALIFICATION_PILOT_PORT ?? 18888);
if (![18888, 18889].includes(port))
  throw Error("Use an assigned local pilot port");
await mkdir(local, { recursive: true });
const configPath =
  process.env.QUALIFICATION_PILOT_CONFIG ?? resolve(local, "config.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const chain = createPublicClient({ transport: rpc(config.rpcUrl) });
if ((await chain.getChainId()) !== config.chainId)
  throw Error("Configured settlement chain mismatch");
const abi = {};
for (const name of ["QualificationEscrow", "QualificationKeys", "DemoUSD"])
  abi[name] = JSON.parse(
    await readFile(
      resolve(
        root,
        `experiments/qualification/contracts/out/${name}.sol/${name}.json`,
      ),
      "utf8",
    ),
  ).abi;
for (const address of [
  config.escrow,
  config.keyRegistry,
  config.token,
  config.verifier,
])
  if (!(await chain.getCode({ address })))
    throw Error("Configured contract has no code; deploy explicitly");
const store = beeBytes({
  ...config.swarm,
  downloadUrl: config.swarm.downloadUrl ?? config.swarm.retrievalUrl,
  environment:
    config.swarm.environment ??
    (config.environment === "local-pilot" ? "local-bee" : "public-swarm"),
});
const out = resolve(local, "web");
await build({
  configFile: false,
  root: resolve(root, "experiments/qualification/pilot/web"),
  base: "/",
  build: { outDir: out, emptyOutDir: true },
  logLevel: "warn",
});
const uploads = new Map();
const locks = new Set();
const uploadCounts = new Map();
const origin = `http://127.0.0.1:${port}`;
const termsQuota = new Map();
const stringify = (v) =>
  JSON.stringify(v, (_, x) => (typeof x === "bigint" ? String(x) : x));
const readJob = (id) =>
  chain.readContract({
    address: config.escrow,
    abi: abi.QualificationEscrow,
    functionName: "jobs",
    args: [BigInt(id)],
  });
const server = http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ${new URL(config.rpcUrl).origin}; img-src 'self'; frame-ancestors 'none'`,
  );
  const send = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(stringify(data));
  };
  if (req.headers.host !== `127.0.0.1:${port}`)
    return send(403, { error: "Use the exact local pilot URL" });
  try {
    const url = new URL(req.url, origin);
    if (req.method === "GET" && url.pathname === "/api/config")
      return send(200, {
        version: 1,
        environment: config.environment,
        testOnly: config.testOnly,
        chainId: config.chainId,
        rpcUrl: config.rpcUrl,
        escrow: config.escrow,
        keyRegistry: config.keyRegistry,
        token: config.token,
        verifier: config.verifier,
        issuer: config.issuer,
        arbitrator: config.arbitrator,
        snapshot: config.snapshot,
        storageMode: config.storageMode ?? "local-bee",
        gatewayUrl: config.swarm.downloadUrl ?? config.swarm.retrievalUrl,
        arkiv: config.arkiv ?? null,
        abi,
      });
    if (req.method === "GET" && url.pathname === "/api/snapshot") {
      const bytes = await store.download(config.snapshot);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(bytes);
    }
    if (req.method === "GET" && url.pathname === "/api/terms") {
      const id = url.searchParams.get("job");
      if (!/^[1-9][0-9]{0,18}$/.test(id ?? ""))
        throw Error("Invalid assignment");
      const job = await readJob(id);
      const reference = await chain.readContract({
        address: config.escrow,
        abi: abi.QualificationEscrow,
        functionName: "termsReferences",
        args: [BigInt(id)],
      });
      if (reference === `0x${"0".repeat(64)}`)
        return send(404, {
          error: "Legacy assignment has no public scope document",
        });
      const bytes = await store.download({
        reference: reference.slice(2),
        sha256: job[8],
      });
      const encoded = encodeTerms(JSON.parse(new TextDecoder().decode(bytes)));
      if (
        encoded.digest !== job[8] ||
        !matchTerms(
          encoded.terms,
          config.chainId,
          config.escrow,
          config.token,
          job,
        )
      )
        throw Error("Scope does not match funded terms");
      return send(200, { terms: encoded.terms, reference, digest: job[8] });
    }
    if (req.method === "POST" && url.pathname === "/api/terms") {
      if (config.environment !== "local-pilot")
        throw Error("Public uploads use your browser's Swarm ID capability");
      if (
        req.headers.origin !== origin ||
        req.headers["content-type"] !== "application/json"
      )
        return send(403, { error: "Same-origin JSON required" });
      req.setTimeout(5000, () => req.destroy());
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 20000)
          return send(413, { error: "Public scope too large" });
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString("utf8");
      const input = JSON.parse(body),
        encoded = encodeTerms(input.terms),
        t = encoded.terms;
      const now = Number((await chain.getBlock()).timestamp);
      if (
        t.chainId !== config.chainId ||
        t.escrow !== config.escrow.toLowerCase() ||
        t.token !== config.token.toLowerCase() ||
        t.acceptBefore <= now ||
        !Number.isSafeInteger(input.expiresAt) ||
        input.expiresAt < now ||
        input.expiresAt > now + 300
      )
        throw Error("Expired or misrouted scope upload");
      if (
        !(await verifyMessage({
          address: t.client,
          message: termsUploadMessage(t, encoded.digest, input.expiresAt),
          signature: input.signature,
        }))
      )
        throw Error("Client scope upload signature required");
      const cache = `terms:${t.client}:${encoded.digest}`;
      if (uploads.has(cache)) return send(200, uploads.get(cache));
      if (locks.has(cache))
        return send(409, { error: "This scope upload is in progress" });
      if ((termsQuota.get(t.client) ?? 0) >= 10)
        throw Error("Local scope upload quota reached");
      // Reserve quota before awaiting storage: parallel requests cannot bypass this limit.
      termsQuota.set(t.client, (termsQuota.get(t.client) ?? 0) + 1);
      locks.add(cache);
      try {
        const ref = await store.upload(encoded.bytes);
        uploads.set(cache, ref);
        return send(200, ref);
      } finally {
        locks.delete(cache);
      }
    }
    if (req.method === "GET" && url.pathname === "/api/document") {
      const id = url.searchParams.get("job");
      if (!/^[1-9][0-9]{0,18}$/.test(id ?? ""))
        throw Error("Invalid assignment");
      const job = await readJob(id);
      const digest = await chain.readContract({
        address: config.escrow,
        abi: abi.QualificationEscrow,
        functionName: "documentDigests",
        args: [BigInt(id)],
      });
      if (digest === `0x${"0".repeat(64)}`)
        throw Error("No authenticated document committed");
      const bytes = await store.download({
        reference: job[9].slice(2),
        sha256: digest,
      });
      return send(200, {
        envelope: JSON.parse(new TextDecoder().decode(bytes)),
        digest,
        reference: job[9],
      });
    }
    if (req.method === "POST" && url.pathname === "/api/upload") {
      if (
        req.headers.origin !== origin ||
        req.headers["content-type"] !== "application/json"
      )
        return send(403, { error: "Same-origin JSON required" });
      req.setTimeout(5000, () => req.destroy());
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 512000)
          return send(413, { error: "Review envelope too large" });
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString("utf8");
      const input = JSON.parse(body);
      if (
        !/^[1-9][0-9]{0,18}$/.test(input.jobId) ||
        !Number.isSafeInteger(input.expiresAt)
      )
        throw Error("Invalid upload authorization");
      const job = await readJob(input.jobId),
        block = await chain.getBlock();
      if (
        job[7] !== 1 ||
        block.timestamp > job[5] ||
        input.expiresAt < Number(block.timestamp) ||
        input.expiresAt > Number(block.timestamp) + 300
      )
        throw Error("Assignment is not accepting authorized uploads");
      if (
        input.envelope?.format !== "review-pass-recipient-document" ||
        input.envelope.version !== 1 ||
        typeof input.envelope.ciphertext !== "string" ||
        !Array.isArray(input.envelope.recipients)
      )
        throw Error("Recipient-encrypted envelope required");
      const bytes = new TextEncoder().encode(JSON.stringify(input.envelope));
      const digest = sha256(bytesToHex(bytes));
      if (
        !(await verifyMessage({
          address: job[1],
          message: uploadMessage(
            config.chainId,
            config.escrow,
            input.jobId,
            digest,
            input.expiresAt,
          ),
          signature: input.signature,
        }))
      )
        throw Error("Assigned worker signature required");
      const ctx = input.envelope.context;
      if (
        ctx?.chainId !== config.chainId ||
        ctx.escrow?.toLowerCase() !== config.escrow.toLowerCase() ||
        ctx.jobId !== input.jobId ||
        ctx.purpose !== "review-result" ||
        ctx.version !== 1
      )
        throw Error("Wrong document context");
      const required = [job[0].toLowerCase(), job[1].toLowerCase()].sort();
      if (
        input.envelope.recipients.length !== 2 ||
        JSON.stringify(
          input.envelope.recipients.map((b) => b.owner.toLowerCase()).sort(),
        ) !== JSON.stringify(required)
      )
        throw Error("Client and worker recipients required");
      for (const binding of input.envelope.recipients) {
        const current = await chain.readContract({
          address: config.keyRegistry,
          abi: abi.QualificationKeys,
          functionName: "keys",
          args: [binding.owner],
        });
        if (
          binding.publicKey.toLowerCase() !== current[0].toLowerCase() ||
          String(binding.version) !== String(current[2]) ||
          binding.expiresAt !== Number(current[1]) ||
          current[1] <= block.timestamp
        )
          throw Error("Recipient binding expired or changed; encrypt again");
      }
      const cache = `${input.jobId}:${digest}`;
      if (uploads.has(cache)) return send(200, uploads.get(cache));
      if (locks.has(input.jobId))
        return send(409, {
          error: "An upload for this assignment is in progress",
        });
      if ((uploadCounts.get(input.jobId) ?? 0) >= 3)
        throw Error("Pilot upload allowance exhausted for this assignment");
      locks.add(input.jobId);
      try {
        const ref = await store.upload(bytes);
        uploads.set(cache, ref);
        uploadCounts.set(input.jobId, (uploadCounts.get(input.jobId) ?? 0) + 1);
        return send(200, ref);
      } finally {
        locks.delete(input.jobId);
      }
    }
    if (req.method !== "GET")
      return send(404, {
        error: "No server-side wallet or proof action exists",
      });
    if (url.pathname === "/favicon.ico") {
      res.writeHead(204);
      return res.end();
    }
    const target = resolve(
      out,
      `.${url.pathname === "/" ? "/index.html" : url.pathname}`,
    );
    if (!target.startsWith(out + "/")) throw Error("Invalid asset");
    const content = await readFile(target);
    res.writeHead(200, {
      "Content-Type":
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
        }[extname(target)] ?? "application/octet-stream",
    });
    res.end(content);
  } catch (error) {
    send(400, { error: (error.shortMessage ?? error.message).slice(0, 200) });
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Wallet-separated pilot: ${origin}`),
);
await writeFile(
  resolve(local, "pids.json"),
  JSON.stringify({ server: process.pid, port }),
);
