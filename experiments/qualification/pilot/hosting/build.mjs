// SPDX-License-Identifier: MIT
// Build an isolated, public-only Vercel deployment. Never load .env or copy runtime directories.
import {
  readFile,
  writeFile,
  mkdir,
  rm,
  copyFile,
  readdir,
} from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { build } from "vite";
import { createPublicClient, http, isAddress, keccak256 } from "viem";
import { avalancheFuji } from "viem/chains";
const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const stage = resolve(root, ".runtime/review-pass-vercel"),
  output = resolve(stage, ".vercel/output");
const args = process.argv.slice(2);
if (
  !(args.length === 1 && args[0] === "--pending") &&
  !(args.length === 2 && args[0] === "--config")
)
  throw Error(
    "Use --pending explicitly, or --config <verified Fuji deployment.json>",
  );
const pending = args[0] === "--pending";
const rpcUrl = "https://api.avax-test.network/ext/bc/C/rpc",
  gatewayUrl = "https://api.gateway.ethswarm.org";
const token = "0x5425890298aed601595a70AB815c96711a31Bc65";
const arkiv = {
  rpcUrl: "https://rpc.tiramisu.db-chain.testnet.arkiv.network",
  wsUrl: "wss://rpc.tiramisu.db-chain.testnet.arkiv.network",
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (x) => JSON.stringify(x, null, 2) + "\n";
const config = {
  version: 1,
  status: pending ? "pending" : "active",
  environment: "fuji-testnet",
  testOnly: true,
  chainId: 43113,
  rpcUrl,
  token,
  storageMode: pending ? "swarm-id" : "swarm-gateway",
  gatewayUrl,
  arkiv,
};
const publicArtifacts = [];
const publicationFiles = [];
if (pending) {
  const publicationDir = resolve(root, "experiments/qualification/pilot/hosting/publication");
  const snapshotPath = resolve(publicationDir, "snapshot.json");
  const issuerPath = resolve(publicationDir, "issuer-public.json");
  const { stdout } = await exec("go", ["run", ".", "validate-public", "--issuer-public", issuerPath, "--snapshot", snapshotPath], {
    cwd: resolve(root, "experiments/qualification/prover"), maxBuffer: 65536,
  });
  const validated = JSON.parse(stdout);
  if (validated.status !== "VALID_PUBLIC_METADATA") throw Error("Invalid publication metadata");
  const snapshot = await readFile(snapshotPath), issuer = await readFile(issuerPath);
  if (snapshot.length > 1024 * 1024 || issuer.length > 16384 || sha(snapshot) !== validated.snapshotSha256)
    throw Error("Publication file changed or exceeds bounds");
  config.publication = {
    snapshotPath: "/publication/snapshot.json", snapshotSha256: `0x${sha(snapshot)}`,
    snapshotBytes: snapshot.length, root: validated.root,
    issuerPath: "/publication/issuer-public.json", issuerSha256: `0x${sha(issuer)}`,
  };
  publicationFiles.push({ name: "snapshot.json", bytes: snapshot }, { name: "issuer-public.json", bytes: issuer });
}
if (pending)
  config.reason =
    "Public financial actions remain disabled until the deployed contracts and whole issuer snapshot are verified.";
else {
  const source = JSON.parse(await readFile(resolve(root, args[1]), "utf8"));
  if (
    source.chainId !== 43113 ||
    source.environment !== "fuji-testnet" ||
    !["swarm-id", "swarm-gateway"].includes(source.storageMode) ||
    source.testOnly !== true ||
    source.token?.toLowerCase() !== token.toLowerCase() ||
    source.rpcUrl !== rpcUrl ||
    source.swarm?.retrievalUrl !== gatewayUrl
  )
    throw Error(
      "Hosting requires the canonical Fuji/public Swarm deployment; local and custom endpoints are rejected",
    );
  for (const key of [
    "escrow",
    "verifier",
    "keyRegistry",
    "issuer",
    "arbitrator",
  ]) {
    if (!isAddress(source[key]) || BigInt(source[key]) === 0n)
      throw Error(`Missing public deployment address: ${key}`);
    config[key] = source[key];
  }
  if (!/^[0-9]+$/.test(String(source.deploymentBlock)))
    throw Error("Deployment block required");
  config.deploymentBlock = String(source.deploymentBlock);
  if (
    !/^[0-9a-f]{64}$/i.test(source.snapshot?.reference) ||
    !/^0x[0-9a-f]{64}$/i.test(source.snapshot?.sha256)
  )
    throw Error("Whole public snapshot reference and hash required");
  config.snapshot = {
    reference: source.snapshot.reference,
    sha256: source.snapshot.sha256,
  };
  config.abi = {};
  for (const name of ["QualificationEscrow", "QualificationKeys", "DemoUSD"])
    config.abi[name] = JSON.parse(
      await readFile(
        resolve(
          root,
          `experiments/qualification/contracts/out/${name}.sol/${name}.json`,
        ),
        "utf8",
      ),
    ).abi;
  const client = createPublicClient({
    chain: avalancheFuji,
    transport: http(rpcUrl, { timeout: 15000, retryCount: 0 }),
  });
  if ((await client.getChainId()) !== 43113)
    throw Error("Public RPC chain mismatch");
  const block = await client.getBlock({ blockTag: "finalized" });
  if (block.number < BigInt(config.deploymentBlock))
    throw Error("Deployment is not finalized");
  for (const key of ["escrow", "verifier", "keyRegistry"]) {
    const code = await client.getCode({
      address: config[key],
      blockNumber: block.number,
    });
    if (
      !code ||
      code === "0x" ||
      keccak256(code) !== source.runtimeCodeHashes?.[key]
    )
      throw Error(`Finalized code differs from deployment: ${key}`);
  }
  for (const key of ["token", "verifier", "issuer", "arbitrator"]) {
    const actual = await client.readContract({
      address: config.escrow,
      abi: config.abi.QualificationEscrow,
      functionName: key,
      blockNumber: block.number,
    });
    if (actual.toLowerCase() !== config[key].toLowerCase())
      throw Error(`Escrow authority differs: ${key}`);
  }
  if (
    (await client.readContract({
      address: token,
      abi: config.abi.DemoUSD,
      functionName: "decimals",
      blockNumber: block.number,
    })) !== 6
  )
    throw Error("Token decimals mismatch");
  const setupDir = resolve(source.setupDir || "missing-public-setup");
  const files = [];
  for (const name of ["circuit.r1cs", "proving.key", "verifying.key"]) {
    const bytes = await readFile(resolve(setupDir, name));
    if (
      bytes.length === 0 ||
      bytes.length > 32 * 1024 * 1024 ||
      sha(bytes) !== source.setupHashes?.[name]?.replace(/^0x/, "")
    )
      throw Error(`Public setup differs from deployment: ${name}`);
    files.push({ name, bytes: bytes.length, sha256: `0x${sha(bytes)}` });
    publicArtifacts.push({ name, bytes });
  }
  config.browserProver = { version: 1, verifier: config.verifier, files };
  // Check actual current snapshot availability using the same serverless handler before building.
  const { tsImport } = await import("tsx/esm/api");
  const { createPublicReadAPI } = await tsImport("./read-api.ts", { parentURL: import.meta.url, tsconfig: false });
  const result = await createPublicReadAPI(config)("/api/snapshot");
  if (result.status !== 200)
    throw Error(
      "Current whole public snapshot could not be verified; active hosting build refused",
    );
}
await mkdir(stage, { recursive: true });
await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "static"), { recursive: true });
await build({
  configFile: false,
  envDir: false,
  publicDir: false,
  envPrefix: "REVIEW_PASS_PUBLIC_BUILD_",
  root: resolve(root, "experiments/qualification/pilot/web"),
  base: "/",
  build: {
    outDir: resolve(output, "static"),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
  },
  logLevel: "warn",
});
if (publicationFiles.length) {
  await mkdir(resolve(output, "static/publication"), { recursive: true });
  for (const { name, bytes } of publicationFiles) await writeFile(resolve(output, "static/publication", name), bytes);
}
if (!pending) {
  const wasmDir = resolve(stage, "public-wasm-build");
  await exec(
    process.execPath,
    [resolve(root, "experiments/qualification/browser-probe/build.mjs")],
    {
      cwd: root,
      env: { ...process.env, REVIEW_PASS_BROWSER_PROBE_DIR: wasmDir },
      maxBuffer: 65536,
    },
  );
  const dir = resolve(output, "static/prover");
  await mkdir(dir, { recursive: true });
  for (const { name, bytes } of publicArtifacts)
    await writeFile(resolve(dir, name), bytes);
  for (const name of ["prover.wasm", "wasm_exec.js", "GO-LICENSE"])
    await copyFile(resolve(wasmDir, name), resolve(dir, name));
  await copyFile(
    resolve(root, "experiments/qualification/browser-probe/worker.js"),
    resolve(dir, "worker.js"),
  );
}
if (!pending) {
  const enrollment = JSON.parse(await readFile(resolve(root, "experiments/qualification/pilot/hosting/enrollment-public.json"), "utf8"));
  if (Object.keys(enrollment).sort().join(",") !== "issuerX,issuerY,publicKey,relayAddress" || !/^0x[0-9a-f]{130}$/i.test(enrollment.publicKey) || !isAddress(enrollment.relayAddress)) throw Error("Invalid enrollment channel configuration");
  const chain = createPublicClient({transport:http(rpcUrl)});
  for (const field of ["issuerX", "issuerY"]) {
    if (String(await chain.readContract({address:config.escrow,abi:config.abi.QualificationEscrow,functionName:field})) !== enrollment[field]) throw Error("Enrollment issuer differs from escrow");
  }
  config.enrollment = enrollment;
}
// Bundle dependencies into one function; no runtime env or filesystem config is required.
const entry = resolve(stage, "read-entry.ts");
await writeFile(
  entry,
  `import {createPublicReadAPI} from ${JSON.stringify(resolve(root, "experiments/qualification/pilot/hosting/read-api.ts"))};\nimport {createEnrollmentAPI} from ${JSON.stringify(resolve(root,"experiments/qualification/pilot/hosting/enrollment-api.ts"))};\nconst enrollment=createEnrollmentAPI(${JSON.stringify(config)});\nconst api=createPublicReadAPI(${JSON.stringify(config)});\nexport default async function handler(req,res){if(await enrollment(req,res))return;res.setHeader('Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Content-Type','application/json');try{const r=await api(req.url,req.method);res.statusCode=r.status;res.end(JSON.stringify(r.body,(_,v)=>typeof v==='bigint'?String(v):v));}catch{res.statusCode=503;res.end(JSON.stringify({error:'Public read service unavailable'}));}}\n`,
);
const func = resolve(output, "functions/read.func");
await build({
  configFile: false,
  envDir: false,
  publicDir: false,
  envPrefix: "REVIEW_PASS_PUBLIC_BUILD_",
  root,
  ssr: { noExternal: true },
  build: {
    ssr: entry,
    outDir: func,
    emptyOutDir: true,
    sourcemap: false,
    target: "node24",
    rollupOptions: { output: { entryFileNames: "index.mjs" } },
  },
  logLevel: "warn",
});
await writeFile(
  resolve(func, ".vc-config.json"),
  json({
    runtime: "nodejs24.x",
    handler: "index.mjs",
    launcherType: "Nodejs",
    shouldAddHelpers: true,
    maxDuration: 60,
  }),
);
const csp = `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ${new URL(rpcUrl).origin} ${new URL(arkiv.rpcUrl).origin} ${new URL(arkiv.wsUrl).origin} https://api.gateway.ethswarm.org https://swarm-id.snaha.net; worker-src 'self'; frame-src https://swarm-id.snaha.net; img-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'`;
await writeFile(
  resolve(output, "config.json"),
  json({
    version: 3,
    routes: [
      {
        src: "/(.*)",
        headers: {
          "Content-Security-Policy": csp,
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          "Cache-Control": "no-store",
        },
        continue: true,
      },
      {
        src: "/prover/worker.js",
        headers: {
          "Content-Security-Policy":
            "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'",
        },
        continue: true,
      },
      { src: "/api/(.*)", dest: "/read" },
      { handle: "filesystem" },
      { src: "/(.*)", status: 404, dest: "/404.html" },
    ],
    overrides: {
      "prover/prover.wasm": { contentType: "application/wasm" },
      "prover/worker.js": { contentType: "application/javascript" },
      "prover/wasm_exec.js": { contentType: "application/javascript" },
    },
  }),
);
await writeFile(
  resolve(output, "static/404.html"),
  '<!doctype html><html lang="en"><meta charset="utf-8"><title>Not found — Review Pass</title><h1>Page not found</h1><a href="/">Return to Review Pass</a></html>',
);
await writeFile(
  resolve(output, "static/robots.txt"),
  "User-agent: *\nDisallow: /\n",
);
await writeFile(resolve(stage, "vercel.json"), json({ framework: null }));
const inventory = [];
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isSymbolicLink())
      throw Error("Symlinks are forbidden in the deployment output");
    if (entry.isDirectory()) {
      await scan(path);
      continue;
    }
    const name = relative(output, path);
    if (
      /(^|\/)(\.env|issuer-private|holder|credential|latest\.json|source\/|node_modules\/)/i.test(
        name,
      )
    )
      throw Error("Non-public file in build output");
    const bytes = await readFile(path);
    if (!/\.(wasm|key|r1cs)$/.test(name) && bytes.includes(Buffer.from(root)))
      throw Error("Absolute checkout path leaked into build output");
    inventory.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
  }
}
await scan(output);
await writeFile(
  resolve(stage, "build-evidence.json"),
  json({
    createdAt: new Date().toISOString(),
    status: config.status,
    sourceRevision: (
      await exec("git", ["rev-parse", "HEAD"], { cwd: root })
    ).stdout.trim(),
    files: inventory,
    secretFilesIncluded: false,
    chainWrites: 0,
  }),
);
console.log(
  json({
    status: config.status,
    stage,
    output,
    files: inventory.length,
    publicContractFlowEnabled: !pending,
  }),
);
