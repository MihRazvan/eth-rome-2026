import { inspectClaim, type ClaimSource } from "../packages/viability/claims";

const [source, id, block] = process.argv.slice(2);
if (
  (source !== "lido" && source !== "etherfi") ||
  !id ||
  (block && !/^\d+$/.test(block))
) {
  console.error(
    "Usage: npm run inspect:claim -- lido|etherfi NFT_ID [BLOCK_NUMBER]",
  );
  process.exitCode = 1;
} else {
  try {
    const result = await inspectClaim(
      source as ClaimSource,
      id,
      undefined,
      block ? BigInt(block) : undefined,
    );
    console.log(JSON.stringify(result, null, 2));
  } catch {
    console.error(
      "Claim inspection failed. Check the source, NFT ID and read-provider availability. No transaction was sent.",
    );
    process.exitCode = 1;
  }
}
