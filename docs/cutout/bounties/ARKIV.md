# Arkiv — expiring, live task discovery

[All bounties](../BOUNTIES.md) · [Schema](../../../arkiv/schema.md) · [Feedback](../../../feedback.md)

**Arkiv is Cutout's shared public recruiting board.** A client publishes a wallet-owned advertisement for an already-funded Fuji task. Other clients can query the same records without depending on Cutout's private database. Native expiry bounds the recruiting lease; subscriptions make the board respond to changes.

A conventional database could render a board. Arkiv is used here for publicly queryable, wallet-owned records with protocol-level expiry and a common event stream. Fuji remains the financial authority: an advertisement does not prove funding by itself.

## Implementation

[Listing adapter](../../../experiments/qualification/pilot/listings.ts) uses the pinned Arkiv SDK against Tiramisu. Public attributes identify the app/schema, settlement deployment, task, qualification class and reward. Compound queries select relevant work. The app verifies entity ownership, exact task terms and current eligibility against finalized Fuji state before enabling acceptance. [Full schema and privacy boundaries](../../../arkiv/schema.md).

The browser uses WebSocket entity subscriptions and new heads, filters relevant events and queries to reconcile the board. Reconnection queries current state. There is no fixed polling loop. Head notifications let the app recheck native expiration even when no new entity is written; expiration itself is on Arkiv, not a JavaScript delete job.

## Mission 02 — Built to expire

The listing is a time-limited invitation to take work. Arkiv native expiry removes it from active discovery without cancelling the Fuji task or destroying escrow rights. The UI also checks Fuji deadlines/state, so stale advertisements cannot independently authorize work.

**Required recording:** create a real listing with a short usable lifetime; save creation transaction, entity key and expiration block. Run the exact same query before and after native expiry. Show the board changing through the subscription path and verify the Fuji task remains intact. Do not delete the record or substitute a client-only timer. Choose a task whose Fuji acceptance window lasts beyond the Arkiv lease, so the demonstrated disappearance is actually caused by Arkiv expiry.

## Mission 03 — Live wire

**Required recording:** open two fresh browser sessions on the same board/filter. Use the task creator in A to publish a real listing. B must update through the subscription stream without reloading or pressing Refresh. Capture subscription status, entity/transaction IDs and observed update. Then verify reconnection reconciliation separately.

Actual public socket traffic and fault/reconnect probes exist. Events written by other applications, synthetic wallet requests or healthy socket counts alone are not this mission's two-user product demonstration.

## Evidence and remaining work

**Completed public mission sequence, 13 September:** creator browser published task #4; a separate reviewer browser received the listing through its existing WebSocket board. The same query returned the entity at block 377455 and no entity at its native expiration block 377474. The board removed it while the funded Fuji task stayed Open. No delete transaction or manual refresh was used. [Query, entity and transaction evidence](../evidence/saved-pass/arkiv-missions.json), [browser capture and verification boundaries](../evidence/saved-pass/README.md).

| Evidence | Actual scope |
| --- | --- |
| [Public state observation](../../design/cutout/evidence/presenter/public-state.json) | Finalized funded-task state at a recorded time; separate browser artifacts below cover discovery |
| [Subscription/reconnect probes](../../design/cutout/evidence/release-followup/README.md) | Public WebSocket traffic and intentionally injected connection faults; no mission publication sequence |
| [Publication recovery](../../design/cutout/evidence/enrollment-publication/README.md) | Real network reads with synthetic wallet errors/cancellation; diagnosis and actual test gas top-up |
| [Schema](../../../arkiv/schema.md), [submission matrix](../../../arkiv/submission.md) | Implemented data model and current submission artifacts |
| [Feedback and first-user plan](../../../feedback.md) | Observed integration friction and a recruitment hypothesis |

The public mission sequence above has recorded browser/query evidence. A final presentation video is still needed. The wallet bridge signs operator-controlled test accounts; this does not claim two independent human testers. The [current Arkiv hub](https://hub.arkiv.network/ethrome) is the requirements authority. We target Missions 02/03 and Best Use consideration; we do not claim Mission 01's indexer replacement, and only one Arkiv award can be won per team.
