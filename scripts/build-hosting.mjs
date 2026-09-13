// SPDX-License-Identifier: MIT
// Rebuild the actual public deployment from pinned public artifacts; never regenerate setup.
import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile),
  dir = resolve(".runtime/submission-hosting");
const manifest = JSON.parse(await readFile("deployments/fuji.json", "utf8"));
await mkdir(dir, { recursive: true });
const setup = resolve(dir, "public-setup");
await mkdir(setup, { recursive: true });
for (const name of ["circuit.r1cs", "proving.key", "verifying.key"]) {
  const path = resolve(setup, name),
    expected = manifest.setupHashes[name].replace(/^0x/, "");
  let bytes = await readFile(path).catch(() => null);
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  if (!bytes || hash(bytes) !== expected) {
    const response = await fetch(
      `https://cutout-ethrome-2026.vercel.app/prover/${name}`,
      { redirect: "error", signal: AbortSignal.timeout(60000) },
    );
    if (!response.ok)
      throw Error(`Pinned public artifact unavailable: ${name}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 32 * 1024 * 1024 || hash(bytes) !== expected)
      throw Error(`Public artifact hash mismatch: ${name}`);
    await writeFile(path, bytes);
  }
}
manifest.setupDir = setup;
const path = resolve(dir, "deployment.json");
await writeFile(path, JSON.stringify(manifest, null, 2) + "\n");
await run("forge", ["build", "--root", "experiments/qualification/contracts"]);
await run(
  process.execPath,
  ["experiments/qualification/pilot/hosting/build.mjs", "--config", path],
  { maxBuffer: 1024 * 1024 },
);
// Vercel Build Output API. This does not deploy or load signing/issuer secrets.
await mkdir(".vercel", { recursive: true });
await rm(".vercel/output", { recursive: true, force: true });
await cp(".runtime/review-pass-vercel/.vercel/output", ".vercel/output", {
  recursive: true,
  force: true,
});
console.log(
  "Verified Deaddrop hosting build ready in .runtime/review-pass-vercel and .vercel/output.",
);
