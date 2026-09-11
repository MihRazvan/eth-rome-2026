/** Live network probe. Does not create fixtures and never prints credentials or returned payloads. */
import { createPublicClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { type OfferRecord } from "../packages/transport/arkiv";
import { proveNativeOfferExpiry } from "../packages/transport/expiry";
import { readFile } from "node:fs/promises";
import { SwarmBytes } from "../packages/transport/swarm";
const output: Record<string, unknown> = {
  observedAt: new Date().toISOString(),
  fixtureFallback: false,
};
const rpcUrl = process.env.ARKIV_RPC_URL ?? tiramisu.rpcUrls.default.http[0];
async function probe(name: string, run: () => Promise<unknown>) {
  try {
    output[name] = await run();
  } catch (error) {
    // Provider errors can echo URLs with credentials or request payloads; output only a class.
    output[name] = {
      status: "failed",
      errorClass: error instanceof Error ? error.name : "Error",
    };
  }
}
await probe("arkivRead", async () => {
  const client = createPublicClient({
    chain: tiramisu,
    transport: http(rpcUrl, { timeout: 12000, retryCount: 0 }),
  });
  const chainId = await client.getChainId();
  const block = await client.getBlockNumber();
  const page = await client
    .select({ key: true })
    .where(eq("app", "exit"), eq("kind", "offer"))
    .limit(10)
    .fetch();
  return {
    status: "passed",
    chainId,
    block: block.toString(),
    entityCountFirstPage: page.entities.length,
    hasNextPage: page.hasNextPage(),
  };
});
await probe("eventBrief", async () => {
  const response = await fetch("https://hub.arkiv.network/ethrome", {
    signal: AbortSignal.timeout(12000),
  });
  return {
    status: response.ok ? "reachable" : "failed",
    httpStatus: response.status,
  };
});
await probe("swarmGateway", async () => {
  const response = await fetch(
    `${(process.env.SWARM_RETRIEVAL_URL ?? "https://api.gateway.ethswarm.org").replace(/\/$/, "")}/health`,
    { signal: AbortSignal.timeout(12000) },
  );
  return {
    status: response.ok ? "reachable-read-only" : "failed",
    httpStatus: response.status,
  };
});
const postage = process.env.SWARM_POSTAGE_BATCH_ID;
const uploadUrl = process.env.SWARM_UPLOAD_URL;
if (!postage || !uploadUrl)
  output.swarmWrite = {
    status: "blocked",
    reason:
      "SWARM_UPLOAD_URL and funded SWARM_POSTAGE_BATCH_ID not configured; event gift-code redemption or own funded Bee required.",
  };
else
  await probe("swarmWrite", async () => {
    const transport = new SwarmBytes({
      uploadUrl,
      retrievalUrl: process.env.SWARM_RETRIEVAL_URL ?? uploadUrl,
      postageBatchId: postage,
    });
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        application: "EXIT",
        type: "connectivity-probe",
        createdAt: new Date().toISOString(),
      }),
    );
    const record = await transport.upload(bytes);
    const retrieved = await transport.retrieve(record);
    return {
      status: "passed",
      ...record,
      bytes: retrieved.length,
      usefulSignedOfferEvidence: false,
    };
  });
const privateKey = process.env.ARKIV_PRIVATE_KEY;
if (!privateKey)
  output.arkivWrite = {
    status: "blocked",
    reason:
      "ARKIV_PRIVATE_KEY not configured; funded testnet signing account required. Native expiry experiment not run.",
  };
else if (!process.env.ARKIV_EXPIRY_RECORD_PATH)
  output.arkivWrite = {
    status: "blocked",
    reason:
      "ARKIV_EXPIRY_RECORD_PATH required: a real stored offer record JSON from application publication.",
  };
else
  await probe("arkivWrite", async () =>
    proveNativeOfferExpiry({
      rpcUrl,
      account: privateKeyToAccount(privateKey as `0x${string}`),
      record: JSON.parse(
        await readFile(process.env.ARKIV_EXPIRY_RECORD_PATH!, "utf8"),
      ) as OfferRecord,
      progress: (event) => console.log(JSON.stringify(event)),
    }),
  );
console.log(JSON.stringify(output, null, 2));
