import { createPublicClient, createWalletClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { ExpirationTime } from "@arkiv-network/sdk/utils";
import { http, webSocket, type Account } from "viem";
import type { IssuerState, SnapshotRef } from "./bytes";
const encoder = new TextEncoder();
export function statusAttributes(s: IssuerState) {
  return {
    application: "qualification-experiment",
    kind: "issuer-status",
    schema: 1,
    issuer: s.issuerId,
    epoch: s.epoch,
    root: s.root,
    settlementChain: s.chainId,
    authority: s.authority.toLowerCase(),
  };
}
function valid(s: SnapshotRef): boolean {
  return (
    typeof s.issuerId === "string" &&
    s.issuerId.length > 0 &&
    s.issuerId.length <= 128 &&
    Number.isSafeInteger(s.epoch) &&
    s.epoch >= 0 &&
    /^(0|[1-9][0-9]*)$/.test(s.root) &&
    /^0x[0-9a-f]{40}$/i.test(s.authority) &&
    Number.isSafeInteger(s.chainId) &&
    s.chainId > 0 &&
    /^[0-9a-f]{64}$/i.test(s.reference) &&
    /^0x[0-9a-f]{64}$/i.test(s.sha256)
  );
}
export function arkivStatusIndex(config: {
  rpcUrl?: string;
  wsUrl?: string;
  account?: Account;
}) {
  const reads = createPublicClient({
    chain: tiramisu,
    transport: http(config.rpcUrl, { timeout: 12000, retryCount: 0 }),
  });
  return {
    environment: "public-arkiv" as const,
    async publish(snapshot: SnapshotRef, seconds: number) {
      if (!config.account) throw Error("Funded Arkiv signing account required");
      if (
        !valid(snapshot) ||
        !Number.isSafeInteger(seconds) ||
        seconds < 5 ||
        seconds > 86400
      )
        throw Error("Invalid status publication");
      // Explicit projection prevents accidental credential fields being serialized by callers.
      const payload: SnapshotRef = {
        issuerId: snapshot.issuerId,
        epoch: snapshot.epoch,
        root: snapshot.root,
        chainId: snapshot.chainId,
        authority: snapshot.authority,
        reference: snapshot.reference,
        sha256: snapshot.sha256,
      };
      try {
        if ((await reads.getChainId()) !== tiramisu.id)
          throw Error("Wrong Arkiv network");
        const wallet = createWalletClient({
          chain: tiramisu,
          account: config.account,
          transport: http(config.rpcUrl),
        });
        return await wallet.createEntity({
          payload: encoder.encode(JSON.stringify(payload)),
          contentType: "application/json",
          attributes: statusAttributes(payload),
          expires: ExpirationTime.fromSeconds(seconds),
          flags: { readonly: true },
        });
      } catch {
        throw Error("Arkiv publication failed");
      }
    },
    async discover(trusted: IssuerState): Promise<SnapshotRef[]> {
      try {
        if ((await reads.getChainId()) !== tiramisu.id)
          throw Error("Wrong Arkiv network");
        let page = await reads
          .select({ key: true, payload: true })
          .where(
            ...Object.entries(statusAttributes(trusted)).map(([k, v]) =>
              eq(k, v),
            ),
          )
          .limit(100)
          .fetch();
        const result: SnapshotRef[] = [];
        for (;;) {
          for (const entity of page.entities) {
            try {
              const s = JSON.parse(
                new TextDecoder("utf-8", { fatal: true }).decode(
                  entity.payload,
                ),
              ) as SnapshotRef;
              if (
                valid(s) &&
                s.issuerId === trusted.issuerId &&
                s.epoch === trusted.epoch &&
                s.root === trusted.root &&
                s.chainId === trusted.chainId &&
                s.authority.toLowerCase() === trusted.authority.toLowerCase()
              )
                result.push(s);
            } catch {
              /* public malformed records are not authority */
            }
          }
          if (!page.hasNextPage()) break;
          page = await page.next();
        }
        return result;
      } catch {
        throw Error("Arkiv discovery failed");
      }
    },
    /** An event is a refresh hint, never credential revocation or proof authority. No historical start block. */
    watch(onChange: () => void, onError: () => void) {
      const live = createPublicClient({
        chain: tiramisu,
        transport: webSocket(
          config.wsUrl ?? "wss://rpc.tiramisu.db-chain.testnet.arkiv.network",
          { timeout: 12000 },
        ),
      });
      return live.watchEntityEvents({ onEvent: onChange, onError });
    },
  };
}
