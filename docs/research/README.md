# EXIT product research

EXIT's strongest direction is a transparent market for remaining withdrawal rights, with confidential negotiation and public execution. The new work should make that exchange easier to understand and harder to misrepresent. Broader asset support, speculative valuation and more automation are weaker priorities until the current claim lifecycle, privacy boundaries and live sponsor path are demonstrably reliable.

This research package combines mechanism analysis, actual application critique, independently reproduced failures and agent-workflow research. It distinguishes source-level observations, developer claims, user anecdotes and verified behavior. External references were inspected on September 11, 2026; the supplied handoff remains preserved separately.

## Read the findings

| Report                                              | Focus                                                                                                                                               |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Market landscape](market-landscape.md)             | Intentional, TenderSwap/lpETH, Lido, Sanctum, Pendle and RFQ lessons; source discrepancies and evidence limits                                      |
| [Trading experience](trading-experience.md)         | Actual current/comparable screens, sell-versus-wait clarity, private routing, freshness and keyboard interaction                                    |
| [Security and reliability](security-reliability.md) | Independent baseline reproductions: approval side channel, cross-wallet refresh race, discovery coupling, certificate retry and HTTP queue blocking |
| [Agent workflows and skills](agent-workflows.md)    | Official documentation, primary studies, inspected skill revisions, selective adoption and reusable verification                                    |

Each specialized report cites the exact sources behind its claims. The accompanying source inventories record dates, provenance and access limitations. Screenshots distinguish the connected local product from explicit fixture previews and public comparable products. No forum complaint or promotional deployment claim is treated as proven market adoption.

## Decisions from the evidence

The most important result was a correction to the privacy claim. The initial custom-maker flow approved exactly its intended bid amount before encrypting it. Approval events and calldata therefore exposed losing bids even though the storage upload was ciphertext. The baseline regression also showed that an older seller refresh could overwrite a newer wallet view with decrypted terms. Both are application-boundary defects that an encryption-library test alone cannot detect. Historical evidence is preserved in [baseline reproduction results](repros/boundary-results.json); those results apply to `b36fbf1`, not the corrected code.

The selected funding design uses an explicitly disclosed 100,000 test-USDC capital limit independently of bid price, reuses sufficient existing allowance and avoids quote-derived approvals. It still exposes the account, public funding capacity and activity timing. It does not promise anonymity or hidden settlement. A missing recipient is rejected before new approval or signature work. Tests now inspect actual approval events/calldata as well as ciphertext.

The browser controller now treats a refresh as one wallet-scoped snapshot. It derives the negotiation request from onchain ownership and epoch, pins financial views to a common block and commits local quote maps only if the wallet/session remains current. Account, network and disconnect events clear confidential UI state. Same-wallet background work preserves the last verified quote snapshot until the next complete result, while settlement still rechecks current chain state.

Discovery is a separate availability boundary. If offer lookup fails, a verified onchain claim remains visible and collectible; the interface labels offer discovery unavailable instead of pretending that zero offers were received. Public recipient certificates are republished idempotently when a retained device key exists, allowing recovery from an earlier failed upload or loss of the server's public certificate cache.

The server now validates complete, bounded JSON bodies before admitting signer mutations to its serial queue. A stalled sender cannot hold that queue while drip-feeding an unfinished body. Queued work has explicit limits and expiry, and real HTTP tests cover timeout, malformed input, disconnection and subsequent successful requests. This is bounded availability improvement, not a claim of production-scale denial-of-service resistance.

The UI keeps the selected claim, page and Private Offers mode through reload and Back/Forward navigation. URLs contain navigation metadata, never price, signature, scenario inputs or device keys. Invalid/missing claims are shown explicitly. Dialogs have accessible names and restore focus; wallet changes close confidential reviews and clear bid inputs and late notices. Existing EXIT receipt styling is retained because the research supports better decisions within a coherent application, not another aesthetic restart.

## Product economics

The important seller comparison is exact money now versus uncertain remaining proceeds. In the reference example, 9,960 now against 10,000 expected remaining represents 40 of foregone expected value, or 0.40%. That is not an annual yield. A quote above expected remaining should be identified as a premium, not displayed as a negative discount without explanation.

For a buyer paying 5,985, a 6,000 payout produces 15 before gas and operating costs. A 5,700 payout produces −285. Break-even is recovered proceeds covering total acquisition cost, not an appealing APR based on a short or uncertain waiting interval. Scenario amounts should stay local and remain separate from the signed price. Prior owners' withdrawn cash must not be counted as the buyer's remaining entitlement.

The comparable-product research also found discrepancies between documentation and pinned source calculations. These are reasons to validate the selected implementation and its economics, not claims that a presently deployed competitor is exploitable. The prior Unstake.it reference also needed historical-branding context. EXIT should demonstrate its particular combination of independently funded competition, residual resale and optional private offers without claiming to invent claim markets.

## Readiness and next experiments

`npm run preflight` checks configuration and permitted read-only network facts without printing secrets or publishing records. A result can be blocked or still unverified; it cannot certify the full live lifecycle. The repository-local `$exit-verify` skill packages the existing acceptance workflow and the new privacy lessons for future sessions.

The next live experiment remains the funded Fuji lifecycle with public offers, a custom private quote and outsider observation, followed by actual Arkiv publication/native expiry and Swarm upload/independent retrieval. Measure successful exact payment, ownership, collection, quote invalidity and private-data exposure. Distinguish user comprehension from protocol correctness: ask a tester to explain what transfers, why a stale offer cannot execute, what their remaining exposure is and which information becomes public.

Useful subsequent experiments are larger claim/offer sets, mobile wallet event behavior, pending-transaction recovery after a tab closes, device storage eviction, provider rate limits and a carefully reviewed production content-security policy. These remain separate from passed checks. New sources require complete admission evidence before entering the market.

The acceptance ledger and [continuation handoff](../CONTINUATION.md) record actual integrated checks and deployment status. Research recommendations do not change blocked sponsor requirements into completed integrations.
