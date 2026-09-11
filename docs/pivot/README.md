# Hard pivot: choose a demonstrable trust boundary

Research date: 12 September 2026, Europe/Bucharest. Requested recent-source window: 12 July–12 September 2026. Network observations are also timestamped in UTC, where some occurred on September 11. This report responds to the user's request to leave EXIT behind if a stronger hackathon product exists. It preserves the previous application and its evidence.

## Recommendation

**Advance REPRISE as the lead prototype: a user-owned payment job that another authorized operator can recover after the original provider disappears.** The promise is: **“Replace the operator. Keep the job. Never repeat an approved payment.”** Show the exact moment where an ordinary retry becomes dangerous: a payment succeeded, but its acknowledgement never reached the worker. A replacement operator must discover that fact independently, finish the remaining work, and resist the original operator returning with stale authority.

This is a recommendation about hackathon fit, not proven market demand or a claim to have invented durable execution. The interesting contribution is a narrowly specified recovery agreement that travels across operators, with independently enforceable payment state and portable inputs. Restarting the same process against the same database would not establish that contribution. The underlying ingredients—leases, fencing epochs, immutable payment instructions, encrypted artifacts and idempotency—are established. Combining them into a useful, inspectable cross-operator product is the proposed work.

REPRISE currently has the best balance of the team's demonstrated strengths, a dramatic failure/recovery demonstration, three natural sponsor roles and limited dependence on a new marketplace. **SWITCH**, conditional multi-person reservation exchange, is the strongest non-developer alternative. **Private qualification for temporary paid work** is the strongest candidate if cryptographic novelty matters more than integration certainty. Neither should be described as commercially validated.

## What the prior winners actually suggest

We inspected the local ANYWARE and AUTARK checkouts at pinned commits, read their source, documentation and demo flows, and preserved their licenses. The [independent report](winners.md) distinguishes the original submissions from later work and describes source-level limitations without presenting them as a new audit.

The repeatable strength is a visible trust failure followed by an enforceable result. ANYWARE makes a fact on another chain usable through evidence. AUTARK moves release authority away from one deployment credential. The next entry should similarly let a judge attempt the forbidden action and inspect why it failed. Another financial dashboard, renamed deployment tool or proof visualizer is weaker than a complete new user journey around that strength.

For REPRISE the forbidden actions are concrete: charge an approved obligation twice, change its recipient during recovery, or let an expired operator overwrite the authoritative result. Its positive control is equally important: another operator actually completes the remaining approved work. An application that only blocks attacks is incomplete.

## Prize strategy: optimize coherent entries, not the advertised total

Current sponsor pages and the pasted brief disagree in places. The [sponsor report](sponsors.md) retains those differences and provides exact sources and executable network observations.

| Target | Available award for one project | Product responsibility |
|---|---|---|
| Arkiv overall | **€1,000 maximum**, or one €500 mission award | Operator-independent discovery of recoverable jobs and short-lived availability |
| Swarm | **$500** for one of two winners | Encrypted inputs and recovery records usable after the original service disappears |
| Team1 Track A | **$400 first / $200 second** | Actual stablecoin effects, recovery authority and cancellation enforced on Fuji |
| ENS | Unspecified share of a **$500 pool**, up to five winners | Optional ENSv2 organizational delegation and verifiable publication rights on Sepolia |
| Main ETHRome | Annual Urbe Hub membership per winning team member, max three | Overall quality and innovation; this is an in-kind prize |

