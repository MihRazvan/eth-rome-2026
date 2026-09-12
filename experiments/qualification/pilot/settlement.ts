import type { Hash, TransactionReceipt } from "viem";

export type SettlementPolicy =
  | { mode: "fuji-finalized"; chainId: 43113 }
  | { mode: "local-receipt"; chainId: 31338 };
type Receipt = TransactionReceipt;
type Block = { number: bigint | null; hash: Hash | null };
type Replacement = {
  reason: "repriced" | "replaced" | "cancelled";
  transactionReceipt: Receipt;
};
export type SettlementClient = {
  getChainId(): Promise<number>;
  waitForTransactionReceipt(args: {
    hash: Hash;
    timeout: number;
    confirmations: number;
    onReplaced: (replacement: Replacement) => void;
  }): Promise<Receipt>;
  getTransactionReceipt(args: { hash: Hash }): Promise<Receipt>;
  getBlock(
    args: { blockTag: "finalized" } | { blockNumber: bigint },
  ): Promise<Block>;
};
export class SettlementError extends Error {
  readonly code:
    | "ABORTED"
    | "TIMEOUT"
    | "WRONG_CHAIN"
    | "REVERTED"
    | "REPLACED"
    | "INCONSISTENT"
    | "RPC_UNAVAILABLE";
  constructor(code: SettlementError["code"], message: string) {
    super(message);
    this.name = "SettlementError";
    this.code = code;
  }
}
export type SettledTransaction = {
  requestedHash: Hash;
  transactionHash: Hash;
  receipt: Receipt;
  reference: { blockNumber: bigint; blockHash: Hash };
  assurance: "fuji-finalized" | "local-receipt";
  repriced: boolean;
};

/**
 * Fuji Helicon: latest is executed; finalized is settled. A successful receipt
 * alone is insufficient. No transaction is sent or automatically resubmitted.
 * Abort stops waiting/results; an already-started viem read can finish later.
 */
