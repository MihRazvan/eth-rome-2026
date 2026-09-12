# Review Pass — research and product build

Research checked 12 September 2026. Work lives on `review-pass/product`, branched from `4f0cc87`. EXIT and earlier experiments remain in the repository with their original history.

**Review Pass is a paid technical-review workspace for a reviewer collective and its clients.** A client specifies a public scope and funds a reward. A reviewer proves that their qualification is currently valid without publishing its credential serial, accepts the task, and delivers an encrypted report. The client retrieves and checks the report, then approves payment or uses the agreed dispute process. Qualification does not prove work quality.

The sensible first customer is an existing collective commissioning small second reviews: one upgrade diff, an allowance change or reproduction of a reported bug. The product does not need to bootstrap a general freelance marketplace. Its commercial hypothesis remains unvalidated: a real issuer and two clients must find portable qualification useful enough to adopt it. Named reputation may matter more than credential privacy to some clients.

## What the research changed

| Decision | Evidence and consequence |
|---|---|
| Use canonical Fuji test USDC | The checked Team1 brief asks for a stablecoin product, **not a newly issued stablecoin**. Fund the escrow with the actual Circle test asset; do not introduce artificial backing or redemption claims. |
| Wait for finalized Fuji state | July's Helicon change and September's AvalancheGo release distinguish execution from settlement. A receipt alone is insufficient for our public confirmation policy. |
| Make Arkiv the opportunity board | SDK 0.8.1 supports typed compound queries and real WebSocket subscriptions. A recruiting lease expires independently of the financial deadline. Natural expiry emits no event, so received heads trigger a fresh identical query at the lease boundary. |
| Keep encryption in the application | Swarm ID supplies browser identity/postage capability. It does not replace wallet authority or the wallet-bound HPKE keys. Public scope is public; only reports are encrypted. |
| Inspect the shipped dependency graph | The published Swarm ID bundle included an older Axios. A reproducible, pinned parent-client rebuild excludes Axios, preserves license notices and retains the canonical identity iframe. The remote iframe remains a separate trust dependency. |
| Commit real terms when funding | An editable description is inadequate. Funding now commits the exact public manifest reference and digest, alongside reward, class and deadlines. |

The current research window is 12 July–12 September. Sources include the September 8 AvalancheGo release, September 11 Arkiv/Swarm ID releases, Swarm's September 5 development update, August credential announcements and the ShadowPath preprint. Older materials are labeled as prior art rather than recent discoveries. The implementation is **not a reproduction of ShadowPath or new cryptography**.

Read the comprehensive reports and their pinned source inventories:

- [Avalanche: rules, recent finality changes, USDC and executable probe](avalanche/research.md)
- [Arkiv: current rules, form inspection, schema, expiry and WSS probe](arkiv/research.md)
- [Product and Swarm: prior art, actual browser compatibility, encryption and adoption](product-swarm/research.md)

Prior art includes AnonCreds, Privado/iden3 and Semaphore for eligibility, TalentLayer and Kleros for service escrow, and established assessment platforms for the underlying work. These comparisons rule out claiming that private credentials or freelance escrow are new. The contribution must be the useful, demonstrable integration: private current qualification, immutable task terms, portable encrypted delivery and independently enforceable payment.

## Bounties and exact limits

| Target | Product contribution | Remaining proof |
|---|---|---|
| Arkiv Mission 02, Mission 03 and Best Use | Native recruiting leases; independently queryable filtered board; genuine WSS updates and reconnect reconciliation | Funded public entity creation, unchanged query before/after natural expiry, two-client writes and UI trace, hosted app and actual submission |
| Swarm | Real public scope/snapshots and encrypted review bytes, separate retrieval and export; Swarm ID capability handling | Authorized public postage/session, actual upload and independent public retrieval, submission/demo |
| Team1 Avalanche Track A | Canonical test-USDC escrow, qualification verification, delivery commitment and payment on Fuji | Funded public deployment and complete test-USDC lifecycle, both required forms, in-person demo |

Arkiv's current hub says EUR awards and one award per team; the supplied attachment says USD/USDC. Current hub-linked guidance also supersedes the older conversation/five-gate instructions. We retain compatible schema and feedback artifacts, identify the conflict, and do not invent sponsor sign-off. Team1 permits one track; first and second place are alternatives. Swarm's two awards are not a promise that one team receives both. ENS is not part of the implementation target.

Official sources: [ETHRome prize rules](https://www.ethrome.org/hackermanual/prizes.html), [Arkiv event hub](https://hub.arkiv.network/ethrome), [Arkiv submission form](https://tally.so/r/vGZ98v), [Circle test asset addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses). Exact observations, source hashes and disagreements are retained in the linked reports and [supplied brief](supplied-bounties.txt).

## Delivery and next verification

The integrated local application supports two independently funded scopes/rewards, browser-local proof generation or advanced public proof import, encrypted delivery, recipient-specific retrieval, report export and payment. The board connects to actual public Arkiv WSS. These are different evidence scopes: local Anvil/Bee transactions do not establish Fuji or public storage writes.

The UI continues the work-ticket direction selected after [two rendered application concepts](../../experiments/qualification/research/concepts.md). It keeps scope, reward and acceptance/delivery/payment actions together, with a separate discovery board and an explicit disclosure explanation.

Public hosting: **[Review Pass setup](https://review-pass-ethrome-2026.vercel.app)** is online and browser-verified. It supports Swarm ID setup while public contracts/snapshot remain pending; funded reviews are not enabled yet. [Hosting evidence](evidence/vercel/README.md).

Start with the **[shared judge-readiness checklist](JUDGE-READINESS.md)**, [qualification provisioning](QUALIFICATION-PROVISIONING.md), [latest judge-pass evidence](evidence/judge-pass/README.md), [build acceptance ledger](BUILD.md), [product runbook](RUNBOOK.md), [bounty evidence index](../../arkiv/submission.md) and [feedback report](../../feedback.md). The current local demo uses port18889; port18888 remains the earlier pilot. All project credentials and private issuer/holder files stay outside Git and HTTP.

The public deployment preparation builds a separate verifier/setup and checks live Fuji token metadata. Broadcasting requires explicitly configured project funds, valid public issuer metadata and a publicly retrievable whole snapshot. Missing access must stay a concrete gate; failed integrations must never silently become fixtures.
