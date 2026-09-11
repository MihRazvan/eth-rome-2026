import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, openSync, writeFileSync, rmSync } from "node:fs";
mkdirSync(".runtime", { recursive: true });
const services = [];
const localEnv = {
  ...process.env,
  EXIT_RPC_URL: "http://127.0.0.1:8547",
  EXIT_DEPLOYMENT: ".runtime/local/deployment.json",
  EXIT_DATA_DIR: ".runtime/local",
};
function start(command, args, log) {
  const fd = openSync(`.runtime/${log}.log`, "a");
  const p = spawn(command, args, { stdio: ["ignore", fd, fd], env: localEnv });
  services.push(p);
  return p;
}
async function ready(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Service failed to start: ${url}`);
}
async function rpcReady() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch("http://127.0.0.1:8547", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: [],
        }),
      });
      if ((await r.json()).result === "0x7a69") return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Anvil failed to start; inspect .runtime/anvil.log");
}
function stop() {
  for (const p of services) p.kill("SIGTERM");
}
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});
try {
  // Refuse to overwrite an existing unrelated chain/service on our dedicated ports.
  for (const port of [8547, 8787, 5173]) {
    try {
      await fetch(`http://127.0.0.1:${port}`, {
        signal: AbortSignal.timeout(500),
      });
      throw new Error(
        `Port ${port} already serves HTTP; stop the existing EXIT process first`,
      );
    } catch (e) {
      if (e.message.includes("already serves")) throw e;
    }
  }
  execFileSync("forge", ["build"], { stdio: "inherit", env: localEnv });
  execFileSync("npx", ["tsx", "scripts/export-abis.ts"], {
    stdio: "inherit",
    env: localEnv,
  });
  for (const folder of [
    ".runtime/local/local-records",
    ".runtime/local/bindings",
  ])
    rmSync(folder, { recursive: true, force: true });
  start(
    "anvil",
    [
      "--port",
      "8547",
      "--chain-id",
      "31337",
      "--block-time",
      "1",
      "--mixed-mining",
      "--silent",
    ],
    "anvil",
  );
  await rpcReady();
  execFileSync("npx", ["tsx", "scripts/deploy.ts"], {
    stdio: "inherit",
    env: localEnv,
  });
  start(
    process.execPath,
    ["--import", "tsx", "packages/runtime/server.ts"],
    "api",
  );
  await ready("http://127.0.0.1:8787/api/config");
  start(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "apps/web",
      "--host",
      "127.0.0.1",
      "--port",
      "5173",
    ],
    "web",
  );
  await ready("http://127.0.0.1:5173");
  writeFileSync(
    ".runtime/pids.json",
    JSON.stringify(services.map((p) => p.pid)),
  );
  console.log(
    "EXIT READY http://127.0.0.1:5173 — actual local chain; sponsor storage explicitly local. Ctrl+C stops services.",
  );
} catch (e) {
  stop();
  console.error(e.message);
  process.exit(1);
}
