# Deaddrop — bounty and submission map

[Docs](../README.md) · [Evidence](EVIDENCE.md) · [Architecture](ARCHITECTURE.md)

Target entries: **Avalanche / Team1 Track B; Arkiv Mission 02 and Mission 03 with Best Use consideration; Swarm.** ENS and Arkiv Mission 01 are not implemented submission claims.

## Requirements mapped to the product

| Entry | Why Deaddrop fits | What judges should inspect |
| --- | --- | --- |
| [Avalanche / Team1 Track B](bounties/AVALANCHE.md) | Proof-enforced eligibility and a funded review’s settlement lifecycle | Funding → proof-checked assignment → committed delivery → USDC payment, with real receipts |
| [Arkiv Mission 02](bounties/ARKIV.md) | Recruiting advertisements expire without changing escrow rights | The same query/board loses a real listing through native expiry, without deletion |
| [Arkiv Mission 03](bounties/ARKIV.md) | A shared board reacts to relevant public entity changes | One browser publishes; another updates through WebSocket subscriptions without manual refresh or polling |
| [Arkiv Best Use](bounties/ARKIV.md) | A queryable, wallet-owned discovery layer other clients can use | Architecture, working flow, first-user plan and specific SDK feedback |
| [Swarm](bounties/SWARM.md) | Public scopes/status snapshots and recipient-encrypted review reports | Actual upload, separately retrieved bytes, digest verification and recipient decryption |

The [current Team1 rules](https://build.avax.network/events/73a939b1-6d35-4847-9388-320024638249) require one track per project and a complete testnet flow with verifiable onchain activity. Our Track B case is the combination of a funded task’s rules, proof-bound reviewer eligibility and onchain settlement. Deaddrop uses existing canonical Fuji test USDC; it does not mint a new asset token or tokenize the right to payment. Whether that contract-managed lifecycle satisfies the sponsor’s tokenized-assets scope remains a judging decision.

The [current Arkiv hub](https://hub.arkiv.network/ethrome) allows only one award per team; qualifying projects automatically enter Best Use consideration. Mission 01 requires replacing an existing indexer path, which Deaddrop does not claim. Current official pages were checked on 13 September 2026; they supersede conflicting older copied currency/scoring details. [Supplied Swarm brief](../review-pass/supplied-bounties.txt) makes Swarm ID optional.

## Submission packet

| Item | Location / owner / state |
| --- | --- |
| Public product explanation and repository navigation | [README](../../README.md), [project brief](../../PROJECT_BRIEF.md), [docs index](../README.md) — prepared |
| Public app and account-free walkthrough | [Deaddrop](https://cutout-ethrome-2026.vercel.app), [judge tutorial](TRY-IT.md) — available |
| Setup instructions and source map | [Quickstart](QUICKSTART.md), [architecture](ARCHITECTURE.md), [deployment](DEPLOYMENT.md) — prepared |
| Sponsor integration explanations | Three dedicated pages above — prepared |
| Arkiv schema, feedback and first-user hypothesis | [Schema](../../arkiv/schema.md), [feedback](../../feedback.md), [artifact matrix](../../arkiv/submission.md) — prepared |
| Complete public paid-task receipt bundle | [Task #4, finalized payment and balance reconciliation](evidence/saved-pass/finalized-payment.json) — passed with operator-controlled browser wallets |
| Native expiry and two-browser stream evidence | [Real public listing, unchanged query and browser observations](evidence/saved-pass/arkiv-missions.json) — captured; [presentation video](https://youtu.be/oYqHnYT8WfU) provided |
| Working-flow video | [Watch the team’s video](https://youtu.be/oYqHnYT8WfU) — provided; its recording has its own execution scope |
| Pitch slides | [Submission slides](../../SLIDES.md) — provided |
| Correct repository branch URL in forms | Use `https://github.com/MihRazvan/eth-rome-2026/tree/main` for the submitted source |
| Actual submission confirmations | Team submitter — no form submission claimed |

## Final checks before submitting

- [x] Capture a complete public paid review with finalized receipts and independent balance reconciliation: [task #4](evidence/saved-pass/README.md).
- [x] Capture native Arkiv expiration and actual two-browser publication/update with entity, transaction and same-query evidence.
- [ ] Complete the [manual end-to-end test](TESTING.md) with their actual wallet extension; operator automation does not substitute for this review.
- [x] Link the [video](https://youtu.be/oYqHnYT8WfU) and [pitch slides](../../SLIDES.md). A link does not verify every action shown or submit an entry.
- [ ] Confirm the app opens in a fresh browser without Vercel authentication and first-time reviewer setup and the funded task flow work without team intervention.
- [ ] Submit the ETHRome entry, [Arkiv form](https://tally.so/r/vGZ98v) and [Team1 Builder Hub entry](https://build.avax.network/events/73a939b1-6d35-4847-9388-320024638249) through the relevant team accounts. Preserve confirmations privately or redact personal fields before committing.

The Builder Hub page lists 13 September at 16:00 Europe/Rome for its submission. That is a sponsor deadline, not an extension of any earlier ETHRome deadline. Follow the event's own submission timetable as well. No external form is submitted by preparing this repository.
