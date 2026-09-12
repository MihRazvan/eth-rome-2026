/** Read-only by default. --write-testnet enables only configured testnet writes; --local-bee is explicitly local. */
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { createPublicClient as createArkivClient } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { beeBytes, type SnapshotRef } from "./bytes";
import { encryptJobDocument, decryptJobDocument } from "./cipher";
import { arkivStatusIndex } from "./arkiv";
if (
  process.argv.includes("--local-bee") &&
  process.argv.includes("--write-testnet")
)
  throw Error("Choose local Bee or public testnet writes explicitly, not both");
const encoder = new TextEncoder(),
  start = Date.now();
const result: Record<string, unknown> = {
  observedAt: new Date().toISOString(),
  syntheticTransportProbe: true,
  proverCommitmentChecked: false,
  fixtureFallback: false,
};
async function check(name: string, run: () => Promise<unknown>) {
  try {
    result[name] = await run();
  } catch {
    result[name] = {
      status: "failed",
      reason: "Operation failed; raw provider error omitted",
    };
  }
}
const read = createArkivClient({
  chain: tiramisu,
  transport: http(process.env.ARKIV_RPC_URL, { timeout: 12000, retryCount: 0 }),
});
await check("arkivRead", async () => {
  const chainId = await read.getChainId();
  if (chainId !== tiramisu.id) throw Error();
  const page = await read
    .select({ key: true })
    .where(
      eq("application", "qualification-experiment"),
      eq("kind", "issuer-status"),
    )
    .limit(100)
    .fetch();
  return {
    status: "passed",
    chainId,
    block: (await read.getBlockNumber()).toString(),
    firstPageCount: page.entities.length,
    morePages: page.hasNextPage(),
  };
});
await check("arkivSocket", async () => {
  let notifications = 0,
    errors = 0;
  const t = Date.now();
  const index = arkivStatusIndex({});
  const stop = index.watch(
    () => notifications++,
    () => errors++,
  );
  await new Promise((r) => setTimeout(r, 10000));
  stop();
  return {
    status: errors ? "failed" : "observed",
    elapsedMs: Date.now() - t,
    notifications,
    errors,
    transport: "webSocket",
    fromBlock: false,
  };
});
await check("fuji", async () => {
  const rpc = createPublicClient({
    transport: http(
      process.env.FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc",
      { timeout: 12000, retryCount: 0 },
    ),
  });
  const chainId = await rpc.getChainId();
  if (chainId !== 43113) throw Error();
  const key = process.env.FUJI_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
  if (!key)
    return {
      chainId,
      block: (await rpc.getBlockNumber()).toString(),
      deployment: "blocked",
      reason: "Project funded Fuji signer not configured",
    };
  if (!/^0x[0-9a-fA-F]{64}$/.test(key))
    return { chainId, deployment: "blocked", reason: "Invalid signer syntax" };
  const account = privateKeyToAccount(key as `0x${string}`),
    balance = await rpc.getBalance({ address: account.address });
  return {
    chainId,
    nativeBalanceWei: balance.toString(),
    deployment: balance > 0n ? "unverified" : "blocked",
    reason:
      "Balance is not evidence of sufficient deployment gas; no deployment attempted",
  };
});
await check("faucetGate", async () => {
  const r = await fetch("https://hub.arkiv.network/api/faucet", {
    signal: AbortSignal.timeout(12000),
  });
  return { anonymousHttpStatus: r.status, claimAttempted: false };
});
const local = process.argv.includes("--local-bee"),
  writes = process.argv.includes("--write-testnet");
const uploadUrl = process.env.SWARM_UPLOAD_URL,
  downloadUrl = process.env.SWARM_RETRIEVAL_URL ?? uploadUrl,
  batch = process.env.SWARM_POSTAGE_BATCH_ID;
let stored: SnapshotRef | undefined;
if ((local || writes) && uploadUrl && downloadUrl && batch)
  await check("swarmRoundTrip", async () => {
    const provider = beeBytes({
      environment: local ? "local-bee" : "public-swarm",
      uploadUrl,
      downloadUrl,
      postageBatchId: batch,
    });
    const publicBytes = encoder.encode(
      JSON.stringify({
        schema: "transport-only-whole-issuer-snapshot",
        issuerId: "qualification-probe",
        root: "1",
        revokedIndices: [3, 8],
        authoritative: false,
      }),
    );
    const snapshot = await provider.upload(publicBytes);
    const downloaded = await provider.download(snapshot);
    if (downloaded.length !== publicBytes.length) throw Error();
    const context = {
      chainId: 43113,
      contract: `0x${"11".repeat(20)}`,
      jobId: "1",
      version: 1 as const,
    };
    const privateBytes = encoder.encode(
      "Synthetic confidential qualification job document",
    );
    const encrypted = await encryptJobDocument(privateBytes, context);
    const doc = await provider.upload(encrypted.envelope);
    const ciphertext = await provider.download(doc);
    const decrypted = await decryptJobDocument(
      ciphertext,
      encrypted.key,
      context,
    );
    if (
      new TextDecoder().decode(decrypted) !==
      new TextDecoder().decode(privateBytes)
    )
      throw Error();
    stored = {
      issuerId: `transport-probe-${crypto.randomUUID()}`,
      epoch: 1,
      root: "1",
      authority: context.contract as `0x${string}`,
      chainId: 43113,
      ...snapshot,
    };
    return {
      status: "passed",
      environment: provider.environment,
      publicSnapshot: snapshot,
      encryptedJob: doc,
      wholeSnapshotBytes: downloaded.length,
      ciphertextBytes: ciphertext.length,
      privatePlaintextBytes: privateBytes.length,
      keyUploaded: false,
      commitmentVerified: false,
    };
  });
else
  result.swarmRoundTrip = {
    status: "blocked",
    reason:
      "Explicit write mode plus configured upload/retrieval endpoint and funded postage required; event gift flow needs owner authentication/redemption",
  };
const key = process.env.ARKIV_PRIVATE_KEY;
if (writes && key && stored)
  await check("arkivNativeExpiry", async () => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw Error();
    const account = privateKeyToAccount(key as `0x${string}`);
    if ((await read.getBalance({ address: account.address })) === 0n)
      return { status: "blocked", reason: "Arkiv signer has no test GLM" };
    const index = arkivStatusIndex({
      rpcUrl: process.env.ARKIV_RPC_URL,
      account,
    });
    const t = Date.now();
    const created = await index.publish(stored!, 12);
    const before = await index.discover(stored!);
    if (!before.some((v) => v.reference === stored!.reference)) throw Error();
    let block = await read.getBlockNumber();
    while (block <= created.expiresAt && Date.now() - t < 60000) {
      await new Promise((r) => setTimeout(r, 2000));
      block = await read.getBlockNumber();
    }
    const after = await index.discover(stored!);
    return {
      status:
        block > created.expiresAt &&
        !after.some((v) => v.reference === stored!.reference)
          ? "passed"
          : "failed",
      entityKey: created.entityKey,
      txHash: created.txHash,
      expiresAtBlock: created.expiresAt.toString(),
      observedBlock: block.toString(),
      beforeCount: before.length,
      afterCount: after.length,
      deleteCalled: false,
      elapsedMs: Date.now() - t,
    };
  });
else
  result.arkivNativeExpiry = {
    status: "blocked",
    reason:
      "Funded Arkiv signer and genuine stored snapshot required; no create/expiry write attempted",
  };
result.elapsedMs = Date.now() - start;
console.log(JSON.stringify(result, null, 2));
process.exit(0);