export async function waitForSettlementEvidence(
  client: SettlementClient,
  hash: Hash,
  policy: SettlementPolicy,
  options: { timeoutMs?: number; pollMs?: number; signal?: AbortSignal } = {},
): Promise<SettledTransaction> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const pollMs = options.pollMs ?? 1_000;
  if (
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 600_000 ||
    !Number.isFinite(pollMs) ||
    pollMs < 1
  )
    throw new RangeError("Settlement timeout/poll interval is invalid");
  if (
    !["fuji-finalized", "local-receipt"].includes(policy.mode) ||
    (policy.mode === "fuji-finalized" && policy.chainId !== 43113) ||
    (policy.mode === "local-receipt" && policy.chainId !== 31338)
  )
    throw new SettlementError("WRONG_CHAIN", "Unsupported settlement policy");
  const deadline = performance.now() + timeoutMs;
  const abortError = () =>
    new SettlementError(
      "ABORTED",
      "Stopped waiting; the transaction may still execute.",
    );
  const timeoutError = () =>
    new SettlementError(
      "TIMEOUT",
      "Settlement is unconfirmed; keep the transaction hash and check again.",
    );
  function remaining() {
    if (options.signal?.aborted) throw abortError();
    const ms = deadline - performance.now();
    if (ms <= 0) throw timeoutError();
    return ms;
  }
  async function bounded<T>(operation: () => Promise<T>): Promise<T> {
    const ms = remaining();
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => finish(false, abortError());
      const timer = setTimeout(() => finish(false, timeoutError()), ms);
      let done = false;
      function finish(ok: boolean, value: unknown) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onAbort);
        if (ok) resolve(value as T);
        else reject(value);
      }
      options.signal?.addEventListener("abort", onAbort, { once: true });
      if (options.signal?.aborted) return onAbort();
      Promise.resolve()
        .then(operation)
        .then(
          (v) => finish(true, v),
          (e) => finish(false, e),
        );
    });
  }
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const validHash = (value: unknown): value is Hash =>
    typeof value === "string" && /^0x[0-9a-f]{64}$/i.test(value);
  function validReceipt(r: Receipt) {
    if (
      !validHash(r.transactionHash) ||
      !validHash(r.blockHash) ||
      typeof r.blockNumber !== "bigint" ||
      r.blockNumber < 0n
    )
      throw new SettlementError(
        "INCONSISTENT",
        "Malformed receipt; settlement cannot be confirmed.",
      );
    if (r.status === "reverted")
      throw new SettlementError("REVERTED", "The transaction reverted.");
    if (r.status !== "success")
      throw new SettlementError(
        "INCONSISTENT",
        "Receipt has no successful execution status.",
      );
  }
  let repriced = false;
  let acceptedHash = hash;
  let changedIntent = false;
  try {
    if ((await bounded(() => client.getChainId())) !== policy.chainId)
      throw new SettlementError(
        "WRONG_CHAIN",
        "RPC network differs from the selected settlement policy.",
      );
    const receipt = await bounded(() =>
      client.waitForTransactionReceipt({
        hash,
        timeout: Math.max(1, Math.floor(remaining())),
        confirmations: 1,
        onReplaced: (replacement) => {
          if (replacement.reason !== "repriced") {
            changedIntent = true;
            return;
          }
          repriced = true;
          acceptedHash = replacement.transactionReceipt.transactionHash;
        },
      }),
    );
    if (changedIntent || !same(receipt.transactionHash, acceptedHash))
      throw new SettlementError(
        "REPLACED",
        "The transaction was cancelled or replaced with a different action.",
      );
    validReceipt(receipt);
    let reference: { blockNumber: bigint; blockHash: Hash };
    if (policy.mode === "fuji-finalized") {
      for (;;) {
        const block = await bounded(() =>
          client.getBlock({ blockTag: "finalized" }),
        );
        if (
          typeof block.number !== "bigint" ||
          block.number < 0n ||
          !validHash(block.hash)
        )
          throw new SettlementError(
            "INCONSISTENT",
            "The RPC did not provide a usable finalized block.",
          );
        if (block.number >= receipt.blockNumber) {
          reference = { blockNumber: block.number, blockHash: block.hash };
          break;
        }
        await bounded(
          () =>
            new Promise((resolve) =>
              setTimeout(resolve, Math.min(pollMs, remaining())),
            ),
        );
      }
    } else
      reference = {
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
      };
    const canonical = await bounded(() =>
      client.getBlock({ blockNumber: receipt.blockNumber }),
    );
    if (
      canonical.number !== receipt.blockNumber ||
      !canonical.hash ||
      !same(canonical.hash, receipt.blockHash)
    )
      throw new SettlementError(
        "INCONSISTENT",
        "Receipt block differs from the canonical block.",
      );
    const confirmed = await bounded(() =>
      client.getTransactionReceipt({ hash: receipt.transactionHash }),
    );
    validReceipt(confirmed);
    if (
      confirmed.blockNumber !== receipt.blockNumber ||
      !same(confirmed.blockHash, receipt.blockHash) ||
      !same(confirmed.transactionHash, receipt.transactionHash)
    )
      throw new SettlementError(
        "INCONSISTENT",
        "Receipt changed while checking settlement.",
      );
    if ((await bounded(() => client.getChainId())) !== policy.chainId)
      throw new SettlementError(
        "WRONG_CHAIN",
        "RPC network changed while checking settlement.",
      );
    remaining();
    return {
      requestedHash: hash,
      transactionHash: receipt.transactionHash,
      receipt: confirmed,
      reference,
      assurance: policy.mode,
      repriced,
    };
  } catch (error) {
    if (error instanceof SettlementError) throw error;
    remaining(); // Prefer cancellation/timeout to an incidental transport error.
    throw new SettlementError(
      "RPC_UNAVAILABLE",
      "Could not verify settlement through the RPC; the transaction may still execute.",
    );
  }
}

/** Browser integration entrypoint; preserves the complete viem receipt. */
export async function waitForSettlement(
  client: SettlementClient,
  options: {
    hash: Hash;
    chainId: number;
    signal?: AbortSignal;
    timeoutMs?: number;
  },
): Promise<TransactionReceipt> {
  if (options.chainId !== 43113 && options.chainId !== 31338)
    throw new SettlementError(
      "WRONG_CHAIN",
      "Only Fuji 43113 and explicit local 31338 are supported.",
    );
  const policy: SettlementPolicy =
    options.chainId === 43113
      ? { mode: "fuji-finalized", chainId: 43113 }
      : { mode: "local-receipt", chainId: 31338 };
  return (
    await waitForSettlementEvidence(client, options.hash, policy, options)
  ).receipt;
}
