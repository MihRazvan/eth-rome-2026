import { test, expect } from "@playwright/test";

// Explicit preview data makes navigation/keyboard checks deterministic; no action submits.
// Set EXIT_BROWSER_BASE_URL to an isolated frontend when developing a worktree.
test.use({
  baseURL: process.env.EXIT_BROWSER_BASE_URL ?? "http://127.0.0.1:5173",
});

test("claim and private negotiation survive reload and browser history without losing preview flags", async ({
  page,
}) => {
  await page.goto("/?preview=1&concept=receipt&role=seller");
  await page
    .getByRole("button", { name: "View claim 1041", exact: true })
    .click();
  await expect(page).toHaveURL(/view=claim/);
  await page
    .getByRole("button", { name: "View buyer offers", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Private Offers", exact: true })
    .click();
  const saved = new URL(page.url());
  expect(Object.fromEntries(saved.searchParams)).toMatchObject({
    preview: "1",
    concept: "receipt",
    role: "seller",
    view: "trade",
    claim: "1041",
    offers: "private",
  });
  await page.reload();
  await expect(page.getByLabel("Select withdrawal")).toHaveValue("1041");
  await expect(
    page.getByRole("button", { name: "Private Offers", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Public offers", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "The ownership trail", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".claim-number")).toHaveText("#1041");
  await page.goForward();
  await page.goForward();
  await expect(
    page.getByRole("button", { name: "Private Offers", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Select withdrawal").selectOption("1040");
  await expect(page).toHaveURL(/claim=1040/);
  await page.goBack();
  await expect(page.getByLabel("Select withdrawal")).toHaveValue("1041");
});

test("missing and malformed claim links never substitute another position", async ({
  page,
}) => {
  for (const id of ["99999999", "invalid"]) {
    await page.goto(`/?preview=1&view=trade&claim=${id}&offers=private`);
    await expect(
      page.getByRole("heading", { name: "Claim unavailable", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".trade-layout")).toHaveCount(0);
    await expect(page.locator(".receipt")).toHaveCount(0);
    await expect(
      page.getByText("No other claim has been substituted.", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Browse available claims", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /Available withdrawals/ }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.has("claim")).toBe(false);
    expect(new URL(page.url()).searchParams.get("offers")).toBe("private");
  }
});

test("trade dialogs have accessible names and restore keyboard focus without publishing entered terms", async ({
  page,
}) => {
  await page.goto("/?preview=1&role=seller&view=claim&claim=1042");
  const makeOffer = page.getByRole("button", {
    name: "Make an offer",
    exact: true,
  });
  await makeOffer.focus();
  await page.keyboard.press("Enter");
  const makerDialog = page.getByRole("dialog", {
    name: "Make a purchase offer",
    exact: true,
  });
  await expect(makerDialog).toBeVisible();
  await expect(makerDialog).toContainText("100,000 test USDC spending limit");
  await expect(makerDialog).toContainText(
    "Only your signed offers can spend it.",
  );
  await makerDialog
    .getByRole("button", { name: "Private offer", exact: true })
    .click();
  await makerDialog.getByRole("textbox").fill("9987.123456");
  await expect(makerDialog).toContainText(
    "Request metadata and timing remain public",
  );
  expect(page.url()).not.toContain("9987");
  await page.keyboard.press("Escape");
  await expect(makerDialog).toHaveCount(0);
  await expect(makeOffer).toBeFocused();
  await page.keyboard.press("Enter");
  await makerDialog
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(makeOffer).toBeFocused();

  await page.goto("/?preview=1&role=seller&view=trade&claim=1042");
  const review = page.getByRole("button", { name: "Review sale", exact: true });
  await review.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Review your sale", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(review).toBeFocused();
});

test("current read-only chain state has qualified freshness and narrow-screen navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".state-freshness")).toContainText(
    "Chain state last checked",
  );
  await expect(page.locator(".state-freshness")).toContainText(
    "not an offer guarantee",
  );
  await expect(page.locator(".state-freshness time")).toHaveAttribute(
    "datetime",
    /T/,
  );
  await page.setViewportSize({ width: 320, height: 900 });
  await page
    .getByRole("button", { name: "Sell a withdrawal", exact: true })
    .click();
  await expect(page.getByLabel("Select withdrawal")).toBeVisible();
  const id = await page.getByLabel("Select withdrawal").inputValue();
  await page
    .getByRole("button", { name: "Private Offers", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Select withdrawal")).toHaveValue(id);
  await expect(
    page.getByRole("button", { name: "Private Offers", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await expect(page.locator(".state-freshness")).not.toHaveAttribute(
    "role",
    "status",
  );
});

test("an external wallet change clears confidential maker input and consent", async ({
  page,
}) => {
  // Uses only existing local roles and reads; it does not sign, approve or submit.
  await page.goto("/?view=claim&claim=1&offers=private");
  await page.getByLabel("Local demo wallet").selectOption("0");
  await page
    .getByRole("button", { name: "Make an offer", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Make a purchase offer",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Private offer", exact: true })
    .click();
  await dialog.getByRole("textbox").fill("9876.654321");
  await dialog.getByRole("checkbox").check();
  // Models a wallet-extension account change while a native modal makes the page inert.
  // The public local control emits the same controller identity update; no chain write occurs.
  await page
    .getByLabel("Local demo wallet")
    .evaluate((select: HTMLSelectElement) => {
      select.value = "1";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /0x7099/i })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("offers")).toBe("private");
  await page
    .getByRole("button", { name: "Make an offer", exact: true })
    .click();
  await expect(dialog.getByRole("textbox")).toHaveValue("");
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await expect(page.locator("body")).not.toContainText("9876.654321");
});
