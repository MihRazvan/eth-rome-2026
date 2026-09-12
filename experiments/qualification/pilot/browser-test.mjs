// SPDX-License-Identifier: MIT
// Actual local chain/Bee with wallet bridges using ONLY public Anvil development accounts.
import { chromium } from "@playwright/test";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { termsUploadMessage } from "./terms.ts";
const exec = promisify(execFile),
  dir = process.env.QUALIFICATION_PILOT_DIR ?? ".runtime/qualification-pilot";
const port = Number(process.env.QUALIFICATION_PILOT_PORT ?? 18888);
const config = JSON.parse(await readFile(`${dir}/config.json`, "utf8"));
assert.equal(config.chainId, 31338);
assert.equal(new URL(config.rpcUrl).hostname, "127.0.0.1");
const chain = defineChain({
  id: 31338,
  name: "Local pilot test",
  nativeCurrency: { name: "Test Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
});
const read = createPublicClient({ chain, transport: http() });
const abi = JSON.parse(
  await readFile(
    "experiments/qualification/contracts/out/QualificationEscrow.sol/QualificationEscrow.json",
    "utf8",
  ),
).abi;
const contract = (functionName, args = []) =>
  read.readContract({ address: config.escrow, abi, functionName, args });
const browser = await chromium.launch();
const checks = [],
  pageErrors = [],
  requests = [];
const mnemonic = "test test test test test test test test test test test junk";
async function profile(index) {
  const account = mnemonicToAccount(mnemonic, { addressIndex: index }),
    wallet = createWalletClient({ account, chain, transport: http() });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  await context.exposeBinding("pilotWallet", async (_, req) => {
    if (["eth_accounts", "eth_requestAccounts"].includes(req.method))
      return [account.address];
    if (req.method === "eth_chainId") return "0x7a6a";
    if (req.method === "wallet_switchEthereumChain") {
      assert.equal(req.params[0].chainId, "0x7a6a");
      return null;
    }
    if (req.method === "eth_sendTransaction") {
      const t = req.params[0];
      assert.equal(t.from.toLowerCase(), account.address.toLowerCase());
      return wallet.sendTransaction({
        to: t.to,
        data: t.data,
        value: t.value ? BigInt(t.value) : undefined,
        gas: t.gas ? BigInt(t.gas) : undefined,
      });
    }
    if (req.method === "personal_sign") {
      assert.equal(req.params[1].toLowerCase(), account.address.toLowerCase());
      return wallet.signMessage({ message: { raw: req.params[0] } });
    }
    return read.request(req);
  });
  await context.addInitScript(() => {
    const listeners = {};
    window.pilotTestEvents = (event, value) => {
      for (const fn of listeners[event] ?? []) fn(value);
    };
    window.ethereum = {
      on(event, fn) {
        (listeners[event] ??= []).push(fn);
      },
      async request(req) {
        if (req.method === "eth_chainId" && window.pilotDelayChain) {
          await new Promise((resolve) => (window.pilotReleaseChain = resolve));
        }
        return window.pilotWallet(req);
      },
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("request", (req) => {
    if (req.url().includes("/api/upload")) requests.push(req.postData() ?? "");
  });
  await page.goto(`http://127.0.0.1:${port}`);
  await page.locator("#connect").click();
  await page.waitForFunction(
    () => document.querySelector("#wallet").textContent !== "Connect to begin",
  );
  return { page, context, account, wallet };
}
async function click(page, selector) {
  await page.locator(selector).click();
  await page.waitForFunction(
    () => !document.querySelector("#connect").disabled,
  );
  if ((await page.locator("#notice").getAttribute("class")) === "error")
    throw Error(await page.locator("#notice").textContent());
}
async function failClick(page, selector) {
  await page.locator(selector).click();
  await page.waitForFunction(
    () => !document.querySelector("#connect").disabled,
  );
  assert.equal(await page.locator("#notice").getAttribute("class"), "error");
}
try {
  await mkdir(`${dir}/evidence`, { recursive: true });
  const customer = await profile(1),
    worker = await profile(2),
    outsider = await profile(3),
    customerB = await profile(5);
  for (const actor of [customer, worker, outsider, customerB])
    await click(actor.page, "#register");
  await click(customer.page, "#mint");
  await customer.page
    .locator("#task-title")
    .fill("Audit allowance boundaries ✅");
  await customer.page.locator("#scope-public").check();
  await click(customer.page, "#create");
  const id = String(await contract("nextJob"));
  assert.equal(
    (await contract("jobs", [BigInt(id)]))[0].toLowerCase(),
    customer.account.address.toLowerCase(),
  );
  checks.push(
    "Client wallet owns funding; device bindings registered by distinct wallets",
  );
  const termsResponse = await customer.page.request.get(
    `http://127.0.0.1:${port}/api/terms?job=${id}`,
  );
  assert.equal(termsResponse.status(), 200);
  const committedTerms = await termsResponse.json();
  assert.equal(committedTerms.terms.title, "Audit allowance boundaries ✅");
  assert.equal(
    committedTerms.digest,
    (await contract("jobs", [BigInt(id)]))[8],
  );
  checks.push(
    "Client-defined Unicode scope stored on Bee and verified against immutable funded terms",
  );
  const expiresAt = Number((await read.getBlock()).timestamp) + 240;
  const termsSignature = await customer.wallet.signMessage({
    message: termsUploadMessage(
      committedTerms.terms,
      committedTerms.digest,
      expiresAt,
    ),
  });
  const requestBytes = Buffer.from(
    JSON.stringify({
      terms: committedTerms.terms,
      signature: termsSignature,
      expiresAt,
    }),
  );
  const splitAt = requestBytes.indexOf(Buffer.from("✅")) + 1;
  assert.ok(splitAt > 1);
  const chunked = await new Promise((resolve, reject) => {
    const req = httpRequest(
      `http://127.0.0.1:${port}/api/terms`,
      {
        method: "POST",
        headers: {
          origin: `http://127.0.0.1:${port}`,
          "content-type": "application/json",
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            body: JSON.parse(Buffer.concat(chunks).toString()),
          }),
        );
      },
    );
    req.on("error", reject);
    req.write(requestBytes.subarray(0, splitAt));
    setTimeout(() => req.end(requestBytes.subarray(splitAt)), 25);
  });
  assert.equal(chunked.status, 200);
  assert.equal(chunked.body.sha256, committedTerms.digest);
  checks.push(
    "Real HTTP request preserves signed scope when a Unicode character crosses chunk boundaries",
  );
  await click(worker.page, "#refresh");
  await worker.page
    .locator(`[data-action="prepare"][data-id="${id}"]`)
    .locator("..")
    .locator("summary")
    .click();
  await click(worker.page, `[data-action="prepare"][data-id="${id}"]`);
  const job = await contract("jobs", [BigInt(id)]),
    context = await contract("contextFor", [BigInt(id)]);
  const prover = process.cwd() + `/${dir}/prover`;
  const holderFiles = JSON.parse(
    await readFile(`${dir}/holder/latest.json`, "utf8"),
  );
  await exec(prover, [
    "state",
    "--credential",
    holderFiles.credential,
    "--snapshot",
    `${dir}/holder/snapshot.json`,
    "--out",
    `${dir}/holder-private-state.json`,
  ]);
  await exec(prover, [
    "prove",
    "--setup",
    ".runtime/qualification/setup",
    "--credential",
    holderFiles.credential,
    "--holder",
    holderFiles.holder,
    "--state",
    `${dir}/holder-private-state.json`,
    "--context",
    String(context),
    "--recipient",
    worker.account.address,
    "--deadline",
    String(job[4] - 1n),
    "--class",
    "7",
    "--out",
    `${dir}/presentation.json`,
  ]);
  await worker.page
    .locator(`[data-proof="${id}"]`)
    .setInputFiles(`${dir}/presentation.json`);
  await worker.page
    .locator(`[data-action="accept"][data-id="${id}"]`)
    .waitFor();
  await click(worker.page, `[data-action="accept"][data-id="${id}"]`);
  assert.equal(
    (await contract("jobs", [BigInt(id)]))[1].toLowerCase(),
    worker.account.address.toLowerCase(),
  );
  checks.push(
    "Holder-local CLI exports real proof; reviewer wallet accepts exact bound assignment",
  );
  const plaintext =
    "PRIVATE PILOT REVIEW: allowance cap verified across the supported transfer paths.";
  await worker.page.locator(`#review-${id}`).fill(plaintext);
  await click(worker.page, `[data-action="submit"][data-id="${id}"]`);
  const digest = await contract("documentDigests", [BigInt(id)]);
  assert.notEqual(digest, `0x${"0".repeat(64)}`);
  assert.equal(requests.length, 1);
  assert.ok(
    requests.every(
      (body) =>
        !body.includes(plaintext) &&
        !body.includes("holderSecret") &&
        !body.includes("privateKey"),
    ),
  );
  checks.push(
    "Worker signs upload authorization and commits ciphertext locator plus digest onchain; HTTP receives no plaintext or private keys",
  );
  await click(customer.page, "#refresh");
  await click(customer.page, `[data-action="retrieve"][data-id="${id}"]`);
  assert.equal(
    await customer.page.locator(`#document-${id}`).textContent(),
    plaintext,
  );
  await customer.page.reload();
  await click(customer.page, "#connect");
  await click(customer.page, `[data-action="retrieve"][data-id="${id}"]`);
  assert.equal(
    await customer.page.locator(`#document-${id}`).textContent(),
    plaintext,
  );
  checks.push(
    "Independent client browser decrypts actual Bee retrieval; private key survives reload",
  );
  await click(outsider.page, "#refresh");
  await failClick(outsider.page, `[data-action="retrieve"][data-id="${id}"]`);
  assert.equal(
    await outsider.page.locator(`#document-${id}`).textContent(),
    "",
  );
  checks.push("Third wallet/browser cannot decrypt the public ciphertext");
  await click(customer.page, "#rotate");
  await failClick(customer.page, `[data-action="retrieve"][data-id="${id}"]`);
  await customer.page.waitForFunction(
    (id) =>
      document.querySelector(`[data-history="${id}"]`).options.length === 2,
    id,
  );
  const old = await customer.page
    .locator(`[data-history="${id}"] option`)
    .nth(1)
    .getAttribute("value");
  await customer.page.locator(`[data-history="${id}"]`).selectOption(old);
  await click(customer.page, `[data-action="retrieve"][data-id="${id}"]`);
  assert.equal(
    await customer.page.locator(`#document-${id}`).textContent(),
    plaintext,
  );
  checks.push(
    "Rotated key cannot decrypt historical review; explicitly retained previous key can",
  );
  await customer.page.evaluate(() => window.pilotTestEvents("disconnect", {}));
  assert.equal(
    await customer.page.locator(`#document-${id}`).textContent(),
    "",
  );
  assert.equal(
    await customer.page.locator("#wallet").textContent(),
    "Connect to begin",
  );
  checks.push(
    "Provider disconnect removes decrypted content and invalidates wallet session",
  );
  await click(customerB.page, "#mint");
  await customerB.page
    .locator("#task-title")
    .fill("Review a second withdrawal implementation");
  await customerB.page.locator("#task-reward").fill("175.5");
  await customerB.page.locator("#scope-public").check();
  await click(customerB.page, "#create");
  const secondId = String(await contract("nextJob"));
  assert.notEqual(secondId, id);
  const secondJob = await contract("jobs", [BigInt(secondId)]);
  assert.equal(secondJob[2], 175_500_000n);
  assert.equal(
    secondJob[0].toLowerCase(),
    customerB.account.address.toLowerCase(),
  );
  await exec(prover, [
    "prove",
    "--setup",
    ".runtime/qualification/setup",
    "--credential",
    holderFiles.credential,
    "--holder",
    holderFiles.holder,
    "--state",
    `${dir}/holder-private-state.json`,
    "--context",
    String(await contract("contextFor", [BigInt(secondId)])),
    "--recipient",
    worker.account.address,
    "--deadline",
    String(secondJob[4] - 1n),
    "--class",
    "7",
    "--out",
    `${dir}/presentation-second.json`,
  ]);
  const firstProof = JSON.parse(
    await readFile(`${dir}/presentation.json`, "utf8"),
  );
  const secondProof = JSON.parse(
    await readFile(`${dir}/presentation-second.json`, "utf8"),
  );
  assert.notEqual(firstProof.publicInputs[7], secondProof.publicInputs[7]);
  await click(worker.page, "#refresh");
  await worker.page
    .locator(`[data-action="prepare"][data-id="${secondId}"]`)
    .locator("..")
    .locator("summary")
    .click();
  await worker.page
    .locator(`[data-proof="${secondId}"]`)
    .setInputFiles(`${dir}/presentation-second.json`);
  await click(worker.page, `[data-action="accept"][data-id="${secondId}"]`);
  const secondPlaintext =
    "SECOND CLIENT ONLY: review of the distinct withdrawal authorization.";
  await worker.page.locator(`#review-${secondId}`).fill(secondPlaintext);
  await click(worker.page, `[data-action="submit"][data-id="${secondId}"]`);
  await click(customerB.page, "#refresh");
  await click(
    customerB.page,
    `[data-action="retrieve"][data-id="${secondId}"]`,
  );
  assert.equal(
    await customerB.page.locator(`#document-${secondId}`).textContent(),
    secondPlaintext,
  );
  await click(customer.page, "#connect");
  await failClick(
    customer.page,
    `[data-action="retrieve"][data-id="${secondId}"]`,
  );
  assert.equal(
    await customer.page.locator(`#document-${secondId}`).textContent(),
    "",
  );
  assert.equal(requests.length, 2);
  assert.ok(
    requests.every(
      (body) => !body.includes(plaintext) && !body.includes(secondPlaintext),
    ),
  );
  checks.push(
    "Same holder credential accepts a second client's job with a different job-scoped nullifier",
  );
  checks.push(
    "Second client decrypts its review; first client's wallet and retained device keys cannot decrypt it",
  );
  const credential = JSON.parse(await readFile(holderFiles.credential, "utf8"));
  await exec(prover, [
    "registry",
    "revoke",
    "--dir",
    `${dir}/issuer`,
    "--index",
    String(credential.index),
  ]);
  const revokedSnapshot = JSON.parse(
    await readFile(`${dir}/issuer/snapshot.json`, "utf8"),
  );
  const issuerWallet = createWalletClient({
    account: mnemonicToAccount(mnemonic),
    chain,
    transport: http(),
  });
  const rootTx = await issuerWallet.writeContract({
    address: config.escrow,
    abi,
    functionName: "setRoot",
    args: [BigInt(revokedSnapshot.root)],
  });
  await read.waitForTransactionReceipt({ hash: rootTx });
  checks.push(
    "Durably allocated credential revoked permanently; issuer wallet advances authoritative root",
  );
  await click(customer.page, "#connect");
  await click(customer.page, `[data-action="pay"][data-id="${id}"]`);
  assert.equal((await contract("jobs", [BigInt(id)]))[7], 3);
  await click(customerB.page, `[data-action="pay"][data-id="${secondId}"]`);
  assert.equal((await contract("jobs", [BigInt(secondId)]))[7], 3);
  checks.push(
    "Both client wallets approve payment to assigned worker after review and credential revocation",
  );
  // Reproduce a stale connect race: chain lookup waits while provider announces another account.
  await customer.page.evaluate(() => {
    window.pilotTestEvents("disconnect", {});
    window.pilotDelayChain = true;
  });
  await customer.page.locator("#connect").click();
  await customer.page.waitForFunction(() => !!window.pilotReleaseChain);
  await customer.page.evaluate(() => {
    window.pilotTestEvents("accountsChanged", [
      "0x0000000000000000000000000000000000000001",
    ]);
    window.pilotDelayChain = false;
    window.pilotReleaseChain();
  });
  await customer.page.waitForFunction(
    () => !document.querySelector("#connect").disabled,
  );
  assert.equal(
    await customer.page.locator("#wallet").textContent(),
    "Connect to begin",
  );
  checks.push(
    "Delayed connect cannot restore the prior wallet/device after accountsChanged",
  );
  await click(worker.page, "#refresh");
  await worker.page.screenshot({
    path: `${dir}/evidence/reviewer-desktop.png`,
    fullPage: true,
  });
  await customer.page.screenshot({
    path: `${dir}/evidence/client-disconnected.png`,
    fullPage: true,
  });
  await worker.page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await worker.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await worker.page.screenshot({
    path: `${dir}/evidence/reviewer-mobile.png`,
    fullPage: true,
  });
  checks.push("390px responsive pilot has no horizontal overflow");
  assert.deepEqual(pageErrors, []);
  await writeFile(
    `${dir}/evidence/browser.json`,
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        environment:
          "Local Anvil and local Bee, public test wallets injected into isolated real Chromium contexts",
        escrow: config.escrow,
        keyRegistry: config.keyRegistry,
        jobs: [id, secondId],
        checks,
        pageErrors,
      },
      null,
      2,
    ),
  );
  console.log(`Pilot browser integration: ${checks.length} checks passed.`);
} finally {
  await browser.close();
}
