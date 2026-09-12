// Actual public origin upload of the prior generated ciphertext; no Swarm account.
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const prior = JSON.parse(
  await readFile(
    process.argv[2] ?? ".runtime/cutout-gateway/evidence/gateway-browser.json",
  ),
);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://cutout-ethrome-2026.vercel.app");
  await page.waitForFunction(() =>
    document
      .querySelector("#storage-status")
      ?.textContent?.includes("No Swarm account required"),
  );
  const actual = await page.evaluate(async ({ reference, sha256 }) => {
    const base = "https://api.gateway.ethswarm.org";
    const options = {
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    };
    const before = await fetch(base + "/bytes/" + reference, options);
    if (!before.ok) throw Error("Pre-upload retrieval failed");
    const bytes = await before.arrayBuffer();
    const response = await fetch(base + "/bytes", {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Swarm-Postage-Batch-Id": "0".repeat(64),
      },
      body: bytes,
    });
    if (!response.ok) throw Error("Production-origin upload failed");
    const body = await response.json();
    if (body.reference !== reference) throw Error("Content reference changed");
    const after = await fetch(base + "/bytes/" + body.reference, options);
    if (!after.ok) throw Error("Independent retrieval failed");
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", await after.arrayBuffer()),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if ("0x" + hash !== sha256) throw Error("Digest changed");
    return { http: response.status, reference: body.reference, sha256 };
  }, prior);
  assert.equal(await page.locator("iframe").count(), 0);
  assert.deepEqual(errors, []);
  // Deliberate read-only connection failure and real recovery; no second upload.
  await page.route("https://api.gateway.ethswarm.org/gateway", (r) =>
    r.abort(),
  );
  await page.locator('.rail-nav [data-view="help"]').click();
  await page.locator(".device-settings > summary").click();
  await page.locator("#connect-storage").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#storage-status")
      ?.textContent?.includes("unavailable"),
  );
  await page.unroute("https://api.gateway.ethswarm.org/gateway");
  await page.locator("#connect-storage").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#storage-status")
      ?.textContent?.includes("No Swarm account required"),
  );
  const result = {
    recordedAt: new Date().toISOString(),
    origin: "https://cutout-ethrome-2026.vercel.app",
    ...actual,
    errors,
    checks: [
      "Fresh production-origin browser POST/retrieval under actual CORS/CSP without Swarm iframe, account or wallet",
      "Read-only gateway failure is visible; retry reconnects without identity setup",
    ],
    scope:
      "Re-upload of the same generated public ciphertext from the isolated adapter probe, no additional report or payment. No credentials used.",
  };
  await writeFile(
    process.argv[3] ??
      ".runtime/cutout-gateway/evidence/production-origin.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
