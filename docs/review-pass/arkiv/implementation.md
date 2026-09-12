# Review Pass listings implementation contract

Proposed next bounded ownership: `experiments/qualification/pilot/listings.ts` and `listings.test.ts`. Root owns server/UI, contracts, shared configuration, ABI and deployment. Do not begin code until root provides the new shared base and confirms contract terms shape.

## Public data shape

```ts
type PublicScope = { reference: string; sha256: `0x${string}` };
type Listing = {
  schema: 2;
  taskClass: 'technical-review';
  qualificationClass: string; // canonical uint32 decimal
  settlementChain: number;
  escrow: `0x${string}`;
  jobId: string; // canonical uint256 decimal
  client: `0x${string}`;
  paymentToken: `0x${string}`;
  reward: string; // base units, canonical uint256 decimal
  acceptBefore: number; // Unix seconds
  title: string; // intentionally public, <=120 UTF8 bytes
  publicScope: PublicScope;
};
type ListingEntity = {
  key: `0x${string}`; owner: `0x${string}`; creator: `0x${string}`;
  expiresAt: bigint; readonly: boolean; permissionlessExtension: boolean;
  listing: Listing;
};
type ListingFilter = {
  namespace: string; taskClass: 'technical-review'; qualificationClass: string;
  settlementChain: number; escrow: `0x${string}`;
  paymentToken?: `0x${string}`; minimumReward?: string;
};
```

Use namespace chosen by root and schema2 to distinguish existing experiment. JSON field camelCase is harmless; all Arkiv indexed attribute names are lowercase. Native expiration is selected metadata, never a user-provided timestamp. `publicScope` replaces old `encryptedBrief`. Root must bind scope ref/digest via contract terms; otherwise return no actionable result.

## Exported interfaces

- `projectListing(value: unknown): Listing` validates and explicitly projects nested public fields. No caller spread. UTF8 byte limits and exact uint bounds; no float token arithmetic.
- `listingAttributes(namespace, listing)` produces lowercase typed attributes. Reward `u256`, acceptance Unix seconds `u64`.
- `listingQuery(filter)` returns a frozen compound predicate set independent of wall-clock time. Logical contract deadline validation belongs in verifier callback, not native-expiry evidence query mutation.
- `createListingBoard({driver, verify, onState, maxHydrations?})` owns lifecycle/state, accepts injectable transport for tests. `verify(entity): Promise<boolean>` is implemented by root against Fuji; must validate creator/owner policy and exact contract terms. Event metadata is never sufficient authority.
- Returned `{start(filter), refresh(), stop()}`. `start` creates generation, installs live subscriptions, reads initial full snapshot, and coalesces an additional refresh if stream changed during initial query. No setInterval. `refresh` is explicit user/reconnect/event boundary, not automatic loop.
- `createArkivListingDriver({rpcUrl, wsUrl, namespace, account?})` checks chain identity, queries/paginates using HTTP and subscribes with WSS/no historical start block. Public writes require explicitly supplied account; do not create private keys or search unrelated wallets.
- `driver.publish(listing, leaseBlocks)` writes immutable entity with permissionless extension disabled. Return `{entityKey, txHash, expiresAt}` from actual receipt. `driver.extend(entityKey, leaseBlocks)` is optional separate client action; verify the actual later resulting expiry. Never revive old deleted/expired identity silently.
- `onState({status:'connecting'|'live'|'stale'|'error'|'stopped', listings, removed, head, reason?})`: bounded public error categories. `removed` may identify prior key as `native-expired` only after a fresh successful query at/after known expiry shows it absent. Otherwise generic no-longer-listed/ownership-changed. Unknown failures never become empty success.

## Stream strategy

Use `watchEntityEvents` and `watchBlockNumber({poll:false})` on a real websocket client. Subscription API has no arbitrary attribute filter; bounded event-driven hydration must inspect actual attributes, owner and namespace. Known entity changes can directly trigger a coalesced query. Unknown creations require bounded getEntity, skip unrelated namespace/class/contract; owner is only preliminary filtering. No timer-based querying. One in-flight snapshot plus dirty bit, bounded key queue and concurrency. On overflow mark stale and do one full reconciliation; do not launch unlimited hydration.

New heads trigger a query only when a tracked native expiry is crossed or after recovery from a detected socket failure. On disconnect mark stale; first resumed head reconciles current query state. Initial stream-before-query sequencing plus dirty bit avoids a missed-creation gap. Root may explicitly call refresh when returning to a tab; label user-initiated refresh honestly. Unsubscribe and invalidate pending promises on stop/filter/account change. Never introduce fromBlock into the live watcher to solve recovery.

## Required unit/integration cases

1. Strict public projection drops credential/private fields, rejects malformed nested references, unsafe numbers, uint overflow, oversized title and wrong schema.
2. Typed lowercase predicates include namespace/class/chain/escrow and real optional reward/token range. Same query serializes identically before/after a simulated head change.
3. Complete pagination, positive record on page2, malformed records ignored, attacker duplicate rejected before valid record deduplication.
4. Verifier rejection prevents action; network/verification exceptions mark unavailable without fixture fallback.
5. Before lease expiry record visible; after head boundary it stays pending until fresh query absence, then native-expired. No delete call. A failed boundary query cannot claim expiration.
6. Renewal moves expiry later and old boundary does not remove record. Irrelevant event does not repaint unrelated view.
7. Relevant second-client create hydrates and adds result. No refresh interval or startblock permitted; transport injection asserts websocket path.
8. Event during initial snapshot sets dirty reconciliation; late earlier result cannot overwrite newer generation.
9. Duplicate event, event/entity deletion race, queued burst, bounded overflow and concurrency are deterministic.
10. Disconnect marks stale, resumed head triggers snapshot, missed-created live record recovered, expired record removed, stopped callback cannot repaint.
11. Root UI test: native lease disappears on public board while client’s own funded escrow remains visible and recoverable; accepted work is never erased by index expiry.
12. Public evidence gate: funded Tiramisu creation, short natural lease, exact same query before/after with receipt/head provenance, real two-client writes/UI updates, irrelevant change, dropped socket/reconnect and trace showing no periodic query loop.

Local injected tests and the read-only socket probe are necessary groundwork. They do not establish funded public mission completion. Root must expose public deployment and prepare form evidence before claiming bounty readiness.
