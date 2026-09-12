// Actual public WSS observation only. It does not publish, expire or delete listings.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "https://cutout-ethrome-2026.vercel.app";
const output =
  process.argv[3] ?? ".runtime/cutout-release/discovery-after.json";
const browser = await chromium.launch();
const page = await browser.newPage();
const acknowledgements = new Set(),
  heads = [],
  states = [],
  errors = [];
let entityNotifications = 0,
  queries = 0;
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (req) => {
  if (
    req.url().includes("tiramisu") &&
    req.method() === "POST" &&
    req.postData()?.includes("arkiv_query")
  )
    queries++;
});
page.on("websocket", (ws) => {
  if (!ws.url().includes("tiramisu")) return;
  const methods = new Map();
  ws.on("framesent", (frame) => {
    try {
      const value = JSON.parse(String(frame.payload));
      if (value.method === "eth_subscribe")
        methods.set(value.id, value.params[0]);
    } catch {}
  });
  ws.on("framereceived", (frame) => {
    try {
      const value = JSON.parse(String(frame.payload));
      if (typeof value.result === "string" && methods.has(value.id))
        acknowledgements.add(methods.get(value.id));
      const payload = value.params?.result;
      if (payload?.number) heads.push(payload.number);
      if (payload?.topics) entityNotifications++;
    } catch {}
  });
});
try {
  await page.goto(base + "/?role=reviewer");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#discovery-status")
        ?.textContent?.startsWith("Arkiv live"),
    undefined,
    { timeout: 60000 },
  );
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(2000);
    states.push(await page.locator("#discovery-status").textContent());
  }
  assert.ok(acknowledgements.has("logs") && acknowledgements.has("newHeads"));
  assert.ok(new Set(heads).size >= 3);
  assert.ok(states.every((s) => s.startsWith("Arkiv live")));
  assert.deepEqual(errors, []);
  const evidence = {
    recordedAt: new Date().toISOString(),
    base,
    acknowledgedSubscriptions: [...acknowledgements],
    distinctHeads: new Set(heads).size,
    entityNotifications,
    queries,
    states,
    errors,
    scope:
      "Real public WSS acknowledgements and healthy board observation. Entity traffic may belong to other applications. No Cutout publication, native expiry or funded settlement demonstrated.",
  };
  await mkdir(output.slice(0, output.lastIndexOf("/")), { recursive: true });
  await writeFile(output, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
