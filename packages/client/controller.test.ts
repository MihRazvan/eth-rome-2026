import { describe, it, expect, vi } from "vitest";
import { encodeFunctionData, parseAbi } from "viem";
import { ExitController } from "./controller";
const owner = "0x1111111111111111111111111111111111111111",
  target = "0x2222222222222222222222222222222222222222";
const hash = `0x${"a".repeat(64)}`,
  abi = parseAbi(["function act()"]);
function controller(
  reason?: "cancelled" | "replaced" | "repriced",
  changed = false,
  refreshFails = false,
) {
  const c = new ExitController(() => {}) as any;
  c.config = { chainId: 31337 };
  c.address = owner;
  c.wallet = {
    account: owner,
    getChainId: async () => 31337,
    getAddresses: async () => [owner],
    writeContract: async () => hash,
  };
  c.refresh = vi.fn(async () => {
    if (refreshFails) throw new Error("Discovery down");
  });
  Object.defineProperty(c, "client", {
    get: () => ({
      simulateContract: async () => ({ request: {} }),
      waitForTransactionReceipt: async (o: any) => {
        if (reason) o.onReplaced({ reason });
        return { status: "success", transactionHash: hash };
      },
      getTransaction: async () => ({
        to: changed ? owner : target,
        input: encodeFunctionData({ abi, functionName: "act" }),
        value: 0n,
      }),
    }),
  });
  return c;
}
describe("transaction outcome recovery regressions", () => {
  it("never reports a cancelled transaction as settlement", async () => {
    await expect(
      controller("cancelled").transaction(target, abi, "act"),
    ).rejects.toThrow("cancelled");
  });
  it("rejects a replacement that changes the target", async () => {
    await expect(
      controller("replaced", true).transaction(target, abi, "act"),
    ).rejects.toThrow("changed");
  });
  it("recognizes identical repricing after verifying actual calldata", async () => {
    await expect(
      controller("repriced").transaction(target, abi, "act"),
    ).resolves.toMatchObject({
      status: "replaced",
      hash,
      message: "Confirmed onchain",
    });
  });
  it("preserves a confirmed transaction if subsequent discovery fails", async () => {
    await expect(
      controller(undefined, false, true).transaction(target, abi, "act"),
    ).resolves.toMatchObject({ status: "confirmed", hash });
  });
  it("rejects changed wallet accounts before simulation or signing", async () => {
    const c = controller();
    c.wallet.getAddresses = async () => [target];
    await expect(c.transaction(target, abi, "act")).rejects.toThrow(
      "Wallet account changed",
    );
  });
});
