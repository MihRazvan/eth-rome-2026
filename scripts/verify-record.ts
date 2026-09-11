import { readFile } from "node:fs/promises";
import { createPublicClient, http } from "viem";
import { loadDeployment, chainFor } from "../packages/runtime/chain";
import {
  SwarmBytes,
  purchaseQuoteCodec,
  verifyStoredOffer,
  type OfferRecord,
} from "../packages/transport";
import { ExitMarketAbi } from "../packages/shared/ExitMarket";
const file = process.argv[2];
if (!file)
  throw new Error(
    "Usage: npm run verify:record -- path/to/public-offer-record.json",
  );
const record = JSON.parse(await readFile(file, "utf8")) as OfferRecord;
if (record.mode !== "public")
  throw new Error(
    "Private records must be decrypted in the seller client; do not export private keys to this verifier",
  );
const d = await loadDeployment(),
  client = createPublicClient({
    chain: chainFor(d),
    transport: http(d.rpcUrl),
  });
if (d.environment !== "fuji")
  throw new Error(
    "Independent Swarm verifier requires Fuji manifest; local-byte tests are separate",
  );
const claimId = BigInt(process.argv[3] ?? "0");
const storage = new SwarmBytes({
  uploadUrl: "",
  retrievalUrl:
    process.env.SWARM_VERIFIER_URL ??
    process.env.SWARM_RETRIEVAL_URL ??
    "https://api.gateway.ethswarm.org",
});
const signed = await verifyStoredOffer(
  record,
  record,
  purchaseQuoteCodec({ claimId, source: d.source, sourceVersion: 1n }, client),
  storage,
);
const p = await client.readContract({
  address: d.market,
  abi: ExitMarketAbi,
  functionName: "positions",
  args: [claimId],
});
console.log(
  JSON.stringify(
    {
      verifiedSignature: true,
      independentlyRetrieved: true,
      reference: record.reference,
      source: d.source,
      chain: d.chainId,
      ownershipMatches:
        p[0].toLowerCase() === signed.quote.seller.toLowerCase(),
      epochMatches: p[2] === signed.quote.ownershipEpoch,
      depletionMatches: p[3] === signed.quote.depletion,
      deadline: String(signed.quote.deadline),
      note: "Signature/discovery never guarantees funding or execution. Simulate acceptance at current chain state.",
    },
    null,
    2,
  ),
);
