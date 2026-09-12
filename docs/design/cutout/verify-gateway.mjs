// Actual public upload: one generated, non-sensitive recipient-encrypted report.
// Isolated Chromium profiles; no wallet transactions, credential proof or Swarm ID.
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const output = process.argv[2] ?? ".runtime/cutout-gateway/evidence";
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  envFile: false,
  envDir: false,
  publicDir: false,
  root: process.cwd(),
  server: { host: "127.0.0.1", port: 18907, strictPort: true },
  logLevel: "error",
});
await server.listen();
const browser = await chromium.launch();
const checks = [],
  errors = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const uploads = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      req.url() === "https://api.gateway.ethswarm.org/bytes"
    )
      uploads.push({ url: req.url(), body: req.postData() });
  });
  // Existing repository file supplies an HTTP origin; no production page or wallet is impersonated.
  await page.goto(
    "http://127.0.0.1:18907/docs/design/cutout/evidence/release-followup/preflight.json",
  );
  const result = await page.evaluate(async () => {
    const { createGatewayStorage } =
      await import("/experiments/qualification/pilot/swarm-gateway.ts");
    const keys = await import("/experiments/qualification/pilot/keys.ts");
    const storage = createGatewayStorage();
    await storage.initialize();
    const client = "0x1111111111111111111111111111111111111111";
    const reviewer = "0x2222222222222222222222222222222222222222";
    const ck = await keys.loadOrCreateDeviceKey("gateway-probe-client"),
      rk = await keys.loadOrCreateDeviceKey("gateway-probe-reviewer");
    const bindings = await Promise.all(
      [
        [client, ck],
        [reviewer, rk],
      ].map(async ([owner, key]) => ({
        owner,
        publicKey: await keys.getDevicePublicKey(key),
        version: "1",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      })),
    );
    const context = {
      chainId: 43113,
      escrow: "0x3333333333333333333333333333333333333333",
      jobId: "0",
      purpose: "review-result",
      version: 1,
    };
    const report =
      "Cutout account-free storage probe " +
      crypto.randomUUID() +
      "\nGenerated report: permission boundaries checked ✓\nNo real customer data.";
    const envelope = await keys.encryptForRecipients(
      new TextEncoder().encode(report),
      context,
      bindings,
    );
    const bytes = new TextEncoder().encode(JSON.stringify(envelope));
    const ref = await storage.upload(bytes);
    const downloaded = await storage.download(ref);
    const decoded = JSON.parse(new TextDecoder().decode(downloaded));
    const recovered = await keys.decryptForRecipient(
      decoded,
      context,
      client,
      ck,
    );
    const reviewerRecovered = await keys.decryptForRecipient(
      decoded,
      context,
      reviewer,
      rk,
    );
    if (
      new TextDecoder().decode(recovered) !== report ||
      new TextDecoder().decode(reviewerRecovered) !== report
    )
      throw Error("Recipient roundtrip failed");
    storage.destroy();
    return { ref, bytes: bytes.length, report, context, client };
  });
  assert.equal(uploads.length, 1);
  assert.ok(!uploads[0].body.includes(result.report));
  assert.equal(await page.locator("iframe").count(), 0);
  checks.push(
    "Fresh browser has no Swarm ID iframe or account; actual gateway POST and authenticated independent GET succeed",
  );
  checks.push(
    "Actual application AES-GCM/HPKE envelope opens to exact Unicode report for both recipients; uploaded bytes omit plaintext",
  );
  await page.reload();
  assert.equal(
    await page.evaluate(async ({ ref, context, client, report }) => {
      const { createGatewayStorage } =
        await import("/experiments/qualification/pilot/swarm-gateway.ts");
      const keys = await import("/experiments/qualification/pilot/keys.ts");
      const s = createGatewayStorage();
      const bytes = await s.download(ref),
        key = await keys.loadOrCreateDeviceKey("gateway-probe-client");
      const text = new TextDecoder().decode(
        await keys.decryptForRecipient(
          JSON.parse(new TextDecoder().decode(bytes)),
          context,
          client,
          key,
        ),
      );
      s.destroy();
      return text === report;
    }, result),
    true,
  );
  checks.push(
    "Reload preserves local recipient key and reopens independently retrieved public ciphertext",
  );
  const outsider = await browser.newContext(),
    p2 = await outsider.newPage();
  await p2.goto(
    "http://127.0.0.1:18907/docs/design/cutout/evidence/release-followup/preflight.json",
  );
  assert.equal(
    await p2.evaluate(async ({ ref, context }) => {
      const { createGatewayStorage } =
        await import("/experiments/qualification/pilot/swarm-gateway.ts");
      const keys = await import("/experiments/qualification/pilot/keys.ts");
      const s = createGatewayStorage();
      const bytes = await s.download(ref);
      const key = await keys.loadOrCreateDeviceKey("outsider");
      try {
        await keys.decryptForRecipient(
          JSON.parse(new TextDecoder().decode(bytes)),
          context,
          "0x4444444444444444444444444444444444444444",
          key,
        );
        return false;
      } catch {
        return true;
      } finally {
        s.destroy();
      }
    }, result),
    true,
  );
  checks.push(
    "Separate clean browser retrieves ciphertext but outsider cannot decrypt",
  );
  const independent = await fetch(
    "https://api.gateway.ethswarm.org/bytes/" + result.ref.reference,
    { cache: "no-store" },
  );
  assert.equal(independent.status, 200);
  const bytes = new Uint8Array(await independent.arrayBuffer());
  const { createHash } = await import("node:crypto");
  assert.equal(
    "0x" + createHash("sha256").update(bytes).digest("hex"),
    result.ref.sha256,
  );
  assert.deepEqual(errors, []);
  const evidence = {
    recordedAt: new Date().toISOString(),
    checks,
    errors,
    reference: result.ref.reference,
    sha256: result.ref.sha256,
    bytes: result.bytes,
    uploads: uploads.length,
    scope:
      "Actual public gateway-funded storage and application cryptography in isolated Chromium. Recipient bindings are generated test bindings, not read from chain; no funded job, proof acceptance or payment claimed. No Swarm account, batch signer or recovery phrase used.",
  };
  await writeFile(
    output + "/gateway-browser.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
  await server.close();
}
