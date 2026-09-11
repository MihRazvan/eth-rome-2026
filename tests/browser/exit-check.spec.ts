import { test, expect, type Page } from "@playwright/test";
import { decodeFunctionData, encodeFunctionResult, toHex } from "viem";
import {
  SOURCES,
  lidoReadAbi,
  etherfiReadAbi,
} from "../../packages/viability/claims";

// Deterministic UI boundary tests: all Ethereum JSON-RPC below is explicitly mocked.
// They do not establish mainnet status. Independent RPC smoke evidence is separate.
test.use({
  baseURL: process.env.EXIT_BROWSER_BASE_URL ?? "http://127.0.0.1:5173",
});
const owner = "0x1111111111111111111111111111111111111111";
const ether = 10n ** 18n;
const rpcUrl = "https://ethereum-rpc.publicnode.com/**";

async function mockRpc(
  page: Page,
  options: {
    changed?: boolean;
    fail?: () => boolean;
    hold?: () => Promise<void>;
  } = {},
) {
  const requests: unknown[] = [];
  await page.route(rpcUrl, async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (options.fail?.()) {
      await route.abort("failed");
      return;
    }
    let result: unknown;
    if (body.method === "eth_chainId") result = "0x1";
    else if (body.method === "eth_getBlockByNumber")
      result = {
        number: toHex(25956536),
        timestamp: toHex(1789142400),
        hash: "0x" + "1".repeat(64),
        parentHash: "0x" + "2".repeat(64),
        transactions: [],
        uncles: [],
        gasLimit: "0x1000000",
        gasUsed: "0x0",
        difficulty: "0x0",
        extraData: "0x",
        miner: owner,
        size: "0x100",
      };
    else if (body.method === "eth_getStorageAt") {
      const config =
        body.params[0].toLowerCase() === SOURCES.lido.address.toLowerCase()
          ? SOURCES.lido
          : SOURCES.etherfi;
      result =
        "0x" +
        (options.changed ? owner : config.implementation)
          .slice(2)
          .padStart(64, "0");
    } else if (body.method === "eth_call") {
      const lido =
        body.params[0].to.toLowerCase() === SOURCES.lido.address.toLowerCase();
      const abi = lido ? lidoReadAbi : etherfiReadAbi;
      const decoded = decodeFunctionData({ abi, data: body.params[0].data });
      let value: unknown;
      const args = decoded.args as readonly unknown[] | undefined;
      const id = Array.isArray(args?.[0])
        ? BigInt(args[0][0])
        : typeof args?.[0] === "bigint"
          ? args[0]
          : 1n;
      switch (decoded.functionName) {
        case "getLastRequestId":
          value = 200000n;
          break;
        case "nextRequestId":
          value = 200000;
          break;
        case "getWithdrawalStatus":
          if (id === 1n) await options.hold?.();
          value = [
            {
              amountOfStETH: 10n * ether,
              amountOfShares: 9n * ether,
              owner,
              timestamp: 1788883200n,
              isFinalized: id === 2n,
              isClaimed: id === 3n,
            },
          ];
          break;
        case "getLastCheckpointIndex":
          value = 10n;
          break;
        case "findCheckpointHints":
          value = [1n];
          break;
        case "getClaimableEther":
          value = [9999999999999999999n];
          break;
        case "getRequest":
          value = {
            amountOfEEth: id === 3n ? 0n : 10n * ether,
            shareOfEEth: 9n * ether,
            isValid: id !== 4n,
            feeGwei: 2000000,
          };
          break;
        case "ownerOf":
          value = owner;
          break;
        case "isFinalized":
          value = id === 2n;
          break;
        case "getClaimableAmount":
          value = 9998000000000000000n;
          break;
        default:
          throw new Error("Unexpected contract read");
      }
      result = encodeFunctionResult({
        abi,
        functionName: decoded.functionName,
        result: value,
      } as Parameters<typeof encodeFunctionResult>[0]);
    } else throw new Error(`Unexpected JSON-RPC ${body.method}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result }),
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return requests;
}

async function check(page: Page, id: string, source = "lido") {
  await page
    .getByLabel("Withdrawal source", { exact: true })
    .selectOption(source);
  await page.getByLabel("Withdrawal NFT ID", { exact: true }).fill(id);
  await page
    .getByRole("button", { name: "Check withdrawal", exact: false })
    .click();
  await expect(
    page.getByRole("region", { name: "Withdrawal observation" }),
  ).toBeVisible();
}

test("mock RPC: pending facts and keyboard calculator keep assumptions local and reset on claim change", async ({
  page,
}) => {
  const requests = await mockRpc(page);
  await page.goto("/?check=1");
  await expect(
    page.getByRole("heading", { name: "Check a queued withdrawal." }),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await check(page, "1");
  await expect(page.getByText("Still waiting", { exact: true })).toBeVisible();
  await expect(
    page.getByText("3 completed days", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No funded EXIT buyer is confirmed.", { exact: true }),
  ).toBeVisible();
  const summary = page.locator(".ec-calculator > summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Assumed buyer ceiling" }),
  ).toHaveCount(0);
  const count = requests.length,
    url = page.url();
  const scenarioRequests: string[] = [];
  page.on("request", (request) => scenarioRequests.push(request.url()));
  const fields = {
    "Assumed eventual proceeds": "9.123456789123456789",
    "Remaining wait from now": "7",
    "Required annual return": "8",
    "Additional recovery haircut": "0",
    "Buyer upfront costs": "0.001",
    "Buyer collection costs": "0.001",
    "Additional risk reserve": "0.01",
    "Assumed protocol fee": "5",
    "Seller transaction costs": "0.001",
  };
  for (const [label, value] of Object.entries(fields))
    await page.getByLabel(label, { exact: true }).fill(value);
  await expect(
    page.getByRole("region", { name: "Assumed buyer ceiling" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Assumed buyer ceiling" }),
  ).toContainText("No seller acceptance price is known");
  expect(page.url()).toBe(url);
  expect(requests).toHaveLength(count);
  expect(scenarioRequests).toEqual([]);
  const persisted = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  expect(JSON.stringify(persisted)).not.toContain("9.123456789123456789");
  await page.getByLabel("Remaining wait from now", { exact: true }).fill("");
  await expect(
    page.getByRole("region", { name: "Assumed buyer ceiling" }),
  ).toHaveCount(0);
  await page.getByLabel("Withdrawal NFT ID", { exact: true }).fill("2");
  await expect(
    page.getByRole("region", { name: "Withdrawal observation" }),
  ).toHaveCount(0);
  await check(page, "1");
  await page.locator(".ec-calculator > summary").click();
  await expect(
    page.getByLabel("Assumed eventual proceeds", { exact: true }),
  ).toHaveValue("");
});

test("mock RPC: finalized amounts prefer direct collection; closed/invalid records have no valuation", async ({
  page,
}) => {
  await mockRpc(page);
  await page.goto("/?check=1");
  await check(page, "2");
  await expect(
    page.getByText("Finalized — check collection", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Collection execution has not been simulated", {
        exact: false,
      })
      .first(),
  ).toBeVisible();
  await expect(page.locator(".ec-value strong")).toHaveText(
    "9.999999999999999999 ETH",
  );
  await expect(
    page.getByRole("link", { name: "Review collection at Lido" }),
  ).toHaveAttribute("href", SOURCES.lido.app);
  await expect(page.locator(".ec-calculator")).toHaveCount(0);
  await check(page, "3");
  await expect(
    page.getByText("Already claimed", { exact: true }),
  ).toBeVisible();
  await check(page, "1", "etherfi");
  await expect(
    page.getByText("Not available from this source read", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Recorded source fee", { exact: true }),
  ).toHaveCount(0);
  await check(page, "2", "etherfi");
  await expect(page.locator(".ec-value strong")).toHaveText("9.998 ETH");
  await expect(
    page.getByRole("link", { name: "Review collection at ether.fi" }),
  ).toHaveAttribute("href", SOURCES.etherfi.app);
  await check(page, "3", "etherfi");
  await expect(page.getByText("Request closed", { exact: true })).toBeVisible();
  await expect(page.locator(".ec-calculator")).toHaveCount(0);
  await check(page, "4", "etherfi");
  await expect(
    page.getByText("Request invalid", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ec-calculator")).toHaveCount(0);
});

test("mock RPC: implementation drift is visible and disables the buyer estimate", async ({
  page,
}) => {
  await mockRpc(page, { changed: true });
  await page.goto("/?check=1");
  await check(page, "1");
  await expect(page.getByRole("alert")).toContainText(
    "Source implementation changed",
  );
  await expect(page.locator(".ec-calculator")).toHaveCount(0);
});

test("mock RPC: older completion cannot overwrite a newer claim; failure clears prior observations", async ({
  page,
}) => {
  let release!: () => void,
    blocked!: () => void,
    fail = false;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reached = new Promise<void>((resolve) => {
    blocked = resolve;
  });
  await mockRpc(page, {
    fail: () => fail,
    hold: async () => {
      blocked();
      await held;
    },
  });
  await page.goto("/?check=1");
  await page.getByLabel("Withdrawal NFT ID", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Check withdrawal" }).click();
  await reached;
  await check(page, "2");
  release();
  await expect(
    page.getByRole("heading", { name: "Withdrawal #2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Withdrawal #1", exact: true }),
  ).toHaveCount(0);
  fail = true;
  await page.getByRole("button", { name: "Check withdrawal" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "No cached example has been substituted",
  );
  await expect(
    page.getByRole("region", { name: "Withdrawal observation" }),
  ).toHaveCount(0);
});

test("mock RPC: narrow layout and public example retain honest ownership context", async ({
  page,
}) => {
  await mockRpc(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?check=1");
  const example = page.getByRole("button", {
    name: "Inspect a public example",
  });
  await example.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Public example inspected.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: owner, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".ec-calculator > summary").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
