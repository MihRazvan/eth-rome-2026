# Deaddrop submission release — 13 September 2026

[App](https://cutout-ethrome-2026.vercel.app) · [Deployment](deployment.json) · [Final build hashes](build.json) · [Verification summary](verification.json) · [CI](ci.json)

The final deployed source is **003c109**. The fresh public paid flow below ran on **126de20**; the subsequent changes update user-facing names and preserve old enrollment signatures/backup compatibility. Those changes passed focused tests and final hosted checks. Later documentation commits do not change the deployed app.

## Actual public end-to-end result

**Task #6 paid 0.1 canonical Fuji test USDC to its assigned reviewer.**

1. The operator-owned client wallet approved exactly 0.1 USDC and funded a new, nonsensitive review scope uploaded to public Swarm.
2. The client published its listing on Arkiv. The already-open reviewer browser received it through the live board without refreshing.
3. The reviewer used its saved issuer-approved pass to generate a real browser proof. The deployed Fuji verifier checked it at acceptance.
4. The reviewer encrypted its report for the two participants, uploaded it to public Swarm and independently retrieved it before committing delivery on Fuji.
5. The client retrieved and decrypted the exact report, then approved payment. Finalized state is Paid; the reviewer’s token balance increased from 100000 to 200000 base units.

[Public flow record](public-flow.json) · [independent finalized receipts/balance reconciliation](finalized-payment.json) · [paid review capture](paid-review.png).

Payment: [0x5bc4…cd3f on Fuji](https://testnet.snowtrace.io/tx/0x5bc4a822d815c28763c9428a5618a0d388bc7a891a276ddca1bb0fc2e92fcd3f).

The runner initially retained an obsolete short-expiry wait and was resumed on the **same funded task**. It did not fund a duplicate or touch another participant’s task. This is a completed real lifecycle with a documented harness interruption, not an uninterrupted passing runner. Controlled Chromium wallet bridges were used, not a human extension-wallet session.

## Final hosted checks

[Six general browser groups](browser.json) passed with zero page errors or upload writes: landing and issuer explanation, busy role guard, client/reviewer navigation, live scope preview, desktop/mobile walkthrough with real local encryption and simulated payment, reload/deep links and unavailable-config demo access.

[Six saved-state groups](saved-state.json) passed with zero page errors: task #6 stays Paid; its exact report decrypts before and after reload; report download enables only after decryption; the reviewer’s pass persists; the new `.deaddrop` private backup downloads and restores; the workspace fits390px. These checks used the original private profiles and forbade all wallet signing and transactions. Backup restoration is a local private vault operation; no private backup is included here.

The expanded landing was also inspected with all FAQs open at320/390/768/1440px. It includes the supplied reference’s product statement, feature strip, lifecycle, privacy FAQ and final working calls to action. [Full landing](landing.png) · [saved pass on mobile](pass-mobile.png).

## Clean checkout and repository

At126de20, a separate clean worktree passed `npm ci`, `npm run check`, `npm run test:browser` and `npm run build:hosting`. The hosting command downloaded the exact pinned public proving artifacts and used no issuer/holder secrets or new cryptographic setup. Final003c109 also passed [Deaddrop CI](https://github.com/MihRazvan/eth-rome-2026/actions/runs/34736694098);47 focused naming/authorization tests passed, with one optional skip.

Default scripts now target Deaddrop. Superseded EXIT code, teammate briefs and internal planning were removed from the current tree; real history, licenses, current technical guides and sponsor evidence remain. Deployed cryptographic domains and private browser namespaces retain compatible internal names. Historical task titles and receipts are not rewritten.

The current sponsor targets remain Team1 TrackA, Arkiv Missions02/03 with Best Use consideration, and Swarm. This release does not claim a TTL auction, heartbeat-based contract cancellation, Swarm Feeds, padded reports or confirmed prize eligibility. [Bounty map](../../BOUNTIES.md).
