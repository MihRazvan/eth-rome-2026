# Public discovery board

`listings.ts` supplies a schema2 public board and Arkiv adapter. It is separate from schema1 experiment assignments. It does not implement escrow views: the client’s own jobs and accepted reviewer work must remain visible from Fuji even when a discovery lease expires.

```ts
import { createListingBoard, createArkivListingDriver } from "./listings";

const driver = createArkivListingDriver({
  namespace: "review-pass",
  rpcUrl: publicArkivHttpUrl,
  wsUrl: publicArkivWebSocketUrl,
  // account: clientWalletAccount, // only needed for explicit publication
  // walletTransport: custom(window.ethereum), // required for a browser account
});
const board = createListingBoard({
  driver,
  verify: async (entity) => {
    // Root integration MUST read trusted Fuji escrow here. Require Open, funded
    // reward/token/class/client/deadline match and a nonexpired acceptance window.
    // Bind entity.listing.publicScope.reference to termsReferences(jobId), and
    // publicScope.sha256 to jobs(jobId)[8]. Retrieve and validate public terms.
    // Return false for a forged/stale advertisement; THROW if chain read failed.
    return verifyListingAgainstConfiguredEscrow(entity);
  },
  onState: ({ status, listings, removed, head, reason }) => {
    renderPublicBoard({ status, listings, removed, head, reason });
  },
});
await board.start({
  namespace: "review-pass",
  taskClass: "technical-review",
  qualificationClass: "7",
  settlementChain: 43113,
  escrow: configuredEscrow,
  // paymentToken: configuredUSDC, minimumReward: '5000000',
});
// Explicit refresh button: await board.refresh();
// Component/network teardown: board.stop();
```

`start` validates the filter, invalidates previous callbacks, installs streams before fetching the complete snapshot and resolves after initial reconciliation. `onState` receives bounded public errors, immutable replacement list arrays and a status. `connecting` means a snapshot may have loaded but no WSS head has yet been observed; `live` requires the stream to have produced a head. `stale`/`error` must disable board acceptance until recovered or explicitly rechecked. Preserve old results as unavailable rather than presenting network failure as an empty marketplace. Never treat discovery as a reservation: contract acceptance rechecks state.

The driver selects public metadata and validates every typed attribute against the JSON payload. Both immutable creator and current owner must equal the listing client. This version expects direct client-owned Arkiv entities; it deliberately does not support a backend relay publishing under a different wallet. An injected-wallet account may be represented as a viem JSON-RPC account; root must provide the matching authorized wallet transport for browser writes if using that mode. Pass `walletTransport: custom(provider)` for a browser account. Without it, a non-local account fails closed before any RPC. Publication rechecks the signing chain and browser account list immediately before the SDK mutation. Local accounts can use the configured HTTP transport.

Publish only after validating the funded onchain job and exact public scope terms. The driver's `publish(listing, leaseBlocks)` checks signer/client equality and a nominal lease ending before the Fuji acceptance deadline, creates with readonly payload and owner-only extension flags, and returns the actual SDK receipt key/hash/expiry. It does not replace the root's authoritative funding/terms verification. Three to43200blocks are allowed. Inclusion and chain timing can differ; contract deadlines remain independent. Serialize writes from one wallet and never blindly resend an uncertain transaction.

Subscriptions use true `webSocket` transport, `watchEntityEvents` without `fromBlock`, and `watchBlockNumber` with `poll:false`. The latter is imported from `viem/actions` because the installed SDK's TypeScript exposed action list omits it. Public event payloads do not contain attributes, so unknown entity hints receive bounded hydration (four concurrent,128queued). Relevant events coalesce full queries; an overflow or continuously changing snapshot is reconciled at a subsequent received head. There is no query interval or hidden HTTP polling fallback.

Expiry is confirmed by fresh query absence at/after the entity's recorded expiry block. Known explicit deletes are labeled `no-longer-listed`, not native expiry. An offline deletion followed by later expiry cannot be distinguished without historical backfill; the UI should say “lease no longer active” and mission evidence must establish no delete transaction. Stream reconnection performs current-state reconciliation; it does not replay every missed event or promise exactly-once callbacks. Stop unsubscribes both watchers and invalidates pending tasks; viem manages shared socket lifetime.

The read-only probe under `docs/review-pass/arkiv/` is actual public transport evidence. The tests below use injected deterministic drivers, not funded Tiramisu entities. Public creation, natural lease demonstration, the application's two-client WSS flow and deployment remain separate unverified gates.

```sh
node --import tsx --test experiments/qualification/pilot/listings.test.ts
node_modules/.bin/tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck --types node experiments/qualification/pilot/listings.ts experiments/qualification/pilot/listings.test.ts
```
