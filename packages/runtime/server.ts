import { createServer } from "node:http";
import { MutationQueue, readJsonBody, RequestError } from "./request";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import {
  keccak256,
  toHex,
  zeroAddress,
  zeroHash,
  maxUint256,
  type Hex,
  type Address,
} from "viem";
import { loadDeployment, publicFor, walletFor, artifact } from "./chain";
import { createServices } from "./services";
import { parseSignedQuote, quoteTypedData } from "../shared/quote";
import { TestUSDCAbi } from "../shared/TestUSDC";
import {
  purchaseQuoteCodec,
  publishPrivateOffer,
  publishPublicOffer,
  offerRequestId,
  validateBinding,
  encodeJson,
  type SignedKeyBinding,
  type RequestContext,
  type OfferRecord,
} from "../transport";
const d = await loadDeployment(),
  client = publicFor(d),
  services = await createServices(d);
const market = await artifact("ExitMarket"),
  registry = await artifact("OfferKeyRegistry");
const bindingDir = `${process.env.EXIT_DATA_DIR ?? (d.environment === "local" ? ".runtime/local" : ".runtime/fuji")}/bindings`;
await mkdir(bindingDir, { recursive: true });
const contextFor = async (id: bigint) => {
  const p = (await client.readContract({
    address: d.market,
    abi: market.abi,
    functionName: "positions",
    args: [id],
  })) as [Address, bigint, bigint, bigint, bigint, bigint, bigint];
  if (p[0] === zeroAddress) throw new RequestError("Claim does not exist");
  const context: RequestContext = {
    chainId: d.chainId,
    market: d.market,
    seller: p[0],
    requestId: offerRequestId(d.chainId, d.market, id, p[2]),
  };
  return { p, context };
};
const bindingStatus = async (c: RequestContext) => {
  const r = (await client.readContract({
    address: d.keyRegistry,
    abi: registry.abi,
    functionName: "keys",
    args: [c.seller, c.requestId],
  })) as [Hex, bigint, bigint];
  return {
    keyHash: r[0],
    version: Number(r[1]),
    revoked: r[0] === zeroHash || r[2] <= BigInt(Math.floor(Date.now() / 1000)),
  };
};
const verifyBinding = async (data: any, signature: Hex, signer: Address) =>
  client.verifyTypedData({
    ...data,
    address: signer,
    signature,
    blockTag: "latest",
  });

let windowStart = Date.now(),
  budget = 0;