Arkiv + Swarm + Team1-A therefore has a conditional best outcome of **€1,000 + $900**, before any ENS share. These are ceilings, not expected winnings. Arkiv permits one award per team, Team1 one track, and ENS is not $500 per team. No exchange-rate conversion or invented winning probabilities are used. The main prize is not an additional verified cash amount. ([Arkiv hub](https://hub.arkiv.network/ethrome), [ETHRome prizes](https://www.ethrome.org/hackermanual/prizes.html))

The current Arkiv hub gives 30% to why Arkiv, 25% execution, 20% usefulness/adoption and 25% feedback. This favors a real shared-data dependency, a working demonstration, and specific developer feedback. Native expiry and real WebSockets fit a new project; fabricating a legacy indexer to claim a migration does not. ENS should be included only after its scoped-authority interaction earns a place in the demo. The complete rules and retained Saturday conversation requirement are in [sponsors.md](sponsors.md).

## What the recent research changes

The recent window produced useful mechanisms and substantial evidence against obvious pitches. Publication, release and update dates are distinguished below. A fresh publication does not make an old mechanism newly invented.

| Source and actual recent event | Implication for product selection |
|---|---|
| [Cloudflare Agentic Internet](https://blog.cloudflare.com/the-agentic-internet/), 6 Aug announcement; [Agent Access Model](https://blog.cloudflare.com/the-agent-access-model/), 5 Aug | Agent infrastructure is moving toward external control and payment surfaces. Generic named wallets and permissions are already an incumbent direction. Announcements are not evidence that every advertised capability is generally available. |
| [PACT](https://www.ietf.org/archive/id/draft-laxsharma-pact-00.html), 27 July individual Internet-Draft | Task contracts, escrow, verification and recursive agent commerce are explicit prior art. This is a proposal, not an adopted IETF standard or proof of a deployed market. |
| [Beyond the Mandate](https://arxiv.org/abs/2608.23858), 24 Aug preprint | Signed payment artifacts do not protect every upstream influence used to construct them. Approve exact business effects and keep authority outside model inference. |
| [OpenClaw operation-freezing fix](https://github.com/openclaw/openclaw/pull/119389), merged 5 Aug | Hash-bound approval and single consumption are already shipped mechanisms. They cannot be REPRISE's invention claim. |
| [MAP-Graph](https://arxiv.org/abs/2608.10509), 11 Aug; [PPMF](https://arxiv.org/abs/2607.29167), 31 July | Agent memory provenance, derived-record access and recall have close research precedents. A recall dashboard needs a sharper contribution. |
| [ShadowPath](https://arxiv.org/abs/2608.19937), 20 Aug preprint | Private non-revocation is a promising credential primitive, but deployment, freshness and payment linkability remain open integration gates. |
| [Verifiable PIR with Updates](https://eprint.iacr.org/2026/1651), 10 Aug research report | Private reads need authenticated updates and consistent database versions. A hidden query alone does not establish correct, fresh answers. |
| [Policies for Fair Exchanges of Resources](https://lmcs.episciences.org/18805), journal publication 20 July; preprint originally Oct 2024 | Formal policy checking can support conditional exchanges. The paper already describes NFT exchange, so neither the mechanism nor its blockchain application is a new discovery. |
| [Prezta](https://www.usenix.org/conference/usenixsecurity26/presentation/wei-zhongjing), USENIX Security Aug 2026 | A concrete example of moving policy evaluation into a zkVM with cheap verification. It is research to build on, not a reason to add a proof where a small contract already checks the condition. |
| [Competitive Market Behavior of LLMs](https://arxiv.org/abs/2609.02580), 2 Sept preprint | Its experiments report poor convergence in several LLM trading markets. An AI auctioneer is not evidence that a new market will be liquid or efficient. |

The [frontier report](frontier.md) assesses eight directions and records verified source dates. Further root sources and exclusions are in [additional-research.md](additional-research.md). No paper's performance benchmark was reproduced here. Papers establish reported findings and technical possibilities; they do not establish customers for our product.

## Shortlist after the prior-art filter

These are integrator judgments, not numerical measurements or winning probabilities.

| Candidate | User-visible result | Strongest aspect | Main reason it could fail |
|---|---|---|---|
| **REPRISE** | Replace a vanished payment-job operator without repeating a completed obligation | Adversarial demo, team fit, natural Arkiv/Swarm/Fuji roles | Merely recreates a workflow engine unless the original provider and database are genuinely unnecessary |
| **SWITCH** | Three people exchange reservation rights atomically when no pair can trade | Most memorable consumer interaction | Needs an issuer that honors the new rights and enough matching preferences; cycle matching already exists |
| **Private qualification** | Take a temporary assignment without exposing a reusable credential identifier | Strong privacy primitive and recent research connection | Actual prover/issuer integration untested; wallet payments can relink presentations |
| **ALL IN** | A group funds one exact plan; changed terms require new consent | Clear consumer payment task | PartyDAO and group-booking products already cover much of the story; prefunding friction |
| **Mandate** | A contractor can publish receipts and spend only under distinct scoped authority | Best four-sponsor authority walkthrough | Existing smart-account/procurement patterns make the novelty incremental |

Do not advance generic agent wallets, memory-on-Swarm, agent marketplaces, a private balance-query wrapper, or broad “verified AI work” escrow. Their nearest neighbors are documented, not assumed away. Arkiv's own [August ideathon board](https://ideathon.arkiv.network/) is especially important: it already includes many expiry, delegation and agent-memory pitches. Those entries are published ideas, not necessarily deployed products, but the sponsor has already seen the stories.

### Why REPRISE comes first

An initial user is a small web3 finance team outsourcing an approved supplier-payment run to an automation provider. The concrete job is: reconcile the approved invoice manifest, settle three authorized stablecoin obligations, and deliver a portable settlement report. AI may assist reconciliation, but the owner approves exact obligations; model judgment never becomes spending authority. Start with approved invoices, not autonomous negotiation or unverified invoice extraction.

The failure case is provider loss after the first payment. The user's current operator may be unavailable, its database inaccessible and its local acknowledgement missing. A user-controlled replacement should reconstruct completed effects from the chain and original inputs from encrypted storage. The user must not have to give the replacement its treasury key. A second operator can be the user's own recovery runner; no marketplace of speculative agents is required to start.

**Closest prior art:** Restate already documents a payment/receipt replay example, retries, journals and zombie-process handling. DBOS already supports decentralized execution coordinated through a shared database. REPRISE must not claim those abilities are new or that those systems lack high availability. Its hypothesis is an interoperable job package and authority boundary spanning independently administered operators without depending on the previous operator's journal. Existing durable engines can run inside each operator. ([Restate concepts](https://docs.restate.dev/foundations/key-concepts), [DBOS architecture](https://www.dbos.dev/blog/scaleable-decentralized-workflows))

The backup operator must be explicitly enrolled and able to decrypt before the primary starts; no automatic key disclosure to an arbitrary replacement is implied. Initially use a user-operated backup with test gas. A commercial service needs an agreed recovery fee or retainer and a specified gas payer; the local financial probe does not implement either. Do not pay an unbounded fee for repeated failed attempts.

The business case remains unproven. A managed workflow engine plus backup may be simpler and cheaper for most teams. Target cases where provider independence matters enough to justify public settlement and portable state. A possible business is managed recovery monitoring or a paid operator adapter, not a required new token. Do not project revenue until someone prefers this failure/recovery model over their current process.

## REPRISE's implementation boundary

| Component | Authority and responsibility | What it must not pretend to prove |
|---|---|---|
| Owner-approved job | Exact immutable steps: chain, contract, job/step, asset, recipient, amount and permitted workers | Truth of an invoice or quality of an agent's reasoning |
| Fuji settlement contract | Funded effects, consumed steps, current worker/epoch, deadline, cancellation and authoritative result commitment | That an arbitrary remote API, bank payment or email ran exactly once |
| Arkiv | Typed discovery records, current advertisements, native expiry, WSS notifications | Exclusive execution authority; expired visibility is not cryptographic cancellation |
| Swarm | Encrypted original inputs and versioned recovery artifacts available to authorized replacements | Correctness of self-reported progress, permanent storage, or erasure of downloaded plaintext |
| Independent worker | Verify the job, read authoritative chain state, obtain a fresh lease, execute remaining supported steps | Permission to invent new obligations or trust a stale checkpoint over chain state |
| Optional ENSv2 | Organization-controlled namespace and narrowly delegated record publication on Sepolia | Automatic revocation of Fuji authority or secrecy of public records |

Each payment effect is fixed by the owner. A worker cannot manufacture another effect identifier for the same approved step and charge again. Recovery rotates an execution epoch; both payment and final-result paths check it. A stale worker may still compute or upload orphaned bytes, but those bytes must not become the job's authoritative completion. Lease expiry alone does not stop a process; the protected effect checks must reject it.

The recovery package must be published **before** the first irreversible action, including the immutable input manifest and enough instructions for another implementation to continue. Completed payments are derived from finalized contract state rather than trusting a worker's latest checkpoint. Mutable progress pointers need authenticated versions and an anchored authoritative reference; merely fetching a content-addressed file does not establish that it is the latest one. Retention and a recovery-key path must outlast the availability lease.

Use client-side authenticated encryption and recipient key envelopes for the owner and explicitly selected backup operator. Keep decryption material out of Arkiv and ENS. Unknown future operators require a later authorized key release; a public job listing is not permission to decrypt. An already authorized worker may retain disclosed data after revocation. Public payments also reveal amounts, timing and addresses. This is confidential job input, not private settlement.

The contract must arbitrate races on Fuji. Arkiv may report a worker disappeared before or after its contract lease expires; either discrepancy should affect recovery latency only, never allow double payment. If Arkiv is unavailable, a holder of the job reference should still be able to inspect, cancel and recover through the contract. In normal operation, native Arkiv expiry changes the live discovery query without a delete worker. A bounded query after WebSocket reconnect reconciles missed events; it is not disguised polling presented as a socket.

For ENS, start with a scoped `receipt` or `operator-manifest` record grant and demonstrate an unauthorized unrelated-record write failing. The owner separately enrolls the worker on Fuji. Show both control states. Do not spend the prize budget implementing an unnecessary Ethereum-to-Avalanche trust bridge just to hide that separation.

## The three-minute demonstration to build

1. **0–30 seconds:** open a real approved three-invoice job. Show the encrypted recovery package and two separately authorized operators. Verify backup retrieval before starting; no treasury key is shared.
2. **30–60:** operator A executes the first test-USDC payment. Stop its process after inclusion but before its local acknowledgement/checkpoint. Remove access to its local database from the recovery path.
3. **60–105:** its Arkiv availability expires. A separate operator discovers the recoverable job through the same query/subscription path, fetches the Swarm package, obtains a valid new Fuji epoch and reconciles paid steps.
4. **105–135:** operator B finishes the remaining approved payments and publishes a report. Inspect actual recipient balances and event identifiers in an independent client.
5. **135–165:** revive A. Replay the old payment and attempt an old-epoch completion. Both fail; the independently observed balances and accepted result remain unchanged.
6. **165–180:** download the report without the original service. Optionally show the ENSv2 scoped-record rejection if it fits without obscuring the financial result.

The memorable moment is a real process failure and recovery, not an animation. Two processes on the same laptop demonstrate software isolation, not independently operated organizations. Keep the distinction visible. Do not add a simulated cloud outage badge and call it a real provider incident.

## Evidence, validation gates and stopping conditions

Read-only probes already establish working Arkiv raw and SDK WebSocket subscriptions, Fuji connectivity and nine ENSv2 deployed contracts with consistent relationships. They do **not** establish sponsor write access or a completed bounty flow. Exact output and reproducible scripts are in [sponsor-probes](sponsor-probes/).

A separate [contract feasibility probe](recovery-probe/README.md) tests the narrow payment/epoch state machine with local EVM token transfers. **Ten tests passed, including 256 fuzz cases**, both on the worker branch and in an independent integrator rerun. Its results and limitations are kept with the code and in [integration-evidence.json](integration-evidence.json). This research prototype is not a deployed REPRISE product, a full audit, or evidence of live Arkiv expiry, Swarm retrieval or cross-operator recovery. It simulates a missing acknowledgement and advances EVM time; it does not kill a real worker process. The owner must avoid approving one business invoice under two different step IDs.

Before promoting REPRISE from lead prototype to full product, require:

- A cold second implementation recovers with no primary database, hidden shared filesystem, owner private key or uncommitted checkpoint.
- At least two crash positions pass: before payment inclusion and after inclusion/before acknowledgement. Stale completion, wrong recipient, duplicate step, expired authority and owner cancellation have negative tests.
- A real Arkiv write/expiry/read sequence and two-client WSS update; Swarm upload and independent encrypted retrieval; funded Fuji end-to-end execution. Read access is insufficient.
- A small finance/automation team identifies a concrete provider-loss or reconciliation situation and compares this approach with Restate/DBOS/backup. Ask for an example and a recovery exercise, not whether “decentralized agents” sound good.
- The recovery delay, transaction cost and encrypted-storage overhead are measured. No universal completion guarantee: no available authorized worker, missing keys, unpaid retention, chain outage or unsupported external effects can stop progress.

Kill or narrow the proposal if a replacement still needs the original provider's secret journal, if payment is only cosmetic, or if its real use case is entirely handled by a trusted shared database. Keep SWITCH as a consumer alternative only with an issuer willing to honor actual reassigned inventory; keep private qualification as a research-heavy alternative only after running its real proof code. More sponsor logos are not a reason to skip these gates.

## Reading map and provenance

- [Prior winners and consumer alternatives](winners.md): pinned local inspections, demo analysis and issuer/adoption constraints.
- [Frontier screen](frontier.md): eight mechanisms, recent dates, direct prior art and unresolved proof dependencies.
- [Sponsor strategy](sponsors.md): payouts, rule conflicts, exact ENSv2 permissions, WSS evidence and access gates.
- [Additional research](additional-research.md): private reads, fair exchange and recovery incumbents that changed the ranking.
- `*-sources.json`: source inventories; probe directories retain executable scripts and observed results.

Independent research workers began from `920d66d45bfa1843f429a5f473a133cf863820d6` in isolated worktrees. Their commits are integrated with attribution; root owns this synthesis. Previous project code was inspected but not repackaged as new work. No customer outreach, sponsor form submission, real-money spending or production transaction occurred in this research round. The recommendation is concrete and falsifiable; the remaining commercial uncertainty is explicit.
