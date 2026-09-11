// Regression fixtures use real HPKE and EOA signatures; only network state is controlled.
import { it, expect, vi, beforeEach } from "vitest";
import { ExitController } from "./controller";
import {
  generateRecipientKey,
  encryptOffer,
  keyBindingTypedData,
  offerRequestId,
  purchaseQuoteCodec,
  encodeJson,
} from "../transport";
import { quoteTypedData } from "../shared/quote";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, sha256, verifyTypedData } from "viem";

const seller = privateKeyToAccount(`0x${"11".repeat(32)}`);
const maker = privateKeyToAccount(`0x${"22".repeat(32)}`);
const market = "0x0000000000000000000000000000000000000010";
const source = "0x0000000000000000000000000000000000000020";
const key = await generateRecipientKey();
const context = {
  chainId: 31337,
  market,
  seller: seller.address,
  requestId: offerRequestId(31337, market, 1n, 0n),
} as const;
const now = Math.floor(Date.now() / 1000);
const binding = {
  ...context,
  version: 1,
  publicKey: key.publicKey,
  validFrom: now - 5,
  validUntil: now + 600,
};
const cert = {
  binding,
  signature: await seller.signTypedData(keyBindingTypedData(binding)),
};
const q = {
  maker: maker.address,
  seller: seller.address,
  buyer: maker.address,
  claimId: 1n,
  source,
  sourceVersion: 1n,
  paymentToken: market,
  netPayment: 9960123456n,
  feeAmount: 0n,
  feeRecipient: "0x0000000000000000000000000000000000000000",
  ownershipEpoch: 0n,
  depletion: 0n,
  deadline: BigInt(now + 300),
  nonce: `0x${"33".repeat(32)}`,
  underwritingHash: `0x${"00".repeat(32)}`,
} as const;
const signed = {
  quote: q,
  signature: await maker.signTypedData(quoteTypedData(q, 31337, market)),
};
const codec = purchaseQuoteCodec({ claimId: 1n, source, sourceVersion: 1n });
const envelope = await encryptOffer(
  signed,
  cert,
  context,
  codec,
  (data, signature, address) =>
    verifyTypedData({ ...data, signature, address }),
  async () => ({
    keyHash: keccak256(key.publicKey),
    version: 1,
    revoked: false,
  }),
);
const bytes = encodeJson(envelope);
const record = {
  ...context,
  reference: "a".repeat(64),
  sha256: sha256(bytes),
  mode: "private",
  keyVersion: 1,
};
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  },
  configurable: true,
});
function controller(allowance = 100000000000n) {
  const c = new ExitController(() => {}) as any;
  c.config = {
    environment: "local",
    chainId: 31337,
    market,
    source,
    token: market,
    keyRegistry: source,
    blockNumber: "0",
    makers: [maker.address],
    storage: "explicit-local-test",
    index: "explicit-local-test",
  };
  c.address = seller.address;
  c.keys = { load: async () => key };
  Object.defineProperty(c, "storage", {
    get: () => ({
      environment: "explicit-local-test",
      retrieve: async () => bytes,
    }),
  });
  Object.defineProperty(c, "client", {
    get: () => ({
      getChainId: async () => 31337,
      getBlock: async () => ({ timestamp: BigInt(now), number: 7n }),
      getContractEvents: async () => [],
      verifyTypedData: (args: any) => verifyTypedData(args),
      readContract: async ({ functionName }: any) =>
        (
          ({
            nextClaimId: 2n,
            positions: [seller.address, 1n, 0n, 0n, 0n, 0n, 0n],
            requests: [
              market,
              10000000000n,
              4000000000n,
              6000000000n,
              BigInt(now),
              0n,
              0n,
              false,
            ],
            remaining: [10000000000n, 0n, 0n],
            balanceOf: 100000000000n,
            allowance,
            unavailable: false,
            keys: [keccak256(key.publicKey), 1n, BigInt(binding.validUntil)],
          }) as Record<string, unknown>
        )[functionName],
    }),
  });
  return c;
}

