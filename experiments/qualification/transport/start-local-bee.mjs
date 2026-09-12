/** Optional isolated LOCAL Swarm stack. Uses known public test keys and mock BZZ only. */
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import net from "node:net";
const exec = (command, args, cwd) => {
  const r = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw Error(`${command} failed; raw output omitted`);
  return r.stdout;
};
const containers = exec("docker", ["ps", "-a", "--format", "{{.Names}}"]);
if (containers.split("\n").some((n) => n.startsWith("bee-factory-")))
  throw Error(
    "Existing bee-factory containers found. Reuse or explicitly remove this experiment stack before starting; no automatic cleanup.",
  );
for (const port of [
  28545, 1633, 1634, 1635, 1636, 1637, 1638, 1639, 1640, 1641, 1642,
])
  await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", () =>
      reject(Error(`Required local port ${port} occupied`)),
    );
    s.listen(port, "127.0.0.1", () => s.close(resolve));
  });
const dir = await mkdtemp(join(tmpdir(), "qualification-bee-"));
const response = await fetch(
  "https://registry.npmjs.org/@ethersphere/bee-factory/-/bee-factory-1.1.2.tgz",
  { signal: AbortSignal.timeout(20000) },
);
if (!response.ok) throw Error("Official factory download failed");
await writeFile(
  join(dir, "factory.tgz"),
  Buffer.from(await response.arrayBuffer()),
);
exec("tar", ["-xzf", "factory.tgz"], dir);
const pkg = join(dir, "package");
exec(
  "npm",
  ["install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"],
  pkg,
);
const config = join(pkg, "dist/config.js");
await writeFile(
  config,
  (await readFile(config, "utf8")).replace(
    "exports.ANVIL_PORT = 8545",
    "exports.ANVIL_PORT = 28545",
  ),
);
const manager = join(pkg, "dist/docker/manager.js");
let source = await readFile(manager, "utf8");
source = source
  .replaceAll("HostIp: '0.0.0.0'", "HostIp: '127.0.0.1'")
  .replace(
    "'--chain-id', String(config_1.CHAIN_ID),",
    "'--chain-id', String(config_1.CHAIN_ID),\n        '--port', String(config_1.ANVIL_PORT),",
  )
  .replace(
    "url.endsWith(':8545') || url.includes(':8545/')",
    "url.endsWith(':' + config_1.ANVIL_PORT) || url.includes(':' + config_1.ANVIL_PORT + '/')",
  );
await writeFile(manager, source);
// Factory prints known test keys. Do not forward third-party logs to the terminal.
const child = spawn("node", ["bin/bee-factory.js", "start"], {
  cwd: pkg,
  stdio: ["ignore", "ignore", "ignore"],
});
console.log(
  JSON.stringify({
    status: "starting-local-only",
    factoryVersion: "1.1.2",
    anvilPort: 28545,
    beeApiPorts: [1633, 1635, 1637, 1639, 1641],
    temporaryPackage: pkg,
  }),
);
const code = await new Promise((resolve) => child.on("exit", resolve));
if (code !== 0)
  throw Error(
    "Local Bee startup failed; inspect only experiment-owned containers, without exposing keys.",
  );
console.log(
  "Local Bee ready. Use POST http://127.0.0.1:1633/stamps/1000000000/17 to purchase mock postage; no public funding is involved.",
);
