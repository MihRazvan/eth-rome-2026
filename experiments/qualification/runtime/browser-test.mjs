// SPDX-License-Identifier: MIT
// Run against the fresh local workbench. Uses actual UI, proof/chain/Bee; no request mocking.
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [],
  requestBodies = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (req) => {
  if (req.method() === "POST") requestBodies.push(req.postData() ?? "");
});
const click = async (action, id) => {
  await page.locator(`[data-action="${action}"][data-id="${id}"]`).click();
  await page.waitForFunction(() => !document.querySelector("button")?.disabled);
};
const role = (name) => page.getByRole("button", { name, exact: true }).click();
const apiState = () =>
  page.evaluate(() => fetch("/api/state").then((r) => r.json()));
try {
  await page.goto("http://127.0.0.1:18787");
  await page
    .getByRole("button", { name: "Prove current qualification" })
    .waitFor();
  await page.screenshot({
    path: ".runtime/qualification/reviewer-desktop.png",
    fullPage: true,
  });
  const initial = await apiState();
  assert.equal(initial.jobs.length, 1, "Start with a fresh workbench");
  assert.equal(initial.jobs[0].status, "Open");
  await click("prove", "1");
  assert.equal((await apiState()).proof.proofBytes, 256);
  await click("accept", "1");
  assert.equal((await apiState()).jobs[0].status, "Accepted");
  checks.push(
    "Browser-generated request obtains real local proof and accepts assignment onchain",
  );
  const plaintext =
    "PRIVATE TEST REVIEW: cap allowances and reject expired authorizations.";
  await page.locator("#document-1").fill(plaintext);
  await click("submit-document", "1");
  assert.equal((await apiState()).jobs[0].status, "Submitted");
  assert.ok(requestBodies.some((s) => s.includes("submit-document")));
  assert.ok(
    requestBodies.every(
      (s) => !s.includes(plaintext) && !s.includes("holderSecret"),
    ),
  );
  await role("Client");
  await click("retrieve", "1");
  assert.equal(await page.locator("#retrieved-1").textContent(), plaintext);
  checks.push(
    "AES-GCM encryption before HTTP; local Bee upload and separate-node retrieval; browser decryption matches original",
  );
  await page.screenshot({
    path: ".runtime/qualification/client-decrypted.png",
    fullPage: true,
  });
  await page.locator("#create").click();
  await page.waitForFunction(() => !document.querySelector("button")?.disabled);
  await role("Reviewer");
  await click("prove", "2");
  const secondProof = (await apiState()).proof;
  assert.equal(secondProof.jobId, "2");
  await role("Issuer");
  await page.locator("#revoke").click();
  await page.waitForFunction(() => !document.querySelector("button")?.disabled);
  assert.equal((await apiState()).revoked, true);
  await role("Reviewer");
  await click("accept", "2");
  assert.equal((await apiState()).jobs[1].status, "Open");
  assert.equal(await page.locator("#notice").getAttribute("class"), "error");
  await click("prove", "2");
  assert.equal(await page.locator("#notice").getAttribute("class"), "error");
  checks.push(
    "Issuer revocation makes both previously generated acceptance and fresh proof attempt fail visibly",
  );
  await role("Client");
  await click("pay", "1");
  assert.equal((await apiState()).workerBalance, "250000000");
  assert.equal((await apiState()).jobs[0].status, "Paid");
  checks.push(
    "Client approves and pays already-submitted work after revocation",
  );
  await page.screenshot({
    path: ".runtime/qualification/paid-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: ".runtime/qualification/paid-mobile.png",
    fullPage: true,
  });
  checks.push("390px mobile layout has no horizontal overflow");
  assert.deepEqual(errors, []);
  const secondTab = await browser.newPage();
  await secondTab.goto("http://127.0.0.1:18787");
  await secondTab.locator('[data-action="retrieve"][data-id="1"]').click();
  await secondTab
    .getByText("This tab does not hold the document key.", { exact: false })
    .waitFor();
  checks.push(
    "Separate tab correctly reports unavailable key; no invented key delivery",
  );
  await writeFile(
    ".runtime/qualification/browser-evidence.json",
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        environment: "Local Anvil and local Bee, test roles in one helper",
        checks,
        pageErrors: errors,
        ciphertextRequests: requestBodies.filter((s) =>
          s.includes("submit-document"),
        ).length,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Browser qualification flow: ${checks.length} checks passed.`);
} finally {
  await browser.close();
}