beforeEach(() => storage.clear());
it("does not publish private plaintext from an older wallet refresh", async () => {
  const c = controller();
  let release!: () => void, reached!: () => void;
  const firstApi = new Promise<void>((r) => (reached = r)),
    suspended = new Promise<void>((r) => (release = r));
  let calls = 0;
  c.api = async () => {
    if (++calls === 1) {
      reached();
      await suspended;
    }
    return { context, certs: [cert], records: [record] };
  };
  const previous = c.refresh();
  await firstApi;
  c.address = maker.address;
  await c.refresh();
  expect(c.data.offers[0].status).toBe("encrypted");
  release();
  await previous;
  expect(c.data.wallet).toBe(maker.address);
  expect(c.data.claims[0].isOwner).toBe(false);
  expect(c.data.offers[0].net).toBeUndefined();
  expect(c.quotes.size).toBe(0);
});
it("retains the verified quote snapshot while a same-wallet refresh is in flight", async () => {
  const c = controller();
  c.api = async () => ({ context, certs: [cert], records: [record] });
  await c.refresh();
  expect(c.data.offers[0].net).toBe("9960.123456");
  let release!: () => void;
  const suspended = new Promise<void>((r) => (release = r));
  c.api = async () => {
    await suspended;
    return { context, certs: [cert], records: [record] };
  };
  const pending = c.refresh();
  expect(c.quotes.size).toBe(1);
  expect(c.data.offers[0].net).toBe("9960.123456");
  release();
  await pending;
  expect(c.quotes.size).toBe(1);
});
it("retains authoritative claim and collection state when discovery is unavailable", async () => {
  const c = controller();
  c.api = async () => {
    throw Error("Discovery unavailable");
  };
  await c.refresh();
  expect(c.data.claims).toHaveLength(1);
  expect(c.data.claims[0].expected).toBe("10000");
  expect(c.data.claims[0].offersUnavailable).toBe(true);
  expect(c.data.claims[0].isOwner).toBe(true);
  expect(c.data.services[0].status).toBe("connected");
  expect(c.data.offers).toEqual([]);
});
it("derives request context from the chain before loading any decryption key", async () => {
  const c = controller();
  c.keys.load = vi.fn(async () => key);
  c.api = async () => ({
    context: { ...context, seller: maker.address },
    certs: [cert],
    records: [record],
  });
  await c.refresh();
  expect(c.keys.load).not.toHaveBeenCalled();
  expect(c.data.offers).toEqual([]);
  expect(c.data.claims[0].offersUnavailable).toBe(true);
});
it("republishes a valid local certificate after a failed or lost discovery registration", async () => {
  const c = controller();
  storage.set(`exit-cert:${context.requestId}`, JSON.stringify(cert));
  const publish = vi
    .fn()
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValue({});
  c.api = async (path: string) =>
    path === "binding" ? publish() : { context, certs: [], records: [] };
  await expect(c.ensureKey("1")).rejects.toThrow("Offline");
  await expect(c.ensureKey("1")).resolves.toEqual(cert);
  expect(publish).toHaveBeenCalledTimes(2);
});
it("makes no approval or signature when a private recipient is unavailable", async () => {
  const c = controller(0n);
  c.address = maker.address;
  c.ready = async () => maker.address;
  c.wallet = { account: maker, signTypedData: vi.fn() };
  c.transaction = vi.fn();
  c.api = async () => ({ context, certs: [], records: [] });
  await expect(c.makeOffer("1", "9960.123456", "private")).rejects.toThrow(
    "not registered",
  );
  expect(c.transaction).not.toHaveBeenCalled();
  expect(c.wallet.signTypedData).not.toHaveBeenCalled();
});
for (const allowance of [0n, 100000000000n])
  it(`uses independent capital, not private price, with allowance ${allowance}`, async () => {
    const c = controller(allowance);
    c.address = maker.address;
    c.ready = async () => maker.address;
    c.wallet = {
      account: maker,
      signTypedData: (args: any) => maker.signTypedData(args),
    };
    c.transaction = vi.fn(async () => ({ status: "confirmed" }));
    c.refresh = vi.fn(async () => {});
    let uploaded: any;
    c.api = async (path: string, body: any) => {
      if (path === "publish-envelope") uploaded = body;
      return { context, certs: [cert], records: [] };
    };
    await c.makeOffer("1", "9960.123456", "private");
    if (allowance === 0n) {
      expect(c.transaction).toHaveBeenCalledTimes(1);
      expect(c.transaction.mock.calls[0][3][1]).toBe(100000000000n);
    } else expect(c.transaction).not.toHaveBeenCalled();
    expect(uploaded.envelope.ciphertext).toMatch(/^0x/);
    expect(JSON.stringify(uploaded)).not.toContain("9960123456");
    expect(JSON.stringify(uploaded)).not.toContain("9960.123456");
  });
it("rejects a bid above an insufficient disclosed capital limit without authorizing it", async () => {
  const c = controller(0n);
  c.address = maker.address;
  c.ready = async () => maker.address;
  c.wallet = { account: maker, signTypedData: vi.fn() };
  c.transaction = vi.fn();
  await expect(c.makeOffer("1", "100001", "public")).rejects.toThrow(
    "spending limit",
  );
  expect(c.transaction).not.toHaveBeenCalled();
});
it("scrubs decrypted view on injected wallet events and removes listeners on disposal", async () => {
  const c = controller();
  const handlers = new Map<string, Function>();
  const provider = {
    on: (event: string, fn: Function) => handlers.set(event, fn),
    removeListener: (event: string) => handlers.delete(event),
  };
  vi.stubGlobal("window", { ethereum: provider });
  c.config.environment = "fuji";
  c.refresh = vi.fn(async () => {});
  c.data = {
    ...c.data,
    wallet: seller.address,
    offers: [{ net: "9960.123456", mode: "private" }],
    claims: [{ isOwner: true, cost: "9960.123456" }],
  };
  c.watchProvider();
  handlers.get("accountsChanged")!([maker.address]);
  expect(c.data.wallet).toBe(maker.address);
  expect(c.data.offers).toEqual([]);
  expect(c.data.claims[0].isOwner).toBe(false);
  handlers.get("disconnect")!();
  expect(c.data.wallet).toBeUndefined();
  c.dispose();
  expect(handlers.size).toBe(0);
  vi.unstubAllGlobals();
});
