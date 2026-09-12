import type { Address, Chain } from "viem";

/** The caller supplies application-approved chain metadata, never wallet errors. */
export type WalletChain = Pick<
  Chain,
  "id" | "name" | "nativeCurrency" | "rpcUrls" | "blockExplorers"
>;
export interface WalletProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

/** Only use with application-authored, non-sensitive user guidance. */
export class WalletNetworkError extends Error {}

function errorParts(error: unknown): Record<string, unknown>[] {
  const seen = new Set<unknown>();
  const parts: Record<string, unknown>[] = [];
  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 6 || seen.has(value))
      return;
    seen.add(value);
    const part = value as Record<string, unknown>;
    parts.push(part);
    for (const key of ["cause", "error", "data", "originalError"])
      visit(part[key], depth + 1);
  };
  visit(error, 0);
  return parts;
}

function errorCodes(error: unknown): number[] {
  return errorParts(error).flatMap(({ code }) => {
    if (typeof code === "number" && Number.isInteger(code)) return [code];
    if (typeof code === "string" && /^-?\d+$/.test(code)) return [Number(code)];
    return [];
  });
}

/** Provider messages can contain URLs or request data; show fixed guidance only. */
export function walletErrorMessage(
  error: unknown,
  fallback = "The wallet or network request failed. Check your wallet and try again.",
): string {
  if (error instanceof WalletNetworkError) return error.message;
  const codes = errorCodes(error);
  if (codes.includes(4001))
    return "The wallet request was canceled. Approve it in your wallet to continue.";
  if (codes.includes(-32002))
    return "A wallet request is already pending. Open your wallet and finish or dismiss it before trying again.";
  if (codes.includes(4902))
    return "This network is not available in your wallet. Approve adding the requested network, then try again.";
  if (codes.includes(4100))
    return "This account is not authorized. Reconnect your wallet to Cutout.";
  if (codes.includes(4900) || codes.includes(4901))
    return "Your wallet is disconnected from the requested network. Reconnect it and try again.";
  if (codes.includes(4200) || codes.includes(-32601))
    return "Your wallet does not support this request. Select the requested network manually or use a compatible wallet.";
  if (
    errorParts(error).some(
      ({ message }) =>
        message ===
        "Task acceptance deadline is too close for a discovery listing",
    )
  )
    return "This task's acceptance deadline is too close to publish a listing. Check its deadline and refund availability in Activity.";
  if (
    errorParts(error).some(
      ({ message }) =>
        typeof message === "string" && /insufficient funds/i.test(message),
    )
  )
    return "This wallet needs gas on the requested network. Fund that same address before trying again.";
  if (
    errorParts(error).some(
      ({ message }) =>
        typeof message === "string" &&
        /Discovery lease must end before acceptance deadline/.test(message),
    )
  )
    return "The discovery listing must expire before the task acceptance deadline. Choose a shorter listing duration.";
  return fallback;
}

function selectedAccount(accounts: unknown): Address {
  if (!Array.isArray(accounts) || !accounts.length)
    throw new WalletNetworkError(
      "No wallet account is authorized. Connect your wallet to Cutout first.",
    );
  if (
    !accounts.every(
      (a) => typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a),
    )
  )
    throw new WalletNetworkError(
      "The wallet returned an invalid account. Reconnect your wallet.",
    );
  return accounts[0] as Address;
}

function chainNumber(chainId: unknown): number {
  if (typeof chainId !== "string" || !/^0x[0-9a-fA-F]+$/.test(chainId))
    throw new WalletNetworkError(
      "The wallet returned an invalid network. Reconnect your wallet.",
    );
  const id = Number(chainId);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new WalletNetworkError(
      "The wallet returned an invalid network. Reconnect your wallet.",
    );
  return id;
}

/**
 * Switch once, adding an unknown network only on explicit 4902. Verify the
 * selected account and chain after approval. This never sends a transaction,
 * requests new account authorization, or retries publication.
 */
export async function ensureWalletChain(
  provider: WalletProvider,
  chain: WalletChain,
  expectedAccount?: Address,
): Promise<Address> {
  if (!Number.isSafeInteger(chain.id) || chain.id <= 0)
    throw new WalletNetworkError(
      "The requested network configuration is invalid.",
    );
  if (expectedAccount && !/^0x[0-9a-fA-F]{40}$/.test(expectedAccount))
    throw new WalletNetworkError("The expected wallet account is invalid.");
  const before = selectedAccount(
    await provider.request({ method: "eth_accounts" }),
  );
  const owner = expectedAccount ?? before;
  const assertOwner = (account: Address) => {
    if (account.toLowerCase() !== owner.toLowerCase())
      throw new WalletNetworkError(
        "The selected wallet account changed. Select the original task wallet and try again.",
      );
  };
  assertOwner(before);
  const chainId = `0x${chain.id.toString(16)}`;
  const switchChain = () =>
    provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  if (
    chainNumber(await provider.request({ method: "eth_chainId" })) !== chain.id
  ) {
    try {
      await switchChain();
    } catch (error) {
      const codes = errorCodes(error);
      // Rejection/pending always wins over a nested stale unknown-chain code.
      if (
        !codes.includes(4902) ||
        codes.includes(4001) ||
        codes.includes(-32002)
      )
        throw error;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            chainName: chain.name,
            nativeCurrency: { ...chain.nativeCurrency },
            rpcUrls: [...chain.rpcUrls.default.http],
            ...(chain.blockExplorers?.default
              ? {
                  blockExplorerUrls: [chain.blockExplorers.default.url],
                }
              : {}),
          },
        ],
      });
      await switchChain();
    }
  }
  const account = selectedAccount(
    await provider.request({ method: "eth_accounts" }),
  );
  assertOwner(account);
  if (
    chainNumber(await provider.request({ method: "eth_chainId" })) !== chain.id
  )
    throw new WalletNetworkError(
      "Your wallet did not select the requested network. Select it in your wallet and try again.",
    );
  return account;
}