const lastRequest = new Map<string, number>();
const mutationQueue = new MutationQueue();
const mutationRoutes = new Set([
  "/api/request-offers",
  "/api/binding",
  "/api/publish-envelope",
  "/api/publish-offer",
]);
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5173");
  res.setHeader("Cache-Control", "no-store");
  const send = (status: number, value: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(value, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    );
  };
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST");
    res.writeHead(204);
    res.end();
    return;
  }
  let release: (() => void) | undefined;
  const disconnected = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) disconnected.abort();
  };
  res.once("close", onClose);
  try {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    let body: Record<string, any> | undefined;
    if (req.method === "POST") {
      if (!mutationRoutes.has(u.pathname)) {
        res.setHeader("Connection", "close");
        send(404, { error: "Route not found" });
        return;
      }
      // Incomplete bodies never hold signer locks. Parsing errors precede queue admission.
      body = await readJsonBody(req);
      release = await mutationQueue.acquire(disconnected.signal);
    }
    if (req.method === "GET" && u.pathname === "/api/config") {
      send(200, {
        ...d,
        storage: services.storage.environment,
        index: services.index.environment,
        teamMakers: d.makers,
      });
      return;
    }
    if (req.method === "GET" && u.pathname === "/api/offers") {
      const { context } = await contextFor(
        BigInt(u.searchParams.get("claimId") ?? "0"),
      );
      const [publicRecords, privateRecords] = await Promise.all([
        services.index.discover(context, "public"),
        services.index.discover(context, "private"),
      ]);
      const certs: SignedKeyBinding[] = [];
      const active = await bindingStatus(context);
      for (const version of new Set([
        ...privateRecords.map((r) => r.keyVersion),
        active.version,
      ])) {
        try {
          certs.push(
            JSON.parse(
              await readFile(
                `${bindingDir}/${context.requestId}-${version}.json`,
                "utf8",
              ),
            ),
          );
        } catch {}
      }
      send(200, {
        context,
        records: [...publicRecords, ...privateRecords],
        certs,
      });
      return;
    }
    if (req.method === "GET" && u.pathname.startsWith("/api/records/")) {
      const reference = u.pathname.slice("/api/records/".length);
      const digest = u.searchParams.get("sha256") as Hex;
      const bytes = await services.storage.retrieve({
        reference,
        sha256: digest,
      });
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      res.end(bytes);
      return;
    }
    if (req.method === "POST" && u.pathname === "/api/request-offers") {
      const b = body!;
      const rateKey = `${b.claimId}:${b.mode}`;
      if (d.environment === "fuji") {
        if (Date.now() - windowStart > 3600000) {
          windowStart = Date.now();
          budget = 0;
        }
        if (
          budget + 3 > 100 ||
          Date.now() - (lastRequest.get(rateKey) ?? 0) < 30000
        )
          throw new RequestError(
            "Demo quote publication budget is temporarily unavailable; retry later.",
          );
        budget += 3;
        lastRequest.set(rateKey, Date.now());
      }
      if (b.mode !== "public" && b.mode !== "private")
        throw new RequestError("Choose offer visibility");
      const id = BigInt(b.claimId),
        { p, context } = await contextFor(id);
      const codec = purchaseQuoteCodec(
        { claimId: id, source: d.source, sourceVersion: 1n },
        client,
      );
      // Quotes never reserve capital. Every maker uses its own distinct signer and approved balance.
      const expected = (await client.readContract({
        address: d.source,
        abi: (await artifact("TestWithdrawalVault")).abi,
        functionName: "requests",
        args: [p[1]],
      })) as [Address, bigint, bigint, bigint, bigint, bigint, bigint, boolean];
      const remaining = (await client.readContract({
        address: d.market,
        abi: market.abi,
        functionName: "remaining",
        args: [id],
      })) as [bigint, bigint, bigint];
      const residual = expected[1] - p[5];
      if (residual <= 0n || remaining.reduce((a, b) => a + b, 0n) === 0n)
        throw new RequestError(
          "No standard remaining payout to price; inspect recovery separately",
        );
      let count = 0;
      for (let i = 1; i <= 3; i++) {
        const maker = walletFor(d, i);
        if (maker.account.address.toLowerCase() === p[0].toLowerCase())
          continue;
        // Team-operated test makers replenish only their own valueless token capital/approval.
        const makerBalance = await client.readContract({
          address: d.token,
          abi: TestUSDCAbi,
          functionName: "balanceOf",
          args: [maker.account.address],
        });
        if (makerBalance < 100000n * 1000000n) {
          const hash = await maker.writeContract({
            address: d.token,
            abi: TestUSDCAbi,
            functionName: "faucet",
          });
          if (
            (await client.waitForTransactionReceipt({ hash })).status !==
            "success"
          )
            throw new RequestError("Demo maker test funding failed");
        }
        const allowance = await client.readContract({
          address: d.token,
          abi: TestUSDCAbi,
          functionName: "allowance",
          args: [maker.account.address, d.market],
        });
        if (allowance < residual) {
          const hash = await maker.writeContract({
            address: d.token,
            abi: TestUSDCAbi,
            functionName: "approve",
            args: [d.market, maxUint256],
          });
          if (
            (await client.waitForTransactionReceipt({ hash })).status !==
            "success"
          )
            throw new RequestError("Demo maker capital authorization failed");
        }
        const q = {
          maker: maker.account.address,
          seller: p[0],
          buyer: maker.account.address,
          claimId: id,
          source: d.source,
          sourceVersion: 1n,
          paymentToken: d.token,
          netPayment:
            (residual *
              BigInt(
                b.mode === "private"
                  ? 990000 +
                      (crypto.getRandomValues(new Uint32Array(1))[0] % 6001)
                  : [996000, 994000, 990000][i - 1],
              )) /
            1000000n,
          feeAmount: 0n,
          feeRecipient: zeroAddress,
          ownershipEpoch: p[2],
          depletion: p[3],
          deadline: (await client.getBlock()).timestamp + 300n,
          nonce: keccak256(crypto.getRandomValues(new Uint8Array(32))),
          underwritingHash: zeroHash,
        };
        const signed = {
          quote: q,
          signature: await maker.signTypedData(
            quoteTypedData(q, d.chainId, d.market),
          ),
        };
        if (b.mode === "private") {
          if (!b.cert)
            throw new RequestError(
              "Seller must register a recipient key first",
            );
          await publishPrivateOffer(
            signed,
            b.cert,
            context,
            codec,
            verifyBinding,
            bindingStatus,
            services,
            360,
          );
          await writeFile(
            `${bindingDir}/${context.requestId}-${b.cert.binding.version}.json`,
            JSON.stringify(b.cert),
          );
        } else await publishPublicOffer(signed, context, codec, services, 360);
        count++;
      }
      send(200, {
        count,
        message: `${count} team-operated maker offers published. No capital reservation.`,
      });
      return;
    }
    if (req.method === "POST" && u.pathname === "/api/binding") {
      const b = body!,
        { context } = await contextFor(BigInt(b.claimId));
      await validateBinding(b.cert, context, verifyBinding, bindingStatus);
      await writeFile(
        `${bindingDir}/${context.requestId}-${b.cert.binding.version}.json`,
        JSON.stringify(b.cert),
      );
      send(200, { registered: true });
      return;
    }
    if (req.method === "POST" && u.pathname === "/api/publish-envelope") {
      if (d.environment === "fuji") {
        if (Date.now() - windowStart > 3600000) {
          windowStart = Date.now();
          budget = 0;
        }
        if (++budget > 100)
          throw new RequestError(
            "Demo publication budget exhausted for this hour",
          );
      }
      const b = body!,
        { context } = await contextFor(BigInt(b.claimId));
      await validateBinding(b.cert, context, verifyBinding, bindingStatus);
      const e = b.envelope;
      if (
        e.format !== "exit-private-offer" ||
        e.version !== 1 ||
        e.chainId !== context.chainId ||
        e.market.toLowerCase() !== context.market.toLowerCase() ||
        e.seller.toLowerCase() !== context.seller.toLowerCase() ||
        e.requestId !== context.requestId ||
        e.keyVersion !== b.cert.binding.version ||
        e.keyHash !== keccak256(b.cert.binding.publicKey) ||
        !/^0x[0-9a-f]+$/i.test(e.ciphertext) ||
        !/^0x[0-9a-f]+$/i.test(e.encapsulatedKey)
      )
        throw new RequestError("Envelope routing rejected");
      const allowed = {
        format: e.format,
        version: 1,
        chainId: context.chainId,
        market: context.market.toLowerCase(),
        seller: context.seller.toLowerCase(),
        requestId: context.requestId,
        keyVersion: e.keyVersion,
        keyHash: e.keyHash,
        encapsulatedKey: e.encapsulatedKey,
        ciphertext: e.ciphertext,
      };
      const stored = await services.storage.upload(encodeJson(allowed));
      const record: OfferRecord = {
        ...context,
        ...stored,
        mode: "private",
        keyVersion: e.keyVersion,
      };
      const result = await services.index.publish(record, 360);
      send(200, result);
      return;
    }
    if (req.method === "POST" && u.pathname === "/api/publish-offer") {
      if (d.environment === "fuji") {
        if (Date.now() - windowStart > 3600000) {
          windowStart = Date.now();
          budget = 0;
        }
        if (++budget > 100)
          throw new RequestError(
            "Demo publication budget exhausted for this hour",
          );
      }
      const b = body!,
        signed = parseSignedQuote(JSON.stringify(b.signed)),
        { context } = await contextFor(signed.quote.claimId);
      const codec = purchaseQuoteCodec(
        { claimId: signed.quote.claimId, source: d.source, sourceVersion: 1n },
        client,
      );
      const result = await publishPublicOffer(
        signed,
        context,
        codec,
        services,
        360,
      );
      send(200, result);
      return;
    }
    send(404, { error: "Route not found" });
  } catch (e) {
    if (res.destroyed) return;
    if (e instanceof RequestError && e.closeConnection)
      res.setHeader("Connection", "close");
    if (e instanceof RequestError && e.status === 503)
      res.setHeader("Retry-After", "1");
    send(e instanceof RequestError ? e.status : 400, {
      error:
        e instanceof RequestError
          ? e.message
          : "Chain, signing or storage service unavailable. Check configuration and retry; no plaintext fallback is used.",
    });
  } finally {
    res.off("close", onClose);
    release?.();
  }
});
server.listen(8787, "127.0.0.1", () =>
  console.log(
    `EXIT API ready :8787; ${d.environment}; index=${services.index.environment}; storage=${services.storage.environment}`,
  ),
);
