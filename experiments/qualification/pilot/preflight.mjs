#!/usr/bin/env node
// Read-only project access probe. Never logs config values, provider URLs/errors, tokens or private keys.
import { readFile, realpath } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { privateKeyToAccount } from "viem/accounts";

const defaults = {
  chainId: 43113,
  rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
  arkiv: {
    chainId: 7738577,
    rpcUrl: "https://rpc.tiramisu.db-chain.testnet.arkiv.network",
  },
  swarm: { retrievalUrl: "https://api.gateway.ethswarm.org" },
};
const keyPattern = /^0x[0-9a-f]{64}$/i,
  addressPattern = /^0x[0-9a-f]{40}$/i;
const publicEndpoint = (value) => {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
    );
  } catch {
    return false;
  }
};
async function jsonRequest(url, init = {}) {
  const r = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw Error("Read failed");
  const text = await r.text();
  if (text.length > 1024 * 1024) throw Error("Oversized response");
  return text.trim() === "OK" ? { status: "ok" } : JSON.parse(text);
}
export async function runPreflight(
  { config = {}, env = {}, projectEnvPresent = false },
  request = jsonRequest,
) {
  const started = Date.now(),
    checks = [];
  const add = (name, status, detail, extra = {}) =>
    checks.push({ name, status, detail, ...extra });
  const configRpc =
    env.FUJI_RPC_URL || env.EXIT_RPC_URL || config.rpcUrl || defaults.rpcUrl;
  const arkivRpc =
    env.ARKIV_RPC_URL || config.arkiv?.rpcUrl || defaults.arkiv.rpcUrl;
  const rpc = async (url, method, params = []) => {
    const result = await request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (result.error || result.result === undefined)
      throw Error("RPC read failed");
    return result.result;
  };
  const chain = async (name, url, expected) => {
    if (!publicEndpoint(url)) {
      add(name, "BLOCKED", "Public HTTPS RPC required; no local fallback");
      return false;
    }
    try {
      const id = Number(BigInt(await rpc(url, "eth_chainId")));
      if (id !== expected) {
        add(name, "BLOCKED", "Unexpected network", {
          expectedChainId: expected,
          observedChainId: id,
        });
        return false;
      }
      const block = BigInt(await rpc(url, "eth_blockNumber")).toString();
      add(name, "PASS", "Public read succeeded", { chainId: id, block });
      return true;
    } catch {
      add(name, "BLOCKED", "RPC read unavailable; provider details withheld");
      return false;
    }
  };
  const configuredChain = config.chainId ?? 43113;
  if (configuredChain !== 43113)
    add(
      "Fuji configuration",
      "BLOCKED",
      "This public pilot requires chain 43113",
    );
  const fujiReady =
    configuredChain === 43113 && (await chain("Fuji RPC", configRpc, 43113));
  const arkivReady = await chain("Arkiv RPC", arkivRpc, 7738577);
  const accountCheck = async (name, secret, url, readable) => {
    if (!secret) {
      add(name, "BLOCKED", "No configured project signing key", {
        configured: false,
      });
      return;
    }
    if (!keyPattern.test(secret)) {
      add(
        name,
        "BLOCKED",
        "Configured project signing key has invalid syntax",
        { configured: true },
      );
      return;
    }
    let account;
    try {
      account = privateKeyToAccount(secret);
    } catch {
      add(name, "BLOCKED", "Configured project signing key is invalid", {
        configured: true,
      });
      return;
    }
    if (!readable) {
      add(name, "BLOCKED", "Cannot read signer balance on required chain", {
        configured: true,
      });
      return;
    }
    try {
      const balance = BigInt(
        await rpc(url, "eth_getBalance", [account.address, "latest"]),
      );
      add(
        name,
        balance > 0n ? "PASS" : "BLOCKED",
        balance > 0n
          ? "Native balance is nonzero; sufficient gas is NOT established"
          : "Configured project signer has zero native balance",
        {
          configured: true,
          address: account.address,
          nativeBalanceWei: balance.toString(),
          sufficientGasVerified: false,
        },
      );
    } catch {
      add(
        name,
        "BLOCKED",
        "Configured signer balance read failed; provider details withheld",
        { configured: true },
      );
    }
  };
  await accountCheck(
    "Fuji project signer",
    env.FUJI_PRIVATE_KEY || env.EXIT_DEPLOYER_KEY || env.DEPLOYER_PRIVATE_KEY,
    configRpc,
    fujiReady,
  );
  await accountCheck(
    "Arkiv project signer",
    env.ARKIV_PRIVATE_KEY,
    arkivRpc,
    arkivReady,
  );
  for (const name of ["escrow", "verifier", "keyRegistry", "token"]) {
    const address = config[name];
    if (
      typeof address !== "string" ||
      !addressPattern.test(address) ||
      /^0x0{40}$/i.test(address)
    ) {
      add(
        `${name} deployment`,
        "BLOCKED",
        "No valid public deployment address configured",
      );
      continue;
    }
    if (!fujiReady) {
      add(
        `${name} deployment`,
        "BLOCKED",
        "Cannot inspect configured deployment on Fuji",
      );
      continue;
    }
    try {
      const code = await rpc(configRpc, "eth_getCode", [address, "latest"]);
      if (typeof code !== "string" || !/^0x(?:[0-9a-f]{2})+$/i.test(code))
        throw Error();
      add(
        `${name} deployment`,
        "PASS",
        "Bytecode exists; ABI, deployment provenance and contract relationships are NOT verified",
        { address, bytecodeBytes: (code.length - 2) / 2 },
      );
    } catch {
      add(
        `${name} deployment`,
        "BLOCKED",
        "Configured address has no readable bytecode",
      );
    }
  }
  const upload = env.SWARM_UPLOAD_URL || config.swarm?.uploadUrl;
  const retrieval =
    env.SWARM_RETRIEVAL_URL ||
    config.swarm?.retrievalUrl ||
    defaults.swarm.retrievalUrl;
  const postage = env.SWARM_POSTAGE_BATCH_ID || config.swarm?.postageBatchId;
  const authorization = env.SWARM_AUTH_TOKEN
    ? { authorization: `Bearer ${env.SWARM_AUTH_TOKEN}` }
    : {};
  async function health(name, base, headers = {}) {
    if (!publicEndpoint(base)) {
      add(
        name,
        "BLOCKED",
        "Public HTTPS endpoint missing or invalid; local Bee is not a public substitute",
      );
      return false;
    }
    try {
      const body = await request(`${base.replace(/\/$/, "")}/health`, {
        headers,
      });
      if (body.status !== "ok") throw Error();
      add(
        name,
        "PASS",
        "Endpoint reports healthy; content transfer and upload authority are NOT established",
      );
      return true;
    } catch {
      add(
        name,
        "UNVERIFIED",
        "Health read unavailable; gateway may require a different documented API",
      );
      return false;
    }
  }
  await health("Swarm public retrieval", retrieval);
  if (!upload)
    add(
      "Swarm public upload route",
      "BLOCKED",
      "No configured public upload gateway/Bee endpoint",
    );
  else {
    const healthy = await health(
      "Swarm public upload route",
      upload,
      authorization,
    );
    if (!healthy)
      add(
        "Swarm postage capability",
        "UNVERIFIED",
        "Upload route health is not established",
      );
    else if (typeof postage === "string" && /^[0-9a-f]{64}$/i.test(postage)) {
      try {
        const stamp = await request(
          `${upload.replace(/\/$/, "")}/stamps/${postage}`,
          { headers: authorization },
        );
        add(
          "Swarm postage capability",
          stamp.usable === true ? "PASS" : "BLOCKED",
          stamp.usable === true
            ? "Node reports batch usable; retention, quota and an actual public write remain unverified"
            : "Configured batch not usable",
          { usable: stamp.usable === true },
        );
      } catch {
        add(
          "Swarm postage capability",
          "UNVERIFIED",
          "Configured batch cannot be inspected through this gateway; do not infer upload permission",
        );
      }
    } else
      add(
        "Swarm postage capability",
        "BLOCKED",
        "No valid configured public postage batch; an authenticated subsidised gateway needs its separately documented capability flow",
      );
  }
  const api = config.apiUrl || env.QUALIFICATION_API_URL;
  if (!api || !publicEndpoint(api))
    add("Pilot public API", "BLOCKED", "No configured public HTTPS pilot API");
  else
    add(
      "Pilot public API",
      "UNVERIFIED",
      "Configured; endpoint-specific health/authentication and browser CORS are not established",
    );
  add(
    "Public transaction and byte round trip",
    "UNVERIFIED",
    "Read-only probe: no deployment, create/expiry, upload, publication or account mutation attempted",
  );
  const blocked = checks.some((c) => c.status === "BLOCKED");
  return {
    observedAt: new Date(started).toISOString(),
    elapsedMs: Date.now() - started,
    mode: "public-read-only",
    projectEnvPresent,
    checks,
    status: blocked ? "BLOCKED" : "UNVERIFIED",
    publicFundedLifecycleVerified: false,
    chainWrites: 0,
    storageWrites: 0,
    faucetAttempts: 0,
    localFallback: false,
  };
}
export async function selfTest() {
  const { default: assert } = await import("node:assert/strict");
  const requests = [];
  const fake = async (url, init) => {
    requests.push({ url, init });
    if (url.includes("/health")) return { status: "ok" };
    if (url.includes("/stamps/")) return { usable: true };
    const body = JSON.parse(init.body);
    return {
      result: {
        eth_chainId: url.includes("arkiv") ? "0x7614d1" : "0xa869",
        eth_blockNumber: "0x1",
        eth_getBalance: "0x1",
        eth_getCode: "0x6000",
      }[body.method],
    };
  };
  const cfg = {
    rpcUrl: "https://fuji.example/secret?token=DO_NOT_LOG",
    arkiv: { rpcUrl: "https://arkiv.example/secret" },
    swarm: {
      uploadUrl: "https://bee.example",
      postageBatchId: "ab".repeat(32),
    },
    escrow: "0x" + "11".repeat(20),
    verifier: "0x" + "22".repeat(20),
    keyRegistry: "0x" + "33".repeat(20),
    token: "0x" + "44".repeat(20),
    apiUrl: "https://pilot.example",
  };
  const secret = "0x" + "01".repeat(32);
  const result = await runPreflight(
    {
      config: cfg,
      env: {
        FUJI_PRIVATE_KEY: secret,
        ARKIV_PRIVATE_KEY: secret,
        SWARM_AUTH_TOKEN: "DO_NOT_LOG",
      },
    },
    fake,
  );
  assert.equal(result.status, "UNVERIFIED");
  assert.equal(result.chainWrites, 0);
  assert.equal(result.storageWrites, 0);
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(JSON.stringify(result).includes("DO_NOT_LOG"), false);
  assert.equal(JSON.stringify(result).includes("https://"), false);
  assert.ok(
    requests.every(
      ({ init }) =>
        !init.method ||
        [
          "eth_chainId",
          "eth_blockNumber",
          "eth_getBalance",
          "eth_getCode",
        ].includes(JSON.parse(init.body).method),
    ),
  );
  const bad = await runPreflight(
    {
      config: { ...cfg, rpcUrl: "http://127.0.0.1:18547" },
      env: { FUJI_PRIVATE_KEY: "not-a-key" },
    },
    async () => {
      throw Error("DO_NOT_LOG");
    },
  );
  assert.equal(bad.status, "BLOCKED");
  assert.equal(JSON.stringify(bad).includes("DO_NOT_LOG"), false);
  const absent = await runPreflight({ env: {} }, fake);
  assert.equal(absent.status, "BLOCKED");
  assert.equal(
    absent.checks.find((c) => c.name === "Fuji project signer").configured,
    false,
  );
  return {
    status: "PASS",
    checks: [
      "sanitized keys, authenticated URLs and errors",
      "read-only RPC allowlist and GET-only storage probes",
      "nonzero balances do not claim sufficient gas or live lifecycle",
      "local endpoint rejected",
      "missing project keys explicitly blocked",
    ],
  };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    console.log(JSON.stringify(await selfTest(), null, 2));
    return;
  }
  const option = (name) => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args[i + 1];
  };
  const project = await realpath(
    resolve(option("--project-dir") || process.cwd()),
  );
  let envFile = {},
    present = false;
  try {
    const target = await realpath(resolve(project, ".env"));
    if (relative(project, target).startsWith(".."))
      throw Error("Outside project");
    envFile = parseEnv(await readFile(target, "utf8"));
    present = true;
  } catch (e) {
    if (e.code !== "ENOENT") throw Error("Project .env cannot be read safely");
  }
  let config = {};
  const file = option("--config");
  if (file) config = JSON.parse(await readFile(resolve(file), "utf8"));
  const result = await runPreflight({
    config,
    env: { ...envFile, ...process.env },
    projectEnvPresent: present,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "PASS") process.exitCode = 2;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch(() => {
    console.log(
      JSON.stringify({
        status: "BLOCKED",
        error:
          "Preflight configuration or execution failed; sensitive details withheld",
      }),
    );
    process.exitCode = 2;
  });
