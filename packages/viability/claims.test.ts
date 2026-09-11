import { describe, expect, it } from "vitest";
import { inspectClaim, SOURCES, type ClaimSource } from "./claims";

const owner = "0x1111111111111111111111111111111111111111";
function provider(source: ClaimSource, changes: Record<string, unknown> = {}) {
  const calls: { functionName?: string; blockNumber?: bigint }[] = [];
  const returns: Record<string, unknown> = {
    getLastRequestId: 100n,
    nextRequestId: 101,
    getWithdrawalStatus: [
      {
        amountOfStETH: 1000n,
        amountOfShares: 900n,
        owner,
        timestamp: 1700000000n,
        isFinalized: false,
        isClaimed: false,
      },
    ],
    getRequest: {
      amountOfEEth: 1000n,
      shareOfEEth: 900n,
      isValid: true,
      feeGwei: 2,
    },
    ownerOf: owner,
    isFinalized: false,
    getLastCheckpointIndex: 20n,
    findCheckpointHints: [19n],
    getClaimableEther: [950n],
    getClaimableAmount: 940n,
    ...changes,
  };
  const client = {
    getChainId: async () => 1,
    getBlock: async () => ({ number: 25956536n, timestamp: 1789158323n }),
    getStorageAt: async (args: { blockNumber: bigint }) => {
      calls.push(args);
      return `0x${"0".repeat(24)}${SOURCES[source].implementation.slice(2)}`;
    },
    readContract: async (args: {
      functionName: string;
      blockNumber: bigint;
    }) => {
      calls.push(args);
      if (!(args.functionName in returns)) throw new Error("Unexpected read");
      return returns[args.functionName];
    },
  } as unknown as NonNullable<Parameters<typeof inspectClaim>[2]>;
  return { client, calls, returns };
}

describe("read-only native withdrawal inspection", () => {
  it("pins every source read and reports age separately from unknown payout/ETA", async () => {
    const p = provider("lido");
    const r = await inspectClaim("lido", "001", p.client);
    expect(r).toMatchObject({
      id: "1",
      owner,
      status: "pending",
      requestedWei: "1000",
      claimableWei: null,
      implementationMatchesReview: true,
    });
    expect(r.requestTimestamp).toBe("2023-11-14T22:13:20.000Z");
    expect(p.calls.every((c) => c.blockNumber === 25956536n)).toBe(true);
    expect(p.calls.some((c) => c.functionName === "getClaimableEther")).toBe(
      false,
    );
  });
  it("reads the finalized amount instead of declaring original face guaranteed", async () => {
    const p = provider("lido");
    (
      p.returns.getWithdrawalStatus as { isFinalized: boolean }[]
    )[0].isFinalized = true;
    const r = await inspectClaim("lido", "1", p.client);
    expect(r).toMatchObject({
      status: "finalized",
      requestedWei: "1000",
      claimableWei: "950",
    });
    expect(p.calls.every((c) => c.blockNumber === 25956536n)).toBe(true);
  });
  it("does not report the historical request owner as current after claiming", async () => {
    const p = provider("lido");
    (p.returns.getWithdrawalStatus as { isClaimed: boolean }[])[0].isClaimed =
      true;
    expect(await inspectClaim("lido", "1", p.client)).toMatchObject({
      owner: null,
      status: "claimed",
      claimableWei: null,
    });
  });
  it("does not fabricate ether.fi request time or hide its stored fee", async () => {
    const p = provider("etherfi");
    expect(await inspectClaim("etherfi", "1", p.client)).toMatchObject({
      status: "pending",
      claimableWei: null,
      requestTimestamp: null,
      legacyStoredFeeWei: "2000000000",
    });
    expect(p.calls.some((c) => c.functionName === "getClaimableAmount")).toBe(
      false,
    );
  });
  it("reports finalization without certifying an executable ether.fi collection", async () => {
    const p = provider("etherfi", { isFinalized: true });
    expect(await inspectClaim("etherfi", "1", p.client)).toMatchObject({
      status: "finalized", claimableWei: "940", collectionExecution: "not-simulated",
      legacyStoredFeeWei: "2000000000",
    });
    // The read interface cannot establish blacklist, escrow or recipient callback eligibility.
    expect(p.calls.some((c) => c.functionName === "claimWithdraw")).toBe(false);
  });
  it("keeps invalid and deleted requests out of collectible claims", async () => {
    const p = provider("etherfi", { isFinalized: true });
    (p.returns.getRequest as { isValid: boolean }).isValid = false;
    expect(await inspectClaim("etherfi", "1", p.client)).toMatchObject({
      status: "invalid",
      claimableWei: null,
    });
    (p.returns.getRequest as { amountOfEEth: bigint }).amountOfEEth = 0n;
    expect(await inspectClaim("etherfi", "1", p.client)).toMatchObject({
      status: "closed",
      owner: null,
      claimableWei: null,
    });
  });
  it("a new implementation is visibly outside the inspected revision", async () => {
    const p = provider("lido");
    p.client.getStorageAt = async () => `0x${"0".repeat(24)}${"2".repeat(40)}`;
    expect(
      (await inspectClaim("lido", "1", p.client)).implementationMatchesReview,
    ).toBe(false);
  });
  it("rejects malformed, nonexistent or wrong-chain inputs before constructing a position", async () => {
    const p = provider("lido");
    for (const id of ["0", "-1", "1.0", (2n ** 256n).toString()])
      await expect(inspectClaim("lido", id, p.client)).rejects.toThrow(
        "positive",
      );
    await expect(inspectClaim("lido", "101", p.client)).rejects.toThrow(
      "not been issued",
    );
    p.client.getChainId = async () => 43113;
    await expect(inspectClaim("lido", "1", p.client)).rejects.toThrow(
      "not Ethereum",
    );
  });
});
