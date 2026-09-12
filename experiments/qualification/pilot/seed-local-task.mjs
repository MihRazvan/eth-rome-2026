// SPDX-License-Identifier: MIT
// A real local-chain rehearsal, never a public listing or live sponsor integration.
import { readFile, writeFile, open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  parseEventLogs,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { beeBytes } from "../transport/bytes.ts";
import { encodeTerms, matchTerms } from "./terms.ts";

const args = process.argv.slice(2);
if (
  args.some((arg) => !["--check", "--seed", "--new"].includes(arg)) ||
  (args.includes("--check") && args.includes("--seed")) ||
  (args.includes("--new") && !args.includes("--seed"))
) {
  throw Error("Usage: node seed-local-task.mjs [--check | --seed [--new]]");
}
const writing = args.includes("--seed");
const dir = resolve(
  process.env.QUALIFICATION_PILOT_DIR ?? ".runtime/review-pass",
);
const config = JSON.parse(await readFile(resolve(dir, "config.json"), "utf8"));
function localUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw Error(
      "Only literal loopback HTTP endpoints without credentials are allowed",
    );
  }
  return url.href;
}
if (
  config.environment !== "local-pilot" ||
  config.testOnly !== true ||
  config.chainId !== 31338 ||
  config.swarm?.environment !== "local-bee" ||
  config.storageMode === "swarm-id"
) {
  throw Error(
    "Explicit local-pilot Anvil31338 and local Bee configuration required",
  );
}
const rpc = localUrl(config.rpcUrl);
localUrl(config.swarm.uploadUrl);
localUrl(config.swarm.downloadUrl);
for (const field of ["escrow", "token"]) {
  if (
    !/^0x[0-9a-fA-F]{40}$/.test(config[field]) ||
    BigInt(config[field]) === 0n
  )
    throw Error("Valid local escrow and token addresses required");
}
const chain = defineChain({
  id: 31338,
  name: "Review Pass local rehearsal",
  nativeCurrency: {
    name: "Test Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: { default: { http: [rpc] } },
});
const transport = () =>
  http(rpc, {
    retryCount: 0,
    timeout: 10000,
    fetchOptions: { redirect: "error" },
  });
const read = createPublicClient({ chain, transport: transport() });
async function chainGuard() {
  if ((await read.getChainId()) !== 31338)
    throw Error("Anvil31338 required; no public fallback");
  const version = await read.request({ method: "web3_clientVersion" });
  if (!/^anvil\//i.test(version)) throw Error("Anvil client required");
}
await chainGuard();
// This mnemonic is PUBLIC Anvil development material, not a project credential.
const account = mnemonicToAccount(
  "test test test test test test test test test test test junk",
  { addressIndex: 1 },
);
const wallet = createWalletClient({ account, chain, transport: transport() });
const escrowAbi = parseAbi([
  "function token() view returns (address)",
  "function nextJob() view returns (uint256)",
  "function jobs(uint256) view returns (address,address,uint256,uint256,uint64,uint64,uint64,uint8,bytes32,bytes32)",
  "function termsReferences(uint256) view returns (bytes32)",
  "function createJobWithDocument(uint256,uint256,uint64,uint64,uint64,bytes32,bytes32) returns (uint256)",
  "event JobFunded(uint256 indexed job,address indexed client,uint256 amount,uint256 qualificationClass)",
]);
const tokenAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function mint(address,uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const getEscrow = (functionName, args = []) =>
  read.readContract({
    address: config.escrow,
    abi: escrowAbi,
    functionName,
    args,
  });
const getToken = (functionName, args = []) =>
  read.readContract({
    address: config.token,
    abi: tokenAbi,
    functionName,
    args,
  });
if (
  (await getEscrow("token")).toLowerCase() !== config.token.toLowerCase() ||
  (await getToken("decimals")) !== 6 ||
  (await getToken("symbol")) !== "qUSD"
) {
  throw Error("Escrow must use the configured six-decimal local qUSD");
}
const provider = beeBytes({
  ...config.swarm,
  maxBytes: 20000,
  fetch: (url, options) => {
    localUrl(url);
    return fetch(url, { ...options, redirect: "error" });
  },
});
const journalPath = resolve(dir, "local-task-seed.json");
const lockPath = resolve(dir, "local-task-seed.lock");
async function seed() {
  let lock;
  try {
    if (writing) lock = await open(lockPath, "wx", 0o600);
    const now = Number((await read.getBlock()).timestamp);
    const count = await getEscrow("nextJob");
    if (count > 10000n)
      throw Error(
        "Local scan exceeds 10000 jobs; inspect rather than blindly fund",
      );
    // Reuse any live client1 task with a retrievable, matching public commitment.
    for (let id = count; id > 0n; id--) {
      const job = await getEscrow("jobs", [id]);
      if (
        job[0].toLowerCase() !== account.address.toLowerCase() ||
        job[7] !== 0 ||
        job[4] <= BigInt(now)
      )
        continue;
      const reference = (await getEscrow("termsReferences", [id])).slice(2);
      if (BigInt(`0x${reference}`) === 0n) continue;
      const bytes = await provider.download({ reference, sha256: job[8] });
      const encoded = encodeTerms(JSON.parse(new TextDecoder().decode(bytes)));
      if (
        encoded.digest.toLowerCase() !== job[8].toLowerCase() ||
        !matchTerms(encoded.terms, 31338, config.escrow, config.token, job)
      ) {
        throw Error(
          "Existing open task commitment mismatch; inspect before creating another",
        );
      }
      console.log(
        JSON.stringify(
          {
            mode: "local-rehearsal",
            status: "REUSED",
            writes: 0,
            job: id.toString(),
            client: account.address,
            title: encoded.terms.title,
            amount: job[2].toString(),
            token: "qUSD",
            acceptBefore: job[4].toString(),
            scope: { reference, sha256: job[8] },
            arkivListingCreated: false,
          },
          null,
          2,
        ),
      );
      return;
    }
    let previous;
    try {
      previous = JSON.parse(await readFile(journalPath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const sameDeployment =
      previous?.escrow?.toLowerCase() === config.escrow.toLowerCase();
    if (sameDeployment && previous.status !== "FUNDED") {
      throw Error(
        "Previous seed is incomplete; inspect its journal and receipts before retrying",
      );
    }
    if (sameDeployment && !args.includes("--new")) {
      throw Error(
        "Previous seed is no longer open. Use --seed --new explicitly for one replacement",
      );
    }
    if (!writing) {
      console.log(
        JSON.stringify(
          {
            mode: "local-rehearsal",
            status: "READY_TO_SEED",
            writes: 0,
            client: account.address,
            token: "qUSD",
            amount: "250000000",
            arkivListingCreated: false,
          },
          null,
          2,
        ),
      );
      return;
    }
    const encoded = encodeTerms({
      format: "review-pass-public-terms",
      version: 1,
      chainId: 31338,
      escrow: config.escrow,
      client: account.address,
      token: config.token,
      qualificationClass: "7",
      amount: "250000000",
      acceptBefore: now + 86400,
      submitBefore: now + 172800,
      reviewBefore: now + 259200,
      title: "Review the escrow approval path",
      scope:
        "LOCAL REHEARSAL — public, nonsensitive review scope. Inspect the approval and timeout payment paths in QualificationEscrow.sol at https://github.com/MihRazvan/eth-rome-2026/blob/aefe7a2/experiments/qualification/contracts/src/QualificationEscrow.sol . Deliver a short report describing who can release payment, what happens after the review deadline, and one concrete edge case with a reproduction or reason it is prevented. State your assumptions and severity. This is a bounded second review, not a security certification. The reward is 250 local qUSD with no monetary value.",
      policy: "approval-timeout-arbitration-v1",
    });
    const journal = {
      mode: "local-rehearsal",
      escrow: config.escrow,
      client: account.address,
      status: "PREPARED",
      createdAt: new Date().toISOString(),
      scope: null,
      transactions: [],
    };
    const save = () =>
      writeFile(journalPath, JSON.stringify(journal, null, 2) + "\n", {
        mode: 0o600,
      });
    await save();
    journal.scope = await provider.upload(encoded.bytes);
    await provider.download(journal.scope); // Verify a real independent local Bee round trip before funding.
    await save();
    async function send(address, abi, functionName, args) {
      await chainGuard();
      const hash = await wallet.writeContract({
        address,
        abi,
        functionName,
        args,
      });
      const entry = { action: functionName, hash, status: "PENDING" };
      journal.transactions.push(entry);
      await save();
      const receipt = await read.waitForTransactionReceipt({
        hash,
        timeout: 60000,
      });
      entry.status = receipt.status;
      entry.blockNumber = receipt.blockNumber.toString();
      await save();
      if (receipt.status !== "success")
        throw Error("Local seed transaction reverted; inspect journal");
      return receipt;
    }
    const amount = BigInt(encoded.terms.amount);
    const balance = await getToken("balanceOf", [account.address]);
    if (balance < amount)
      await send(config.token, tokenAbi, "mint", [
        account.address,
        amount - balance,
      ]);
    if (
      (await getToken("allowance", [account.address, config.escrow])) < amount
    )
      await send(config.token, tokenAbi, "approve", [config.escrow, amount]);
    const t = encoded.terms;
    const receipt = await send(
      config.escrow,
      escrowAbi,
      "createJobWithDocument",
      [
        amount,
        7n,
        BigInt(t.acceptBefore),
        BigInt(t.submitBefore),
        BigInt(t.reviewBefore),
        encoded.digest,
        `0x${journal.scope.reference}`,
      ],
    );
    const funded = parseEventLogs({
      abi: escrowAbi,
      logs: receipt.logs,
      eventName: "JobFunded",
    }).filter(
      (event) =>
        event.address.toLowerCase() === config.escrow.toLowerCase() &&
        event.args.client.toLowerCase() === account.address.toLowerCase(),
    );
    if (funded.length !== 1)
      throw Error("Expected one client funding event; inspect receipt");
    const id = funded[0].args.job;
    const actual = await getEscrow("jobs", [id]);
    if (
      !matchTerms(t, 31338, config.escrow, config.token, actual) ||
      actual[7] !== 0 ||
      actual[8].toLowerCase() !== encoded.digest.toLowerCase() ||
      (await getEscrow("termsReferences", [id])).toLowerCase() !==
        `0x${journal.scope.reference}`.toLowerCase()
    )
      throw Error("Funded task verification failed; inspect journal");
    journal.job = id.toString();
    journal.status = "FUNDED";
    await save();
    console.log(
      JSON.stringify(
        {
          ...journal,
          token: "qUSD",
          amount: amount.toString(),
          arkivListingCreated: false,
        },
        null,
        2,
      ),
    );
  } finally {
    if (lock) {
      await lock.close();
      await unlink(lockPath);
    }
  }
}
await seed();
