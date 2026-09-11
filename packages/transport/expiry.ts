import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { eq } from '@arkiv-network/sdk/query';
import { http, type Account } from 'viem';
import { allPages, createArkivIndex, type OfferRecord } from './arkiv';
/** Live evidence only. Publishes an actual already-stored offer, queries fresh head identically, never deletes. */
export async function proveNativeOfferExpiry(config: { rpcUrl?: string; account: Account; record: OfferRecord;
  lifetimeSeconds?: number; timeoutMs?: number; progress?: (event: unknown) => void }) {
  const seconds = config.lifetimeSeconds ?? 12;
  const client = createPublicClient({ chain: tiramisu, transport: http(config.rpcUrl, { timeout: 12000, retryCount: 0 }) });
  const record = config.record;
  const freshQuery = () => client.select({ key: true }).where(eq('app', 'exit'), eq('kind', 'offer'), eq('schema', 1),
    eq('settlementChain', record.chainId), eq('market', record.market.toLowerCase()), eq('seller', record.seller.toLowerCase()),
    eq('request', record.requestId), eq('mode', record.mode));
  const publication = await createArkivIndex({ rpcUrl: config.rpcUrl, account: config.account }).publish(record, seconds);
  const inspect = async () => {
    const keys = (await allPages(await freshQuery().fetch())).map(entity => entity.key);
    return { block: (await client.getBlockNumber()).toString(), observedAt: new Date().toISOString(),
      present: keys.includes(publication.entityKey as `0x${string}`), keys };
  };
  const before = await inspect();
  if (!before.present) throw new Error('Expiring offer was not observed before native expiry');
  config.progress?.({ stage: 'before-expiry', ...before });
  const timeoutAt = Date.now() + (config.timeoutMs ?? 90000);
  while (Date.now() < timeoutAt) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const after = await inspect();
    config.progress?.({ stage: 'fresh-query', block: after.block, present: after.present });
    if (!after.present) return { status: 'passed', environment: 'arkiv-live', query: freshQuery().toString(),
      entityKey: publication.entityKey, txHash: publication.txHash, nativeExpiresAt: publication.expiresAt.toString(), before, after,
      deleteCalls: 0, quoteDeadlineUnchanged: true };
  }
  throw new Error('Native expiry was not observed before the probe timeout');
}
