import { createPublicClient, http, parseAbi, type Address } from "viem";
import { mainnet } from "viem/chains";

export type ClaimSource = "lido" | "etherfi";
export const SOURCES = {
  lido: {
    name: "Lido unstETH",
    address: "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1" as Address,
    implementation: "0xe42c659dc09109566720ea8b2de186c2be7d94d9" as Address,
    docs: "https://docs.lido.fi/contracts/withdrawal-queue-erc721/",
    app: "https://stake.lido.fi/withdrawals/claim",
  },
  etherfi: {
    name: "ether.fi withdrawal NFT",
    address: "0x7d5706f6ef3F89B3951E23e557CDFBC3239D4E2c" as Address,
    implementation: "0x41617D01362770ebAAC10311aB899FBc8a4E4A7E" as Address,
    docs: "https://www.ether.fi/blog/safe-staking-from-doctrine-to-code",
    app: "https://app.ether.fi/",
  },
} as const;

export const lidoReadAbi = parseAbi([
  "function getLastRequestId() view returns (uint256)",
  "function getWithdrawalStatus(uint256[] ids) view returns ((uint256 amountOfStETH,uint256 amountOfShares,address owner,uint256 timestamp,bool isFinalized,bool isClaimed)[])",
  "function getLastCheckpointIndex() view returns (uint256)",
  "function findCheckpointHints(uint256[] ids,uint256 first,uint256 last) view returns (uint256[])",
  "function getClaimableEther(uint256[] ids,uint256[] hints) view returns (uint256[])",
]);
export const etherfiReadAbi = parseAbi([
  "function nextRequestId() view returns (uint32)",
  "function getRequest(uint256 id) view returns ((uint96 amountOfEEth,uint96 shareOfEEth,bool isValid,uint32 feeGwei))",
  "function ownerOf(uint256 id) view returns (address)",
  "function isFinalized(uint256 id) view returns (bool)",
  "function getClaimableAmount(uint256 id) view returns (uint256)",
]);

const implementationSlot =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;
export const CLAIM_REVIEW_BLOCK = "25956536";

export interface ClaimObservation {
  source: ClaimSource;
  sourceName: string;
  chainId: 1;
  contract: Address;
  implementation: Address;
  implementationMatchesReview: boolean;
  id: string;
  blockNumber: string;
  blockTimestamp: string;
  observedAt: string;
  owner: Address | null;
  status: "pending" | "finalized" | "claimed" | "closed" | "invalid";
  requestedWei: string;
  /** Source amount getter at the observed block; payout execution is not simulated. */
  claimableWei: string | null;
  requestTimestamp: string | null;
  /** Historical field; reviewed ether.fi implementation does not charge it. */
  legacyStoredFeeWei: string | null;
  collectionExecution: "not-simulated";
  currency: "ETH";
  decimals: 18;
}

export const ethereumReadClient = () =>
  createPublicClient({
    chain: mainnet,
    transport: http("https://ethereum-rpc.publicnode.com", {
      timeout: 15_000,
      retryCount: 1,
    }),
  });

type ReadClient = Pick<
  ReturnType<typeof ethereumReadClient>,
  "getChainId" | "getBlock" | "getStorageAt" | "readContract"
>;

