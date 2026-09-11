import { test, expect, type Page } from "@playwright/test";
import { createPublicClient, createTestClient, http, parseUnits } from "viem";
import { ExitMarketAbi } from "../../packages/shared/ExitMarket";
import { OfferKeyRegistryAbi } from "../../packages/shared/OfferKeyRegistry";
import { TestWithdrawalVaultAbi } from "../../packages/shared/TestWithdrawalVault";
import { TestUSDCAbi } from "../../packages/shared/TestUSDC";
const addresses = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
] as const;
async function role(page: Page, index: number) {
  await page.getByLabel("Local demo wallet").selectOption(String(index));
  await expect(
    page.getByRole("button", {
      name: new RegExp(addresses[index].slice(0, 6), "i"),
    }),
  ).toBeVisible();
}
async function originate(page: Page) {
  await role(page, 3);
  await page.getByRole("button", { name: "Portfolio", exact: true }).click();
  await page.getByRole("button", { name: "Get funds", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Confirmed onchain" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sell a withdrawal", exact: true })
    .click();
  await page.getByRole("button", { name: /Create test claim/ }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Confirmed onchain" }),
  ).toBeVisible();
  const picker = page.getByLabel("Select withdrawal");
  const values = await picker
    .locator("option")
    .evaluateAll((nodes) =>
      nodes
        .filter((n) => n.textContent?.includes("Yours"))
        .map((n) => (n as HTMLOptionElement).value),
    );
  const id = values.at(-1)!;
  await picker.selectOption(id);
  return id;
}
test("an idle claim matures through normal local blocks without a servicing transaction", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await expect(page.getByLabel("Local demo wallet")).toBeVisible();
  const id = await originate(page);
  const d = await (await request.get("/api/config")).json();
  const chain = createPublicClient({ transport: http(d.rpcUrl) });
  const before = await chain.getBlock();
  await page.getByRole("button", { name: "Markets", exact: true }).click();
  await page
    .getByRole("button", { name: `View claim ${id}`, exact: true })
    .click();
  // No test-clock RPC, transaction, manual refresh or injected response during this wait.
  await expect(
    page.getByRole("button", { name: "Collect 4,000.00 USDC", exact: true }),
  ).toBeEnabled({ timeout: 75000 });
  const after = await chain.getBlock();
  expect(after.number).toBeGreaterThan(before.number);
  expect(after.timestamp - before.timestamp).toBeGreaterThanOrEqual(55n);
});

