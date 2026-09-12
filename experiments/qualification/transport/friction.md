# Qualification transport friction and actual evidence

Updated 12 September 2026. These notes describe observed implementation issues and precise remaining gates; no sponsor contact or submission occurred.

- **Native expiry uses Arkiv block height.** SDK 0.8.1 `src/utils/expirationTime.ts` says `atDate` rounds up against the transaction's block. A Fuji acceptance deadline cannot be interpreted as exactly synchronized expiration on Arkiv. We use the absolute-date helper plus an indexed logical deadline and require Fuji contract checks. A funded receipt/expiry experiment remains blocked by unavailable configured project signer/funds. The adapter has not proved native assignment expiry.
- **Numeric attribute types matter.** The deadline query uses `u64(BigInt(seconds))`; untyped JavaScript numbers become `i32`. The fresh public query at block 345276 returned successfully with the typed `acceptBefore > u64(1789198906)` predicate. Qualification classes remain canonical strings and are explicitly limited to uint32 to match the circuit; reward amounts never pass through floating point. No failed live numeric query is claimed.
- **Public attributes are not authenticated contract state.** A caller can publish plausible metadata for another escrow. We require explicit authoritative verification and discard rejected records before deduplication. Unit tests cover malicious duplicate ordering, wrong chain, stale deadlines and poisoned private fields. This is an application trust boundary, not a reported Arkiv defect.
- **Readability is verified; funded application writes are not.** `assignment-query-evidence.json` records 2026-09-12T07:41:46.178Z, Tiramisu chain 7738577/block 345276, eight predicates, one page, zero matching entities, 729 ms. The routing address is synthetic and intentionally unpopulated. This proves current RPC/query syntax support, not deployed escrow availability or adoption. Zero writes, no native expiry observation and zero verified available assignments are explicit fields.
- **Event documentation and current SDK differ.** The [Live Events guide](https://docs.arkiv.network/typescript-sdk/live-events/) previously inspected HTTP examples, while the [current event hub](https://hub.arkiv.network/ethrome) requires WebSocket updates with application filtering. The installed SDK watcher supports event callbacks, but its enum contains EntityCreated/EntityPatched/ExpiryExtended/OwnershipTransferred/EntityDeleted, not a dedicated EntityExpired callback. A particular expiry notification must be measured, not invented. Earlier transport probes recorded public sockets working; they are not newly repeated assignment stream evidence. Assignment filtering/reconciliation and cross-client UI expiry remain unverified.
- **No fabricated migration.** REVIEW PASS is a new experiment. There is no former Ponder/subgraph/Postgres indexer removal to demonstrate. The credible intended fit is public expiring assignment discovery, independently retrievable encrypted briefs and authoritative settlement. Sponsor readiness requires the actual user flow, not a schema alone.

Reproduce read-only query:

```sh
node --import tsx experiments/qualification/transport/assignment-probe.ts
```

Run meaningful local tests and isolated typecheck:

```sh
node --import tsx --test experiments/qualification/transport/assignment.test.ts
node_modules/.bin/tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck --types node experiments/qualification/transport/assignment.ts experiments/qualification/transport/assignment.test.ts experiments/qualification/transport/assignment-probe.ts
```

Seven assignment tests passed; typecheck passed after making the injectable page entity array readonly to match the SDK's actual query return type. This was a compile-time integration issue; no runtime outage resulted. Prior adapter tests are separate and retained. Application funds, Swarm public postage/gateway authorization, multi-party brief key delivery and a real Fuji deployment are not established by these checks.

Sources checked: [Arkiv event hub](https://hub.arkiv.network/ethrome) (fresh 12 September 2026); installed official `@arkiv-network/sdk@0.8.1` `src/utils/expirationTime.ts`, `src/query/expression.ts`, `src/actions/public/watchEntityEvents.ts`, `src/attr/values.ts`. Root integration must place final sponsor-required artifacts at canonical submission paths; this bounded worktree owns only the experiment transport subtree.