export async function inspectClaim(
  source: ClaimSource,
  inputId: string,
  client: ReadClient = ethereumReadClient(),
  atBlock?: bigint,
): Promise<ClaimObservation> {
  if (
    !/^\d{1,78}$/.test(inputId) ||
    BigInt(inputId) === 0n ||
    BigInt(inputId) >= 2n ** 256n
  )
    throw new Error("Enter a positive withdrawal NFT ID.");
  const sourceConfig = SOURCES[source];
  if (!sourceConfig) throw new Error("Unsupported withdrawal source.");
  if ((await client.getChainId()) !== 1)
    throw new Error("The read provider is not Ethereum mainnet.");
  const block = await client.getBlock(
    atBlock === undefined ? {} : { blockNumber: atBlock },
  );
  const blockNumber = block.number;
  if (blockNumber === null) throw new Error("A confirmed block is required.");
  const stored = await client.getStorageAt({
    address: sourceConfig.address,
    slot: implementationSlot,
    blockNumber,
  });
  if (!stored || stored.length !== 66 || BigInt(stored) === 0n)
    throw new Error("Source implementation could not be identified.");
  const implementation = `0x${stored.slice(-40)}` as Address;
  const common = {
    source,
    sourceName: sourceConfig.name,
    chainId: 1 as const,
    contract: sourceConfig.address,
    implementation,
    implementationMatchesReview:
      implementation.toLowerCase() ===
      sourceConfig.implementation.toLowerCase(),
    id: BigInt(inputId).toString(),
    blockNumber: blockNumber.toString(),
    blockTimestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
    observedAt: new Date().toISOString(),
    collectionExecution: "not-simulated" as const,
    currency: "ETH" as const,
    decimals: 18 as const,
  };
  const id = BigInt(inputId);
  if (source === "lido") {
    const bound = await client.readContract({
      address: sourceConfig.address,
      abi: lidoReadAbi,
      functionName: "getLastRequestId",
      blockNumber,
    });
    if (id > bound)
      throw new Error("This withdrawal NFT ID has not been issued.");
    const [request] = await client.readContract({
      address: sourceConfig.address,
      abi: lidoReadAbi,
      functionName: "getWithdrawalStatus",
      args: [[id]],
      blockNumber,
    });
    let claimableWei: string | null = null;
    if (request.isFinalized && !request.isClaimed) {
      const last = await client.readContract({
        address: sourceConfig.address,
        abi: lidoReadAbi,
        functionName: "getLastCheckpointIndex",
        blockNumber,
      });
      const hints = await client.readContract({
        address: sourceConfig.address,
        abi: lidoReadAbi,
        functionName: "findCheckpointHints",
        args: [[id], 1n, last],
        blockNumber,
      });
      const amounts = await client.readContract({
        address: sourceConfig.address,
        abi: lidoReadAbi,
        functionName: "getClaimableEther",
        args: [[id], hints],
        blockNumber,
      });
      claimableWei = amounts[0].toString();
    }
    return {
      ...common,
      owner: request.isClaimed ? null : request.owner,
      status: request.isClaimed
        ? "claimed"
        : request.isFinalized
          ? "finalized"
          : "pending",
      requestedWei: request.amountOfStETH.toString(),
      claimableWei,
      requestTimestamp: new Date(
        Number(request.timestamp) * 1000,
      ).toISOString(),
      legacyStoredFeeWei: null,
    };
  }
  const next = await client.readContract({
    address: sourceConfig.address,
    abi: etherfiReadAbi,
    functionName: "nextRequestId",
    blockNumber,
  });
  if (id >= BigInt(next))
    throw new Error("This withdrawal NFT ID has not been issued.");
  const request = await client.readContract({
    address: sourceConfig.address,
    abi: etherfiReadAbi,
    functionName: "getRequest",
    args: [id],
    blockNumber,
  });
  if (request.amountOfEEth === 0n) {
    // A deleted record establishes no remaining request, not payment or its recipient.
    return {
      ...common,
      owner: null,
      status: "closed",
      requestedWei: "0",
      claimableWei: null,
      requestTimestamp: null,
      legacyStoredFeeWei: null,
    };
  }
  const owner = await client.readContract({
    address: sourceConfig.address,
    abi: etherfiReadAbi,
    functionName: "ownerOf",
    args: [id],
    blockNumber,
  });
  const finalized = await client.readContract({
    address: sourceConfig.address,
    abi: etherfiReadAbi,
    functionName: "isFinalized",
    args: [id],
    blockNumber,
  });
  const claimable =
    request.isValid && finalized
      ? await client.readContract({
          address: sourceConfig.address,
          abi: etherfiReadAbi,
          functionName: "getClaimableAmount",
          args: [id],
          blockNumber,
        })
      : null;
  return {
    ...common,
    owner,
    status: !request.isValid ? "invalid" : finalized ? "finalized" : "pending",
    requestedWei: request.amountOfEEth.toString(),
    claimableWei: claimable === null ? null : claimable.toString(),
    requestTimestamp: null,
    legacyStoredFeeWei: (BigInt(request.feeGwei) * 1_000_000_000n).toString(),
  };
}
