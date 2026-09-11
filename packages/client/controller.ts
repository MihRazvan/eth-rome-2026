import { DEMO_MAKER_CAPITAL } from "../shared/capital";
import { compareAmounts } from "../shared/amount";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  formatUnits,
  parseUnits,
  isAddress,
  zeroAddress,
  zeroHash,
  keccak256,
  sha256,
  encodeFunctionData,
  type Address,
  type Hex,
  type EIP1193Provider,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { ExitMarketAbi } from "../shared/ExitMarket";
import { TestUSDCAbi } from "../shared/TestUSDC";
import { TestWithdrawalVaultAbi } from "../shared/TestWithdrawalVault";
import { OfferKeyRegistryAbi } from "../shared/OfferKeyRegistry";
import {
  quoteTypedData,
  type SignedQuote,
  serializeSignedQuote,
} from "../shared/quote";
import {
  BrowserKeyStore,
  generateRecipientKey,
  encryptOffer,
  validateBinding,
  registryStatusReader,
  offerRequestId,
  keyStorageId,
  keyBindingTypedData,
  verifyStoredOffer,
  purchaseQuoteCodec,
  type OfferRecord,
  type SignedKeyBinding,
  type RequestContext,
  type ByteTransport,
} from "../transport";
import type {
  AppData,
  AppActions,
  Claim,
  Offer,
  TransactionResult,
} from "../../apps/web/src/model";
interface Config {
  environment: "local" | "fuji";
  chainId: number;
  rpcUrl: string;
  market: Address;
  source: Address;
  token: Address;
  keyRegistry: Address;
  blockNumber: string;
  makers: Address[];
  storage: string;
  index: string;
}
declare global {
  interface Window {
    ethereum?: EIP1193Provider & {
      on?: (event: string, fn: (...args: any[]) => void) => void;
      removeListener?: (event: string, fn: (...args: any[]) => void) => void;
    };
  }
}
export const unavailable: AppData = {
  environment: "unavailable",
  chainName: "Avalanche Fuji",
  wrongNetwork: false,
  claims: [],
  offers: [],
  loading: true,
  services: [],
  privateKeyStatus: "missing",
};
const units = (n: bigint) => formatUnits(n, 6);
const now = () => Math.floor(Date.now() / 1000);
export class ExitController {
  data: AppData = { ...unavailable };
  config?: Config;
  wallet: any;
  address?: Address;
  quotes = new Map<string, SignedQuote>();
  records = new Map<string, OfferRecord>();
  keys = new BrowserKeyStore();
  private session = 0;
  private refreshGeneration = 0;
  private disposed = false;
  private detachProvider?: () => void;
  private changeWallet(address?: Address, wallet?: any) {
    this.session++;
    this.refreshGeneration++;
    this.address = address;
    this.wallet = wallet;
    this.quotes = new Map();
    this.records = new Map();
    this.authoredOrders = [];
    this.set({
      wallet: address,
      balance: undefined,
      makerAllowance: undefined,
      offers: [],
      privateKeyStatus: "missing",
      loading: true,
      error: undefined,
      claims: this.data.claims.map((c) => ({
        ...c,
        isOwner: false,
        cost: undefined,
        realized: undefined,
        residualCost: undefined,
        walletWithdrawn: undefined,
      })),
    });
  }
  private assertSession(session: number, address: Address, wallet: any) {
    if (
      this.disposed ||
      this.session !== session ||
      this.wallet !== wallet ||
      this.address?.toLowerCase() !== address.toLowerCase()
    )
      throw new Error(
        "Wallet session changed. Review the action again before signing.",
      );
  }
  private watchProvider() {
    this.detachProvider?.();
    const provider =
      typeof window !== "undefined" ? window.ethereum : undefined;
    if (!provider?.on) return;
    const refresh = () => {
      void this.refresh().catch(() => {});
    };
    const accountsChanged = (accounts: unknown) => {
      if (this.config?.environment !== "fuji") return;
      const first = Array.isArray(accounts) ? accounts[0] : undefined;
      const address =
        typeof first === "string" && isAddress(first)
          ? (first as Address)
          : undefined;
      this.changeWallet(address, address ? this.wallet : undefined);
      refresh();
    };
    const chainChanged = () => {
      if (this.config?.environment !== "fuji") return;
      this.changeWallet(this.address, this.wallet);
      refresh();
    };
    const disconnect = () => {
      if (this.config?.environment !== "fuji") return;
      this.changeWallet();
      refresh();
    };
    provider.on("accountsChanged", accountsChanged);
    provider.on("chainChanged", chainChanged);
    provider.on("disconnect", disconnect);
    this.detachProvider = () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
      provider.removeListener?.("disconnect", disconnect);
    };
  }
  dispose() {
    this.disposed = true;
    this.session++;
    this.refreshGeneration++;
    this.detachProvider?.();
    this.detachProvider = undefined;
    this.quotes.clear();
    this.records.clear();
  }
  constructor(private update: (data: AppData) => void) {}
  private set(patch: Partial<AppData>) {
    this.data = { ...this.data, ...patch };
    this.update(this.data);
  }
  private async api(path: string, body?: unknown) {
    const r = await fetch(
      `/api/${path}`,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : undefined,
    );
    if (!r.ok) {
      let message = "EXIT service unavailable";
      try {
        message = (await r.json()).error ?? message;
      } catch {}
      throw new Error(message);
    }
    return r.json();
  }
  private get chain() {
    const d = this.config!;
    return defineChain({
      id: d.chainId,
      name: d.environment === "local" ? "EXIT local chain" : "Avalanche Fuji",
      nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
      rpcUrls: { default: { http: [d.rpcUrl] } },
    });
  }
  private get client() {
    return createPublicClient({
      chain: this.chain,
      transport: http(this.config!.rpcUrl),
    });
  }
  private get storage(): ByteTransport {
    return {
      environment:
        this.config!.environment === "local" ? "explicit-local-test" : "swarm",
      upload: async () => {
        throw new Error("Upload is performed by maker transport");
      },
      retrieve: async (r) => {
        const response = await fetch(
          `/api/records/${r.reference}?sha256=${r.sha256}`,
        );
        if (!response.ok) throw new Error("Offer record unavailable");
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (sha256(bytes) !== r.sha256)
          throw new Error("Stored offer integrity mismatch");
        return bytes;
      },
    };
  }
  async start() {
    this.disposed = false;
    const session = ++this.session;
    this.watchProvider();
    try {
      const config = await this.api("config");
      if (session !== this.session || this.disposed) return;
      this.config = config;
      await this.refresh();
    } catch (e) {
      if (session !== this.session || this.disposed) return;
      this.set({
        ...unavailable,
        loading: false,
        error:
          "Live deployment is unavailable. Start the local demo or configure a funded Fuji deployment. Preview is explicitly labelled.",
        services: [
          {
            name: "Settlement",
            status: "unavailable",
            detail: "No configured deployment",
          },
          {
            name: "Arkiv",
            status: "unavailable",
            detail: "No live discovery configuration",
          },
          {
            name: "Swarm",
            status: "unavailable",
            detail: "No upload configuration",
          },
        ],
      });
    }
  }
  async connect() {
    if (!this.config) throw new Error("No settlement deployment available");
    if (this.config.environment === "local") {
      await this.selectLocalWallet(
        Number(sessionStorage.getItem("exit-local-role") ?? 0),
      );
      return;
    }
    if (!window.ethereum)
      throw new Error("Install or open an EVM wallet to connect to Fuji");
    const session = this.session;
    const wallet = createWalletClient({
      chain: this.chain,
      transport: custom(window.ethereum),
    });
    const [address] = await wallet.requestAddresses();
    if (
      this.disposed ||
      (session !== this.session &&
        this.address?.toLowerCase() !== address?.toLowerCase())
    )
      throw new Error("Wallet session changed; reconnect.");
    this.changeWallet(address, wallet);
    this.watchProvider();
    await this.refresh();
  }
  async selectLocalWallet(index: number) {
    if (this.config?.environment !== "local" || this.config.chainId !== 31337)
      throw new Error(
        "Local wallets are only available on the isolated development chain",
      );
    const account = mnemonicToAccount(
      "test test test test test test test test test test test junk",
      { addressIndex: index },
    );
    const wallet = createWalletClient({
      account,
      chain: this.chain,
      transport: http(this.config.rpcUrl),
    });
    this.changeWallet(account.address, wallet);
    sessionStorage.setItem("exit-local-role", String(index));
    await this.refresh();
  }
  async switchNetwork() {
    if (!window.ethereum || !this.config) throw new Error("Wallet unavailable");
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${this.config.chainId.toString(16)}` }],
    });
    await this.refresh();
  }
  private async ready() {
    if (!this.wallet || !this.address) await this.connect();
    if ((await this.wallet.getChainId()) !== this.config!.chainId)
      throw new Error("Switch wallet to the settlement network");
    const [current] = await this.wallet.getAddresses();
    if (current?.toLowerCase() !== this.address?.toLowerCase())
      throw new Error("Wallet account changed; reconnect before proceeding");
    return this.address!;
  }
  private async transaction(
    address: Address,
    abi: any,
    functionName: string,
    args: readonly unknown[] = [],
  ): Promise<TransactionResult> {
    const account = await this.ready();
    const session = this.session,
      wallet = this.wallet,
      client = this.client;
    const sim = await client.simulateContract({
      address,
      abi,
      functionName,
      args,
      account,
    });
    this.assertSession(session, account, wallet);
    await this.ready();
    this.assertSession(session, account, wallet);
    const hash = await wallet.writeContract({
      ...sim.request,
      account: wallet.account ?? account,
    });
    let replaced = false,
      cancelled = false;
    const receipt = await client.waitForTransactionReceipt({
      hash,
      onReplaced: (replacement) => {
        replaced = true;
        cancelled = replacement.reason === "cancelled";
      },
    });
    if (cancelled) {
      await this.refresh().catch(() => {});
      throw new Error(
        "Transaction was cancelled in the wallet. The requested action did not complete.",
      );
    }
    if (replaced) {
      const actual = await client.getTransaction({
        hash: receipt.transactionHash,
      });
      if (
        actual.to?.toLowerCase() !== address.toLowerCase() ||
        actual.input !== encodeFunctionData({ abi, functionName, args }) ||
        actual.value !== 0n
      ) {
        await this.refresh().catch(() => {});
        throw new Error(
          "Wallet replacement changed the requested action; inspect chain state.",
        );
      }
    }
    if (receipt.status !== "success")
      throw new Error(
        "Transaction reverted. Ownership and payment remain determined by chain state.",
      );
    await this.refresh().catch(() => {});
    return {
      status: replaced ? "replaced" : "confirmed",
      hash: receipt.transactionHash,
      message: "Confirmed onchain",
      explorerUrl: this.explorer(receipt.transactionHash),
    };
  }
  private explorer(hash: string) {
    return this.config?.environment === "fuji"
      ? `https://testnet.snowtrace.io/tx/${hash}`
      : undefined;
  }
  async refresh() {
    if (!this.config || this.disposed) return;
    const d = this.config,
      c = this.client,
      address = this.address,
      wallet = this.wallet;
    const generation = ++this.refreshGeneration,
      session = this.session;
    const current = () =>
      !this.disposed &&
      this.refreshGeneration === generation &&
      this.session === session &&
      this.config === d &&
      this.address === address &&
      this.wallet === wallet;
    const quotes = new Map<string, SignedQuote>(),
      records = new Map<string, OfferRecord>();
    const authoredOrders: typeof this.authoredOrders = [];
    this.set({ loading: true, error: undefined });
    try {
      if ((await c.getChainId()) !== d.chainId)
        throw new Error("Configured RPC reports a different chain");
      const block = await c.getBlock();
      const chainNow = block.timestamp,
        blockNumber = block.number;
      const next = await c.readContract({
        blockNumber,
        address: d.market,
        abi: ExitMarketAbi,
        functionName: "nextClaimId",
      });
      const claims: Claim[] = [],
        offers: Offer[] = [];
      const logs = await c.getContractEvents({
        address: d.market,
        abi: ExitMarketAbi,
        fromBlock: BigInt(d.blockNumber),
        toBlock: blockNumber,
      });
      let privateAvailable = false,
        discoveryChecked = false,
        storedVerified = false,
        discoveryFailed = false;
      for (let id = 1n; id < next; id++) {
        const p = await c.readContract({
          blockNumber,
          address: d.market,
          abi: ExitMarketAbi,
          functionName: "positions",
          args: [id],
        });
        const r = await c.readContract({
          blockNumber,
          address: d.source,
          abi: TestWithdrawalVaultAbi,
          functionName: "requests",
          args: [p[1]],
        });
        const [pending, claimable, cash] = await c.readContract({
          blockNumber,
          address: d.market,
          abi: ExitMarketAbi,
          functionName: "remaining",
          args: [id],
        });
        const history: Claim["history"] = [];
        let walletCost = 0n,
          walletCash = 0n,
          walletSales = 0n;
        const owned = p[0].toLowerCase() === address?.toLowerCase();
        for (const log of logs) {
          const a = log.args as any;
          if (a.claimId !== id) continue;
          if (log.eventName === "Accepted") {
            history.push({
              label: "Rights purchased",
              detail: `${a.seller.slice(0, 6)} → ${a.buyer.slice(0, 6)}`,
              amount: units(a.netPayment),
              txUrl: this.explorer(log.transactionHash),
            });
            if (a.buyer.toLowerCase() === address?.toLowerCase())
              walletCost += a.netPayment + a.feeAmount;
            if (a.seller.toLowerCase() === address?.toLowerCase())
              walletSales += a.netPayment;
          }
          if (log.eventName === "Withdrawn") {
            history.push({
              label: "Cash withdrawn",
              detail: `Owner ${a.owner.slice(0, 6)} · depletion updated`,
              amount: units(a.amount),
              txUrl: this.explorer(log.transactionHash),
            });
            if (a.owner.toLowerCase() === address?.toLowerCase())
              walletCash += a.amount;
          }
          if (log.eventName === "Originated")
            history.push({
              label: "Backed withdrawal originated",
              detail: r[7]
                ? "Explicit adverse test source"
                : "EXIT Test Withdrawal Vault",
              amount: units(a.expectedAmount),
              txUrl: this.explorer(log.transactionHash),
            });
        }
        claims.push({
          id: String(id),
          title: r[7] ? "Adverse payout claim" : "Test vault withdrawal",
          source: "EXIT Test Withdrawal Vault",
          sourceAddress: d.source,
          owner: p[0],
          isOwner: owned,
          expected: units(pending + claimable + cash),
          pending: units(pending),
          claimable: units(claimable),
          collected: units(cash),
          withdrawn: units(p[5]),
          walletWithdrawn: units(walletCash),
          cost:
            owned && p[6] > 0n
              ? units(p[6])
              : walletCost > 0n
                ? units(walletCost)
                : undefined,
          realized:
            walletCost > 0n && (!owned || pending + claimable + cash === 0n)
              ? units(walletCash + walletSales - walletCost)
              : undefined,
          residualCost:
            owned && walletCost > 0n
              ? units(walletCost - walletCash)
              : undefined,
          timing:
            pending > 0n
              ? `40% at ${new Date(Number(r[4] + 60n) * 1000).toLocaleTimeString()}, remainder at ${new Date(Number(r[4] + 120n) * 1000).toLocaleTimeString()}`
              : "Standard installments available or collected",
          status: r[7]
            ? "loss"
            : pending + claimable + cash === 0n
              ? "exhausted"
              : p[5] > 0n
                ? "partial"
                : claimable + cash > 0n
                  ? "collectible"
                  : "pending",
          epoch: String(p[2]),
          depletion: units(p[3]),
          recovery:
            "Ownership remains for later funded recoveries, even after standard payout is exhausted.",
          sourceRisk: r[7]
            ? "Adverse test scenario: 3% of original backing is sent to the disclosed loss sink. A 6,000 expected residual pays 5,700."
            : "Test tokens have no monetary value. Fixed test installments; future source recoveries are not guaranteed.",
          history,
        });
        const context: RequestContext = {
          chainId: d.chainId,
          market: d.market,
          seller: p[0],
          requestId: offerRequestId(d.chainId, d.market, id, p[2]),
        };
        let result: {
          records: OfferRecord[];
          context: RequestContext;
          certs: SignedKeyBinding[];
        };
        try {
          result = (await this.api(`offers?claimId=${id}`)) as {
            records: OfferRecord[];
            context: RequestContext;
            certs: SignedKeyBinding[];
          };
          if (
            !Array.isArray(result.records) ||
            !Array.isArray(result.certs) ||
            result.context.chainId !== context.chainId ||
            result.context.market.toLowerCase() !==
              context.market.toLowerCase() ||
            result.context.seller.toLowerCase() !==
              context.seller.toLowerCase() ||
            result.context.requestId !== context.requestId
          )
            throw new Error("Discovery context changed");
          discoveryChecked = true;
        } catch {
          claims[claims.length - 1].offersUnavailable = true;
          discoveryFailed = true;
          continue;
        }
        if (!current()) return;
        const codec = purchaseQuoteCodec(
          { claimId: id, source: d.source, sourceVersion: 1n },
          c,
        );
        for (const record of result.records) {
          const rid = record.reference;
          records.set(rid, record);
          const cert = result.certs.find(
            (x) => x.binding.version === record.keyVersion,
          );
          const key =
            cert && owned
              ? await this.keys
                  .load(keyStorageId(cert.binding))
                  .catch(() => undefined)
              : undefined;
          if (key) privateAvailable = true;
          if (record.mode === "private" && !key) {
            offers.push({
              id: rid,
              claimId: String(id),
              maker: "Confidential maker",
              teamOperated: false,
              deadline: 0,
              status: "encrypted",
              mode: "private",
              reason:
                "Only the seller’s registered device key can decrypt this offer.",
              recordUrl: `/api/records/${rid}?sha256=${record.sha256}`,
            });
            continue;
          }
          try {
            const signed = await verifyStoredOffer(
              record,
              context,
              codec,
              this.storage,
              key && cert ? { key, cert } : undefined,
            );
            storedVerified = true;
            quotes.set(rid, signed);
            const q = signed.quote;
            let status: Offer["status"] = "valid",
              reason: string | undefined;
            if (q.deadline < chainNow) {
              status = "expired";
              reason = "Request fresh offers";
            } else if (q.ownershipEpoch !== p[2] || q.depletion !== p[3]) {
              status = "stale";
              reason = "Remaining rights changed; request a new price";
            } else if (
              await c.readContract({
                blockNumber,
                address: d.market,
                abi: ExitMarketAbi,
                functionName: "unavailable",
                args: [q.maker, q.nonce],
              })
            ) {
              status = "cancelled";
              reason = "Cancelled or already consumed onchain";
            } else {
              const bal = await c.readContract({
                  blockNumber,
                  address: d.token,
                  abi: TestUSDCAbi,
                  functionName: "balanceOf",
                  args: [q.maker],
                }),
                allow = await c.readContract({
                  blockNumber,
                  address: d.token,
                  abi: TestUSDCAbi,
                  functionName: "allowance",
                  args: [q.maker, d.market],
                });
              if (
                bal < q.netPayment + q.feeAmount ||
                allow < q.netPayment + q.feeAmount
              ) {
                status = "unfunded";
                reason = "Maker balance or allowance is insufficient";
              }
            }
            const makerIndex = d.makers.findIndex(
              (x) => x.toLowerCase() === q.maker.toLowerCase(),
            );
            offers.push({
              id: rid,
              claimId: String(id),
              maker:
                makerIndex >= 0
                  ? `EXIT Maker ${String.fromCharCode(65 + makerIndex)}`
                  : `Maker ${q.maker.slice(0, 8)}`,
              makerAddress: q.maker,
              teamOperated: makerIndex >= 0,
              net: units(q.netPayment),
              gross: units(q.netPayment + q.feeAmount),
              fee: units(q.feeAmount),
              deadline: Number(q.deadline) * 1000,
              status,
              mode: record.mode,
              reason,
              recordUrl: `/api/records/${rid}?sha256=${record.sha256}`,
            });
          } catch {
            offers.push({
              id: rid,
              claimId: String(id),
              maker: "Unverified offer",
              teamOperated: false,
              deadline: 0,
              status: "encrypted",
              mode: record.mode,
              reason:
                "Record or signature could not be authenticated. Never settle this record.",
            });
          }
        }
      }
      offers.sort((a, b) => compareAmounts(b.net, a.net));
      const balance = address
        ? units(
            await c.readContract({
              blockNumber,
              address: d.token,
              abi: TestUSDCAbi,
              functionName: "balanceOf",
              args: [address],
            }),
          )
        : undefined;
      if (address) {
        try {
          const entries = JSON.parse(
            localStorage.getItem(this.orderStorageKey(address)) ?? "[]",
          );
          for (const order of entries) {
            if (!/^0x[0-9a-f]{64}$/i.test(order.nonce)) continue;
            order.closed = await c.readContract({
              blockNumber,
              address: d.market,
              abi: ExitMarketAbi,
              functionName: "unavailable",
              args: [address, order.nonce],
            });
            authoredOrders.push(order);
          }
        } catch {
          /* Local maker history is optional; settlement records remain authoritative. */
        }
      }
      const wrongNetwork = wallet
        ? (await wallet.getChainId()) !== d.chainId
        : false;
      const makerAllowance = address
        ? units(
            await c.readContract({
              address: d.token,
              abi: TestUSDCAbi,
              functionName: "allowance",
              args: [address, d.market],
              blockNumber,
            }),
          )
        : undefined;
      if (!current()) return;
      this.quotes = quotes;
      this.records = records;
      this.authoredOrders = authoredOrders;
      this.set({
        environment: d.environment,
        chainName:
          d.environment === "local"
            ? "Local chain · real test transactions"
            : "Avalanche Fuji",
        chainId: d.chainId,
        wallet: address,
        wrongNetwork,
        makerAllowance,
        error: discoveryFailed
          ? "Some offers could not be loaded. Onchain positions and collection remain available."
          : undefined,
        balance,
        claims,
        offers,
        loading: false,
        updatedAt: Date.now(),
        chainTimeOffsetMs: Number(chainNow) * 1000 - Date.now(),
        privateKeyStatus: privateAvailable ? "available" : "missing",
        services: [
          {
            name: "Settlement",
            status: "connected",
            detail:
              d.environment === "local"
                ? "Anvil · chain 31337"
                : "Avalanche Fuji · chain 43113",
          },
          {
            name: "Arkiv",
            status:
              d.index === "arkiv" && discoveryChecked && !discoveryFailed
                ? "connected"
                : "unavailable",
            detail:
              d.index === "arkiv"
                ? "Live native entity discovery"
                : "Explicit local index; sponsor publication unverified",
          },
          {
            name: "Swarm",
            status:
              d.storage === "swarm" && storedVerified
                ? "connected"
                : "unavailable",
            detail:
              d.storage === "swarm"
                ? "Swarm configured; retrieval verification pending"
                : "Explicit local bytes; sponsor upload unverified",
          },
        ],
      });
    } catch (e) {
      if (!current()) return;
      this.quotes = new Map();
      this.records = new Map();
      this.set({
        offers: [],
        loading: false,
        error: e instanceof Error ? e.message : "Chain refresh failed",
      });
      throw e;
    }
  }
  async faucet() {
    return this.transaction(this.config!.token, TestUSDCAbi, "faucet");
  }
  async originate() {
    const address = await this.ready(),
      session = this.session,
      wallet = this.wallet;
    await this.transaction(this.config!.token, TestUSDCAbi, "approve", [
      this.config!.market,
      parseUnits("10000", 6),
    ]);
    this.assertSession(session, address, wallet);
    return this.transaction(this.config!.market, ExitMarketAbi, "originate", [
      parseUnits("10000", 6),
      false,
    ]);
  }
  async collect(id: string) {
    return this.transaction(this.config!.market, ExitMarketAbi, "collect", [
      BigInt(id),
    ]);
  }
  async withdraw(id: string) {
    const p = await this.client.readContract({
      address: this.config!.market,
      abi: ExitMarketAbi,
      functionName: "positions",
      args: [BigInt(id)],
    });
    return this.transaction(this.config!.market, ExitMarketAbi, "withdraw", [
      BigInt(id),
      p[4],
    ]);
  }
  async acceptOffer(id: string) {
    const q = this.quotes.get(id);
    if (!q) throw new Error("Offer unavailable on this device");
    return this.transaction(this.config!.market, ExitMarketAbi, "accept", [
      q.quote,
      q.signature,
    ]);
  }
  async cancelOffer(id: string) {
    const q = this.quotes.get(id);
    if (!q) throw new Error("Offer unavailable");
    if ((await this.ready()).toLowerCase() !== q.quote.maker.toLowerCase())
      throw new Error("Only the maker can cancel this offer");
    return this.transaction(this.config!.market, ExitMarketAbi, "cancel", [
      q.quote.nonce,
    ]);
  }
  async unlockPrivateOffers(id: string) {
    await this.ready();
    await this.refresh();
    const claim = this.data.claims.find((c) => c.id === id);
    if (!claim?.isOwner)
      throw new Error("Only the current seller can establish a recipient key");
    const cert = await this.ensureKey(id);
    if (!cert) throw new Error("Key setup failed");
  }
  authoredOrders: {
    nonce: Hex;
    claimId: string;
    net: string;
    deadline: number;
    closed: boolean;
  }[] = [];
  private orderStorageKey(address: Address) {
    return `exit-authored:${this.config!.chainId}:${this.config!.market}:${address}`;
  }
  private get authoredStorageKey() {
    return this.orderStorageKey(this.address!);
  }
  private rememberOrder(q: SignedQuote["quote"]) {
    const entries = JSON.parse(
      localStorage.getItem(this.authoredStorageKey) ?? "[]",
    );
    entries.push({
      nonce: q.nonce,
      claimId: String(q.claimId),
      net: units(q.netPayment),
      deadline: Number(q.deadline) * 1000,
      closed: false,
    });
    localStorage.setItem(this.authoredStorageKey, JSON.stringify(entries));
  }
  async cancelAuthored(nonce: Hex) {
    return this.transaction(this.config!.market, ExitMarketAbi, "cancel", [
      nonce,
    ]);
  }
  private async ensureKey(id: string): Promise<SignedKeyBinding> {
    const address = this.address!,
      session = this.session,
      wallet = this.wallet;
    const p = await this.client.readContract({
      address: this.config!.market,
      abi: ExitMarketAbi,
      functionName: "positions",
      args: [BigInt(id)],
    });
    const context: RequestContext = {
      chainId: this.config!.chainId,
      market: this.config!.market,
      seller: p[0],
      requestId: offerRequestId(
        this.config!.chainId,
        this.config!.market,
        BigInt(id),
        p[2],
      ),
    };
    if (context.seller.toLowerCase() !== this.address?.toLowerCase())
      throw new Error("Only the current owner can request private offers");
    this.assertSession(session, address, wallet);
    const stored = localStorage.getItem(`exit-cert:${context.requestId}`);
    if (stored) {
      const cert = JSON.parse(stored) as SignedKeyBinding;
      const active = await this.client.readContract({
        address: this.config!.keyRegistry,
        abi: OfferKeyRegistryAbi,
        functionName: "keys",
        args: [context.seller, context.requestId],
      });
      if (
        cert.binding.validUntil > now() &&
        active[0] === keccak256(cert.binding.publicKey) &&
        active[1] === BigInt(cert.binding.version) &&
        (await this.keys.load(keyStorageId(cert.binding)))
      ) {
        // The local key can outlive a failed publication or the server's certificate cache.
        this.assertSession(session, address, wallet);
        await this.api("binding", { claimId: id, cert });
        return cert;
      }
    }
    const key = await generateRecipientKey();
    const active = await this.client.readContract({
      address: this.config!.keyRegistry,
      abi: OfferKeyRegistryAbi,
      functionName: "keys",
      args: [context.seller, context.requestId],
    });
    const binding = {
      ...context,
      version: Number(active[1]) + 1,
      publicKey: key.publicKey,
      validFrom: now() - 5,
      validUntil: now() + 86400,
    };
    this.assertSession(session, address, wallet);
    const signature = await wallet.signTypedData({
      ...keyBindingTypedData(binding),
      account: wallet.account ?? address,
    });
    this.assertSession(session, address, wallet);
    const cert = { binding, signature };
    await this.keys.save(keyStorageId(binding), key);
    await this.transaction(
      this.config!.keyRegistry,
      OfferKeyRegistryAbi,
      "register",
      [
        context.requestId,
        keccak256(key.publicKey),
        BigInt(binding.version),
        BigInt(binding.validUntil),
      ],
    );
    this.assertSession(session, address, wallet);
    localStorage.setItem(
      `exit-cert:${context.requestId}`,
      JSON.stringify(cert),
    );
    await this.api("binding", { claimId: id, cert });
    return cert;
  }
  async requestOffers(id: string, mode: "public" | "private") {
    if (mode === "private") await this.ready();
    const cert = mode === "private" ? await this.ensureKey(id) : undefined;
    const result = await this.api("request-offers", {
      claimId: id,
      mode,
      cert,
    });
    await this.refresh();
    return { status: "confirmed" as const, message: result.message };
  }
  async makeOffer(
    id: string,
    net: string,
    mode: "public" | "private" = "public",
  ) {
    const address = await this.ready(),
      d = this.config!,
      session = this.session,
      wallet = this.wallet;
    const p = await this.client.readContract({
      address: d.market,
      abi: ExitMarketAbi,
      functionName: "positions",
      args: [BigInt(id)],
    });
    const amount = parseUnits(net, 6);
    if (amount <= 0n) throw new Error("Offer must be positive");
    this.assertSession(session, address, wallet);
    let recipient:
      { context: RequestContext; cert: SignedKeyBinding } | undefined;
    if (mode === "private") {
      const result = (await this.api(`offers?claimId=${id}`)) as {
        certs: SignedKeyBinding[];
      };
      const context = {
        chainId: d.chainId,
        market: d.market,
        seller: p[0],
        requestId: offerRequestId(d.chainId, d.market, BigInt(id), p[2]),
      };
      const cert = result.certs.sort(
        (a, b) => b.binding.version - a.binding.version,
      )[0];
      if (!cert)
        throw new Error(
          "Seller has not registered an encryption key for this request",
        );
      await validateBinding(
        cert,
        context,
        (data, signature, signer) =>
          this.client.verifyTypedData({
            ...data,
            address: signer,
            signature,
            blockTag: "latest",
          }),
        registryStatusReader(this.client, d.keyRegistry),
      );
      this.assertSession(session, address, wallet);
      recipient = { context, cert };
    }
    const allowance = await this.client.readContract({
      address: d.token,
      abi: TestUSDCAbi,
      functionName: "allowance",
      args: [address, d.market],
    });
    this.assertSession(session, address, wallet);
    if (allowance < amount) {
      const capital = parseUnits(DEMO_MAKER_CAPITAL, 6);
      if (amount > capital)
        throw new Error(
          "Offer exceeds the disclosed test-capital spending limit. Authorize independent capital before placing this offer.",
        );
      await this.transaction(d.token, TestUSDCAbi, "approve", [
        d.market,
        capital,
      ]);
      this.assertSession(session, address, wallet);
    }
    const quote = {
      maker: address,
      seller: p[0],
      buyer: address,
      claimId: BigInt(id),
      source: d.source,
      sourceVersion: 1n,
      paymentToken: d.token,
      netPayment: amount,
      feeAmount: 0n,
      feeRecipient: zeroAddress,
      ownershipEpoch: p[2],
      depletion: p[3],
      deadline: (await this.client.getBlock()).timestamp + 300n,
      nonce: keccak256(crypto.getRandomValues(new Uint8Array(32))),
      underwritingHash: zeroHash,
    };
    this.assertSession(session, address, wallet);
    const signature = await wallet.signTypedData({
      ...quoteTypedData(quote, d.chainId, d.market),
      account: wallet.account ?? address,
    });
    this.assertSession(session, address, wallet);
    this.rememberOrder(quote);
    if (recipient) {
      const { cert, context } = recipient;
      const envelope = await encryptOffer(
        { quote, signature },
        cert,
        context,
        purchaseQuoteCodec(
          { claimId: BigInt(id), source: d.source, sourceVersion: 1n },
          this.client,
        ),
        async (data, signature, signer) =>
          this.client.verifyTypedData({
            ...data,
            address: signer,
            signature,
            blockTag: "latest",
          }),
        registryStatusReader(this.client, d.keyRegistry),
      );
      this.assertSession(session, address, wallet);
      await this.api("publish-envelope", { claimId: id, cert, envelope });
    } else
      await this.api("publish-offer", {
        signed: JSON.parse(serializeSignedQuote({ quote, signature })),
      });
    await this.refresh();
    return {
      status: "confirmed" as const,
      message: `Signed ${mode} offer published; capital is not reserved.`,
    };
  }
  async rotateKey(id: string) {
    await this.ready();
    const { context } = await this.api(`offers?claimId=${id}`);
    localStorage.removeItem(`exit-cert:${context.requestId}`);
    await this.ensureKey(id);
    await this.refresh();
  }
  async revokeKey(id: string) {
    await this.ready();
    const { context } = await this.api(`offers?claimId=${id}`);
    if (context.seller.toLowerCase() !== this.address?.toLowerCase())
      throw new Error("Only the owner can revoke this request key");
    await this.transaction(
      this.config!.keyRegistry,
      OfferKeyRegistryAbi,
      "revoke",
      [context.requestId],
    );
    localStorage.removeItem(`exit-cert:${context.requestId}`);
    await this.refresh();
  }
  get actions(): AppActions {
    return {
      connect: () => this.connect(),
      switchNetwork: () => this.switchNetwork(),
      refresh: () => this.refresh(),
      faucet: () => this.faucet(),
      originate: () => this.originate(),
      requestOffers: (id, mode) => this.requestOffers(id, mode),
      acceptOffer: (id) => this.acceptOffer(id),
      collect: (id) => this.collect(id),
      withdraw: (id) => this.withdraw(id),
      makeOffer: (id, net, mode) => this.makeOffer(id, net, mode),
      cancelOffer: (id) => this.cancelOffer(id),
      unlockPrivateOffers: (id) => this.unlockPrivateOffers(id),
    };
  }
}
