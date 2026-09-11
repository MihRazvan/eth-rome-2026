import { createPublicClient, createWalletClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { eq } from '@arkiv-network/sdk/query';
import { ExpirationTime } from '@arkiv-network/sdk/utils';
import { http, type Account } from 'viem';
import { encodeJson, type RequestContext } from './privacy';
import { type StoredBytes } from './swarm';
export const ARKIV_NETWORK = tiramisu;
export interface OfferRecord extends RequestContext, StoredBytes {
  mode: 'public' | 'private';
  keyVersion: number;
}
export interface IndexTransport {
  readonly environment: 'arkiv' | 'explicit-local-test';
  publish(record: OfferRecord, lifetimeSeconds: number): Promise<{ entityKey: string; txHash: string; expiresAt: bigint }>;
  discover(context: RequestContext, mode: OfferRecord['mode']): Promise<OfferRecord[]>;
}
export interface Page<T> { entities: readonly T[]; hasNextPage(): boolean; next(): Promise<Page<T>> }
/** SDK 0.8.1 pages are immutable; next() returns the next page. Never sort only the first page. */
export async function allPages<T>(first: Page<T>): Promise<T[]> {
  const items: T[] = [];
  let page = first;
  do {
    items.push(...page.entities);
    if (!page.hasNextPage()) return items;
    page = await page.next();
  } while (true);
}
export function offerAttributes(record: OfferRecord) {
  // Explicit allowlist. Never spread a quote into the public index.
  return { app: 'exit', kind: 'offer', schema: 1, settlementChain: record.chainId,
    market: record.market.toLowerCase(), seller: record.seller.toLowerCase(), request: record.requestId,
    mode: record.mode, keyVersion: record.keyVersion };
}
export function createArkivIndex(config: { rpcUrl?: string; account?: Account }): IndexTransport {
  const publicClient = createPublicClient({ chain: tiramisu, transport: http(config.rpcUrl) });
  return {
    environment: 'arkiv',
    async publish(record, lifetimeSeconds) {
      if (!config.account) throw new Error('Arkiv publication requires a funded signing account');
      const client = createWalletClient({ chain: tiramisu, account: config.account, transport: http(config.rpcUrl) });
      return await client.createEntity({ payload: encodeJson(record), contentType: 'application/json',
        attributes: offerAttributes(record), expires: ExpirationTime.fromSeconds(lifetimeSeconds), flags: { readonly: true } });
    },
    async discover(context, mode) {
      const query = publicClient.select({ key: true, payload: true }).where(
        eq('app', 'exit'), eq('kind', 'offer'), eq('schema', 1), eq('settlementChain', context.chainId),
        eq('market', context.market.toLowerCase()), eq('seller', context.seller.toLowerCase()),
        eq('request', context.requestId), eq('mode', mode),
      ).limit(200);
      const entities = await allPages(await query.fetch());
      const records: OfferRecord[] = [];
      for (const entity of entities) {
        try {
          const r = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(entity.payload)) as OfferRecord;
          if (r.chainId === context.chainId && r.market.toLowerCase() === context.market.toLowerCase() &&
            r.seller.toLowerCase() === context.seller.toLowerCase() && r.requestId === context.requestId && r.mode === mode &&
            /^[a-f0-9]{64}$/i.test(r.reference) && /^0x[a-f0-9]{64}$/i.test(r.sha256) && Number.isSafeInteger(r.keyVersion)) records.push(r);
        } catch { /* Malformed public records are ignored, never shown as valid offers. */ }
      }
      return records;
    },
  };
}
