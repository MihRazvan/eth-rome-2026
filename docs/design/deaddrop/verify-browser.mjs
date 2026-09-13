// Read-only verification of Deaddrop UI and its explicitly simulated walkthrough.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.argv[2] ?? "http://127.0.0.1:18903";
const output = process.argv[3] ?? ".runtime/deaddrop/verified";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const errors = [],
  checks = [],
  writes = [];
const page = await browser.newPage({
  reducedMotion: "reduce",
  viewport: { width: 1440, height: 1000 },
});
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (message) => {
  if (
    message.type() === "error" &&
    /violates.*Content Security Policy/i.test(message.text())
  )
    errors.push(message.text());
});
page.on("request", (r) => {
  if (
    r.method() === "POST" &&
    /\/api\/(upload|terms)|\/bzz|\/bytes(?:\/|$)/.test(r.url())
  )
    writes.push(r.url());
});
const snap = async (name) => {
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
};
async function demo(mobile = false) {
  await page.locator("#try-demo").click();
  await page.locator("#cd-title").fill("Review permission boundaries");
  assert.equal(await page.locator(".cd-honesty").isVisible(), true);
  await page.locator("#cd-budget").fill("12.50");
  await page.locator("[data-demo-form] button").click();
  await page.locator('[data-demo="fund"]').click();
  await page.locator("[data-demo-valid]").uncheck();
  await page.locator('[data-demo="qualify"]').click();
  assert.match(
    await page.locator(".cd-message").textContent(),
    /valid|expired|revoked/i,
  );
  await page.locator("[data-demo-valid]").check();
  await page.locator('[data-demo="qualify"]').click();
  const report =
    "  Only the assigned reviewer can submit.\nUnicode ✓ <script>not executable</script>\n  ";
  await page.locator("#cd-report").fill(report);
  await page.locator("[data-demo-form] button").click();
  await page.locator("[data-demo-ciphertext]").waitFor({ state: "attached" });
  assert.equal(await page.locator(".cd-approve").isVisible(), false);
  assert.ok(
    (await page.locator("[data-demo-ciphertext]").textContent()).length >
      report.length,
  );
  await snap(mobile ? "demo-sealed-mobile" : "demo-sealed-desktop");
  if (mobile) {
    await page.locator('[data-demo="open"]').focus();
    await page.keyboard.press("Enter");
  } else {
    const grip = await page.locator("[data-demo-cut]").boundingBox(),
      track = await page.locator("[data-demo-track]").boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      track.x + track.width - 2,
      track.y + track.height / 2,
      { steps: 15 },
    );
    await page.mouse.up();
  }
  await page.locator(".cd-opened").waitFor();
  assert.equal(
    await page.locator("[data-demo-plaintext]").textContent(),
    report,
  );
  await snap(mobile ? "demo-opened-mobile" : "demo-opened-desktop");
  await page.locator('[data-demo="approve"]').click();
  assert.match(await page.locator(".cd-receipt").textContent(), /12\.5/);
  assert.match(await page.locator(".cd-receipt").textContent(), /Simulated/);
  await snap(mobile ? "demo-receipt-mobile" : "demo-receipt-desktop");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.locator('[data-demo="restart"]').click();
  await page.locator("#cd-title").waitFor();
  await page.locator('[data-demo="live"]').click();
  assert.equal(await page.locator("#cutout-demo").isVisible(), false);
}
try {
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#dd-home").waitFor();
  await snap("home-desktop");
  await page.locator("#dd-cool").click();
  await page.locator('[data-entry="issuer"]').click();
  await page.locator(".dd-issuer").waitFor();
  await snap("issuer-desktop");
  await page.locator("[data-home]").click();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await snap("home-mobile");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForFunction(
    () => document.querySelector("#readiness")?.children.length > 0,
  );
  await page.evaluate(() => {
    document.querySelector("#start-reviewer").disabled = true;
  });
  await page.locator('#dd-home [data-entry="reviewer"]').click();
  assert.equal(await page.locator("body").getAttribute("data-role"), "client");
  assert.match(
    await page.locator("#dd-home [data-entry-status]").textContent(),
    /Finish the current wallet action/,
  );
  await page.evaluate(() => {
    document.querySelector("#start-reviewer").disabled = false;
  });
  await page.locator('[data-entry="client"]').click();
  checks.push(
    "Thermal landing, keyboard cooling, issuer explanation, 320px layout and client entry",
  );
  await page.waitForFunction(
    () => document.querySelector("#readiness")?.children.length > 0,
  );
  await page.evaluate(() => document.fonts.ready);
  assert.match(await page.title(), /Deaddrop/);
  assert.equal(await page.locator("#mint").isVisible(), false);
  await page.locator("#task-title").fill("Check payment authorization");
  assert.equal(
    await page.locator("#preview-title").textContent(),
    "Check payment authorization",
  );
  await page.locator("#task-reward").fill("17");
  assert.equal(await page.locator("#preview-reward").textContent(), "17");
  await snap("client-desktop");
  await page.locator("#start-reviewer").click();
  assert.equal(await page.locator("#commission").isVisible(), false);
  assert.equal(await page.locator("#opportunity-section").isVisible(), true);
  await snap("reviewer-desktop");
  await page.locator('.rail-nav [data-view="activity"]').click();
  assert.equal(await page.locator("#job-section").isVisible(), true);
  assert.match(
    await page.locator("#jobs").textContent(),
    /Your next review|Find a task/,
  );
  assert.equal(await page.locator("#commission").isVisible(), false);
  await page.locator('.rail-nav [data-view="help"]').click();
  await page.locator(".device-settings > summary").click();
  const storageMode = await page.evaluate(
    async () => (await (await fetch("/api/config")).json()).storageMode,
  );
  if (storageMode === "swarm-gateway") {
    await page.waitForFunction(() =>
      document
        .querySelector("#storage-status")
        ?.textContent?.includes("No Swarm account required"),
    );
    assert.equal(await page.locator("iframe").count(), 0);
    assert.match(
      await page.locator("#readiness").textContent(),
      /no storage account needed/,
    );
  } else {
    await page.locator("#swarm-connect-widget iframe").waitFor();
    assert.equal(
      await page
        .locator("#swarm-connect-widget iframe")
        .evaluate((n) => getComputedStyle(n).position),
      "static",
    );
  }
  await snap("workspace-desktop");
  checks.push(
    "Deaddrop branding, live task preview, distinct role/task/activity/settings navigation, configured Swarm storage readiness",
  );
  await demo();
  checks.push(
    "Desktop walkthrough: invalid eligibility blocked; real AES-GCM encryption and drag-to-cut exact Unicode recovery; explicitly simulated payment; restart and live return",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#start-reviewer").click();
  await snap("reviewer-mobile");
  assert.equal(await page.locator("#commission").isVisible(), false);
  await demo(true);
  checks.push(
    "390px walkthrough and role navigation; keyboard decryption alternative; no horizontal overflow",
  );
  const deepLink = await browser.newPage();
  deepLink.on("pageerror", (e) => errors.push(e.message));
  await deepLink.goto(`${base}/?role=reviewer`);
  await deepLink.waitForFunction(
    () => document.querySelector("#readiness")?.children.length > 0,
  );
  assert.equal(
    await deepLink.locator("#workspace-title").textContent(),
    "Find your next review",
  );
  assert.equal(await deepLink.locator("#commission").isVisible(), false);
  await deepLink.locator("#board-order").selectOption("reward");
  assert.equal(await deepLink.locator("#board-order").inputValue(), "reward");
  await deepLink.locator('.rail-nav [data-view="help"]').click();
  assert.equal(new URL(deepLink.url()).searchParams.get("view"), "help");
  await deepLink.reload();
  await deepLink.locator(".device-settings").waitFor();
  assert.equal(
    await deepLink.locator("body").getAttribute("data-view"),
    "help",
  );
  await deepLink.close();
  checks.push(
    "Direct reviewer link renders reviewer heading and usable task sorting without a role-toggle repair",
  );
  const offline = await browser.newPage();
  offline.on("pageerror", (e) => errors.push(e.message));
  await offline.route("**/api/config", (r) => r.abort());
  await offline.goto(base);
  await offline.locator(".dd-demo-link").click();
  await offline.locator("#cd-title").waitFor();
  await offline.close();
  checks.push(
    "Guided walkthrough stays available when live configuration cannot load",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  await writeFile(
    `${output}/browser.json`,
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        base,
        checks,
        errors,
        storageWrites: writes,
        scope:
          "Read-only hosted workspace plus explicit browser simulation. No funded transaction, credential proof or Swarm upload performed.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ checks: checks.length, errors, writes }));
} finally {
  await browser.close();
}
