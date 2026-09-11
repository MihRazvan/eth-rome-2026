import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import {
  createTestClient,
  http,
  parseUnits,
  zeroAddress,
  zeroHash,
  keccak256,
  toHex,
  maxUint256,
} from "viem";
import {
  loadDeployment,
  publicFor,
  walletFor,
  chainFor,
} from "../packages/runtime/chain";
import { ExitMarketAbi as abi } from "../packages/shared/ExitMarket";
import { TestUSDCAbi } from "../packages/shared/TestUSDC";
import { quoteTypedData, type SignedQuote } from "../packages/shared/quote";
const d = await loadDeployment(),
  client = publicFor(d),
  seller = walletFor(d, 0),
  a = walletFor(d, 1),
  b = walletFor(d, 2);
const txs: { step: string; hash: string }[] = [];
const U = (n: string) => parseUnits(n, 6);
const write = async (
  w: typeof seller,
  address: typeof d.market,
  contractAbi: any,
  name: string,
  args: unknown[],
  step: string,
) => {
  const hash = await w.writeContract({
    address,
    abi: contractAbi,
    functionName: name,
    args,
  });
  const r = await client.waitForTransactionReceipt({ hash });
  assert.equal(r.status, "success");
  txs.push({ step, hash });
};
async function advance(seconds: number) {
  if (d.environment === "local") {
    const test = createTestClient({
      chain: chainFor(d),
      mode: "anvil",
      transport: http(d.rpcUrl),
    });
    await test.increaseTime({ seconds });
    await test.mine({ blocks: 1 });
  } else {
    console.log(`Waiting ${seconds}s for actual Fuji installment schedule`);
    await new Promise((r) => setTimeout(r, seconds * 1000));
  }
}
async function quote(
  w: typeof a,
  id: bigint,
  net: string,
  sellerAddress: typeof d.market,
): Promise<SignedQuote> {
  const p = await client.readContract({
    address: d.market,
    abi,
    functionName: "positions",
    args: [id],
  });
  const q = {
    maker: w.account.address,
    seller: sellerAddress,
    buyer: w.account.address,
    claimId: id,
    source: d.source,
    sourceVersion: 1n,
    paymentToken: d.token,
    netPayment: U(net),
    feeAmount: 0n,
    feeRecipient: zeroAddress,
    ownershipEpoch: p[2],
    depletion: p[3],
    deadline: (await client.getBlock()).timestamp + 600n,
    nonce: keccak256(toHex(`${id}:${net}:${crypto.randomUUID()}`)),
    underwritingHash: zeroHash,
  };
  return {
    quote: q,
    signature: await w.signTypedData(quoteTypedData(q, d.chainId, d.market)),
  };
}
const balance = (address: typeof d.market) =>
  client.readContract({
    address: d.token,
    abi: TestUSDCAbi,
    functionName: "balanceOf",
    args: [address],
  });
const evidence = [];
for (const adverse of [false, true]) {
  for (const w of [seller, a, b]) {
    await write(
      w,
      d.token,
      TestUSDCAbi,
      "faucet",
      [],
      "fund separate demo account",
    );
    await write(
      w,
      d.token,
      TestUSDCAbi,
      "approve",
      [d.market, maxUint256],
      "authorize own capital",
    );
  }
  const id = await client.readContract({
    address: d.market,
    abi,
    functionName: "nextClaimId",
  });
  await write(
    seller,
    d.market,
    abi,
    "originate",
    [U("10000"), adverse],
    "originate backed claim",
  );
  const beforeSeller = await balance(seller.account.address),
    beforeA = await balance(a.account.address),
    beforeB = await balance(b.account.address);
  const full = await quote(a, id, "9960", seller.account.address);
  await write(
    seller,
    d.market,
    abi,
    "accept",
    [full.quote, full.signature],
    "sell for 9960",
  );
  assert.equal(
    (await balance(seller.account.address)) - beforeSeller,
    U("9960"),
  );
  const stale = await quote(b, id, "9990", a.account.address);
  await advance(61);
  await write(a, d.market, abi, "collect", [id], "collect first installment");
  await write(a, d.market, abi, "withdraw", [id, U("4000")], "withdraw 4000");
  await assert.rejects(
    () =>
      client.simulateContract({
        address: d.market,
        abi,
        functionName: "accept",
        args: [stale.quote, stale.signature],
        account: a.account.address,
      }),
    /StaleQuote/,
  );
  const residual = await quote(b, id, "5985", a.account.address);
  await write(
    a,
    d.market,
    abi,
    "accept",
    [residual.quote, residual.signature],
    "resell residual for 5985",
  );
  await advance(61);
  await write(b, d.market, abi, "collect", [id], "collect final installment");
  const final = adverse ? "5700" : "6000";
  await write(
    b,
    d.market,
    abi,
    "withdraw",
    [id, U(final)],
    `withdraw final ${final}`,
  );
  const p = await client.readContract({
    address: d.market,
    abi,
    functionName: "positions",
    args: [id],
  });
  assert.equal(p[0].toLowerCase(), b.account.address.toLowerCase());
  assert.equal(p[4], 0n);
  assert.equal((await balance(a.account.address)) - beforeA, U("25"));
  assert.equal(
    (await balance(b.account.address)) - beforeB,
    U(adverse ? "-285" : "15"),
  );
  evidence.push({
    adverse,
    claimId: String(id),
    sellerNet: "9960",
    firstWithdrawal: "4000",
    staleQuoteRejected: true,
    resaleNet: "5985",
    finalWithdrawal: final,
    makerAGrossResult: "25",
    makerBGrossResult: adverse ? "-285" : "15",
    finalOwner: p[0],
    standardCash: String(p[4]),
    ownerRetainedForRecovery: true,
  });
}
await mkdir("docs/evidence", { recursive: true });
const path = `docs/evidence/${d.environment}-lifecycle.json`;
await writeFile(
  path,
  JSON.stringify(
    {
      observedAt: new Date().toISOString(),
      environment: d.environment,
      chainId: d.chainId,
      market: d.market,
      timeTechnique:
        d.environment === "local"
          ? "Anvil time advancement; not a live protocol accelerator"
          : "Actual elapsed network time",
      evidence,
      transactions: txs,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ path, evidence }, null, 2));