test("public sale reconciles exact payment and acquired rights onchain", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Available withdrawals/ }),
  ).toBeVisible();
  const id = await originate(page);
  const d = await (await request.get("/api/config")).json();
  const chain = createPublicClient({ transport: http(d.rpcUrl) });
  const before = await chain.readContract({
    address: d.token,
    abi: TestUSDCAbi,
    functionName: "balanceOf",
    args: [addresses[3]],
  });
  await page.getByRole("button", { name: "Request fresh offers" }).click();
  await expect(page.locator(".offer-row")).toHaveCount(2);
  await expect(page.locator(".offer-row.selected")).toContainText("9,960.00");
  await page.getByRole("button", { name: "Review sale", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("9,960.00");
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Sell for 9,960.00 USDC", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const p = await chain.readContract({
    address: d.market,
    abi: ExitMarketAbi,
    functionName: "positions",
    args: [BigInt(id)],
  });
  expect(p[0].toLowerCase()).toBe(addresses[1].toLowerCase());
  expect(p[2]).toBe(1n);
  const after = await chain.readContract({
    address: d.token,
    abi: TestUSDCAbi,
    functionName: "balanceOf",
    args: [addresses[3]],
  });
  expect(after - before).toBe(parseUnits("9960", 6));
  await role(page, 1);
  await page.getByRole("button", { name: "Portfolio", exact: true }).click();
  await expect(page.getByRole("main")).toContainText(
    `Test vault withdrawal #${id}`,
  );
  await page.screenshot({
    path: "test-results/public-sale-portfolio.png",
    fullPage: true,
  });
  // Continue through partial collection and resale using actual UI actions.
  await page
    .getByRole("button", { name: "Sell a withdrawal", exact: true })
    .click();
  await page.getByLabel("Select withdrawal").selectOption(id);
  await page.getByRole("button", { name: "Request fresh offers" }).click();
  await expect(page.locator(".offer-row")).toHaveCount(2);
  const source = await chain.readContract({
    address: d.source,
    abi: TestWithdrawalVaultAbi,
    functionName: "requests",
    args: [p[1]],
  });
  expect(d.environment).toBe("local");
  const clock = createTestClient({ mode: "anvil", transport: http(d.rpcUrl) });
  await clock.setNextBlockTimestamp({ timestamp: source[4] + 61n });
  await clock.mine({ blocks: 1 });
  await page.getByRole("button", { name: "Markets", exact: true }).click();
  await page
    .getByRole("button", { name: "Refresh", exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: `View claim ${id}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Collect 4,000.00 USDC", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Withdraw recognized cash", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Withdraw recognized cash", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Withdraw recognized cash", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Sell remaining rights", exact: true })
    .click();
  await expect(page.locator(".offer-row").first()).toContainText("stale");
  await role(page, 2);
  await page.getByRole("button", { name: "Markets", exact: true }).click();
  await page
    .getByRole("button", { name: `View claim ${id}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Make an offer", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("textbox").fill("5985");
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Sign purchase offer", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await role(page, 1);
  await page
    .getByRole("button", { name: "Sell a withdrawal", exact: true })
    .click();
  await page.getByLabel("Select withdrawal").selectOption(id);
  await page.getByRole("button", { name: "Review sale", exact: true }).click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Sell for 5,985.00 USDC", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await clock.setNextBlockTimestamp({ timestamp: source[4] + 121n });
  await clock.mine({ blocks: 1 });
  await role(page, 2);
  await page.getByRole("button", { name: "Markets", exact: true }).click();
  await page
    .getByRole("button", { name: `View claim ${id}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Collect 6,000.00 USDC", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Withdraw recognized cash", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Withdraw recognized cash", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("status").filter({ hasText: "Confirmed onchain" }),
  ).toBeVisible();
  const final = await chain.readContract({
    address: d.market,
    abi: ExitMarketAbi,
    functionName: "positions",
    args: [BigInt(id)],
  });
  expect(final[0].toLowerCase()).toBe(addresses[2].toLowerCase());
  expect(final[5]).toBe(parseUnits("10000", 6));
  expect(final[4]).toBe(0n);
  await page.getByRole("heading", { level: 1 }).click();
  await page.screenshot({
    path: "test-results/browser-complete-residual-lifecycle.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("custom private price survives reload and stays encrypted for outsider", async ({
  page,
  browser,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Local demo wallet")).toBeVisible();
  const id = await originate(page);
  await page
    .getByRole("button", { name: "Private Offers", exact: true })
    .click();
  await page.getByRole("button", { name: "Request fresh offers" }).click();
  await expect(page.locator(".offer-row")).toHaveCount(2);
  await expect(page.locator(".offer-row").first()).not.toContainText(
    "Encrypted",
  );
  const bodies: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("publish-envelope")) bodies.push(r.postData() ?? "");
  });
  await role(page, 1);
  await page.getByRole("button", { name: "Markets", exact: true }).click();
  await page
    .getByRole("button", { name: `View claim ${id}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Make an offer", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Private offer", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("textbox").fill("9987.123456");
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Sign purchase offer", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).not.toContain("9987.123456");
  expect(bodies[0]).not.toContain("9987123456");
  expect(bodies[0]).not.toContain("netPayment");
  await role(page, 3);
  await page
    .getByRole("button", { name: "Sell a withdrawal", exact: true })
    .click();
  await page.getByLabel("Select withdrawal").selectOption(id);
  await page
    .getByRole("button", { name: "Private Offers", exact: true })
    .click();
  await expect(page.locator(".offer-row").first()).toContainText(
    "9,987.123456",
  );
  await page.reload();
  await role(page, 3);
  await page
    .getByRole("button", { name: "Sell a withdrawal", exact: true })
    .click();
  await page.getByLabel("Select withdrawal").selectOption(id);
  await page
    .getByRole("button", { name: "Private Offers", exact: true })
    .click();
  await expect(page.locator(".offer-row").first()).toContainText(
    "9,987.123456",
  );
  const outsider = await browser.newContext();
  const op = await outsider.newPage();
  await op.goto("/");
  await expect(op.getByLabel("Local demo wallet")).toBeVisible();
  await op
    .getByRole("button", { name: "Sell a withdrawal", exact: true })
    .click();
  await op.getByLabel("Select withdrawal").selectOption(id);
  await op.getByRole("button", { name: "Private Offers", exact: true }).click();
  await expect(op.locator(".offer-row")).toHaveCount(3);
  await expect(op.locator(".offer-row").first()).toContainText("Encrypted");
  await expect(op.locator("body")).not.toContainText("9,987.123456");
  const response = await (
    await request.get(`/api/offers?claimId=${id}`)
  ).json();
  expect(JSON.stringify(response)).not.toContain("netPayment");
  for (const record of response.records) {
    const bytes = await (
      await request.get(
        `/api/records/${record.reference}?sha256=${record.sha256}`,
      )
    ).text();
    expect(bytes).not.toContain("netPayment");
    expect(bytes).not.toContain("9987123456");
    expect(JSON.parse(bytes).format).toBe("exit-private-offer");
  }
  await op.screenshot({
    path: "test-results/private-outsider.png",
    fullPage: true,
  });
  await page.screenshot({
    path: "test-results/private-seller-reloaded.png",
    fullPage: true,
  });
  await outsider.close();
  const d = await (await request.get("/api/config")).json();
  const chain = createPublicClient({ transport: http(d.rpcUrl) });
  const before = await chain.readContract({
    address: d.token,
    abi: TestUSDCAbi,
    functionName: "balanceOf",
    args: [addresses[3]],
  });
  await page.getByRole("button", { name: "Review sale", exact: true }).click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Sell for 9,987.123456 USDC", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const after = await chain.readContract({
    address: d.token,
    abi: TestUSDCAbi,
    functionName: "balanceOf",
    args: [addresses[3]],
  });
  expect(after - before).toBe(parseUnits("9987.123456", 6));
  const pos = await chain.readContract({
    address: d.market,
    abi: ExitMarketAbi,
    functionName: "positions",
    args: [BigInt(id)],
  });
  expect(pos[0].toLowerCase()).toBe(addresses[1].toLowerCase());
  const events = await chain.getContractEvents({
    address: d.market,
    abi: ExitMarketAbi,
    eventName: "Accepted",
    args: { claimId: BigInt(id) },
    fromBlock: BigInt(d.blockNumber),
  });
  expect(events.at(-1)?.args.netPayment).toBe(parseUnits("9987.123456", 6));
});
test("responsive market remains usable without horizontal overflow", async ({
  page,
}) => {
  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Available withdrawals/ }),
    ).toBeVisible();
    await expect(page.getByLabel("Local demo wallet")).toBeVisible();
    await expect(
      page.getByText("Connect a deployment", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".table-wrap tbody tr").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/market-${width}.png`,
      fullPage: true,
    });
  }
});

test("key rotation and revocation are separate from cancelling a maker signature", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Local demo wallet")).toBeVisible();
  const id = await originate(page);
  await page
    .getByRole("button", { name: "Private Offers", exact: true })
    .click();
  await page.getByRole("button", { name: "Request fresh offers" }).click();
  await expect(page.locator(".offer-row")).toHaveCount(2);
  const config = await (await request.get("/api/config")).json();
  const chain = createPublicClient({ transport: http(config.rpcUrl) });
  const initial = await (await request.get(`/api/offers?claimId=${id}`)).json();
  const requestId = initial.context.requestId;
  await page.getByText("Private offer device keys", { exact: true }).click();
  await page
    .getByLabel("Private key request", { exact: true })
    .selectOption(id);
  await page
    .getByRole("button", { name: "Rotate device key", exact: true })
    .click();
  await expect
    .poll(async () => {
      const r = await chain.readContract({
        address: config.keyRegistry,
        abi: OfferKeyRegistryAbi,
        functionName: "keys",
        args: [addresses[3], requestId],
      });
      return r[1];
    })
    .toBe(2n);
  await page
    .getByRole("button", { name: "Revoke for new offers", exact: true })
    .click();
  await expect
    .poll(async () => {
      const r = await chain.readContract({
        address: config.keyRegistry,
        abi: OfferKeyRegistryAbi,
        functionName: "keys",
        args: [addresses[3], requestId],
      });
      return r[0];
    })
    .toBe(`0x${"0".repeat(64)}`);
  // Previously encrypted offers remain readable with retained old keys; revocation is not erasure.
  await expect(page.locator(".offer-row").first()).not.toContainText(
    "Encrypted",
  );
  await role(page, 1);
  await page.getByRole("button", { name: "Markets", exact: true }).click();
  await page
    .getByRole("button", { name: `View claim ${id}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Make an offer", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("textbox").fill("9876.543210");
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Sign purchase offer", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: `Cancel offer for claim ${id}`, exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Your signed offers" }),
  ).toContainText("Cancelled or consumed");
  await role(page, 3);
  await page
    .getByRole("button", { name: "Sell a withdrawal", exact: true })
    .click();
  await page.getByLabel("Select withdrawal").selectOption(id);
  await page
    .getByRole("button", { name: "Public offers", exact: true })
    .click();
  await expect(page.locator(".offer-row").first()).toContainText("cancelled");
});
