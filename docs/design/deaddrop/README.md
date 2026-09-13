# Deaddrop design and product boundaries

13 September 2026. Deaddrop is the current product name; Cutout and Review Pass remain historical paths and compatibility namespaces. The existing public origin is retained so returning participants retain their saved qualification and report keys.

## Visual direction

The [user-supplied HTML](reference/deaddrop-app-v2.html) is a visual reference, not an implementation specification. Its transactions, people, collectives, measurements and claims are simulated. No reference JavaScript is loaded by the application. The thermal fragment shader is adapted in `web/thermal.ts`; its cooling wells are decorative and explicitly carry no transaction meaning.

The implementation keeps the reference’s full-screen thermal field, underlined monospace wordmark, compact role entry, dark workspace, dashed boundaries, orange actions and blue confirmation states. Martian Mono and Azeret Mono are served locally with their OFL licenses. Actual tasks, qualification, encryption and payment actions use the existing product. There are no invented collectives or counters. “Who qualifies?” explains the actual manual test issuer instead of presenting a fictional issuer dashboard.

Animation is capped at 30fps and a 1200px render width, paused outside the home view and on hidden tabs, with a static reduced-motion mode and a CSS fallback. Entry actions are available immediately without a theatrical loading screen.

## Bounty proposal review

These are implementation findings, not sponsor eligibility guarantees. Existing sponsor targets remain in [the bounty map](../../cutout/BOUNTIES.md); this visual pass does not switch tracks or invent new completion evidence.

| Suggestion | Decision and actual boundary |
| --- | --- |
| A 60-second heartbeat reopens accepted tasks | Do not ship as a cosmetic feature. Fuji assignment survives a disconnected browser. Current timeout permits an explicit refund transaction, not reopening. A reservation lease would require a distinct state and race handling. |
| Credential revocation by missing Arkiv entity | Do not claim. The circuit checks a leaf against the current onchain root. Missing discovery records cannot override that root. |
| TTL determines a Dutch auction price | Deferred protocol design. Reward is fixed at funding. TTL does not calculate or enforce a settlement price. |
| Compound queries enforce access control | False security boundary. Queries filter public discovery records. Encryption and contract verification enforce access. Keep typed compound filters for useful discovery. |
| WebSocket events advance the interface | Existing real behavior: new listings trigger reconciliation and board updates. Financial state still requires verified Fuji state and signed transactions. |
| Proving artifacts on Swarm | Feasible future distribution improvement. Current same-origin artifacts are hash checked. Upload the exact artifacts if pursued; do not rerun randomized setup and imply it reproduces the deployed verifier. |
| Issuer can disappear | Existing approval can be used without a live issuer API while its credential and root remain valid. New approval/root maintenance still require the trusted issuer. |
| Swarm Feeds mailbox | Not implemented. The encrypted enrollment inbox uses Arkiv; encrypted reports use Swarm content references. Do not label either as Swarm Feeds. |
| Fixed-size report padding | Deferred. Existing ciphertext length remains observable. A versioned, tested envelope change is required. |
| Swarm ID eliminates postage | It does not. The current public gateway provides postage for account-free customer uploads. Optional Swarm ID integration is retained. |
| Switch to Team1 Track B | Not made in this pass. Private eligibility credentials are not automatically a tokenized asset. Existing Track A evidence and actual sponsor wording remain authoritative. |
| Payment recipient is proof-bound | Already true. The verifier binds the task and payee, so relaying cannot redirect payment. Do not describe the credential itself as unshareable: its holder can disclose its secret. |

Key source boundaries: `QualificationEscrow.sol`, `circuit.go`, `pilot/listings.ts`, `pilot/keys.ts`, `pilot/enrollment-inbox.ts`, and `pilot/browser-prover.ts` under `experiments/qualification/`. No contract, credential format, encryption envelope, expiry rule or issuer state is changed by the rebrand.

## Verification

[Browser replay](verify-browser.mjs) checks the landing, role entry, issuer explanation, live read-only workspace, desktop/mobile guided encryption and the offline fallback. The guided demo explicitly simulates qualification and settlement; it is not sponsor network evidence. Current deployment and actual results are recorded in [acceptance](../../ACCEPTANCE.md).
