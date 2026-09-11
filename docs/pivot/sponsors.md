# Sponsor combinations for a complete product pivot

The strongest strategy is a coherent product with an independently verifiable failure case, primarily targeting Arkiv, Swarm and Team1. Add ENSv2 when delegated namespace or record authority is central to that workflow. An ENS label on an otherwise unchanged payment screen is both weak product design and explicitly insufficient for its bounty. This is a selection judgment, not a forecast of winning or evidence of customer demand.

The main ETHRome award remains worth pursuing: one annual Urbe Hub membership for each member of the single winning team, up to three people. It is an **in-kind award**, with no verified cash equivalent, transferability or redemption value. A team able to use Rome coworking may value it substantially; it must not be added to sponsor dollars. Main judging allocates 50% to code, 25% to innovation/significance, 15% to feasibility and 10% to creativity. Complete implementation, understandable operation and meaningful technology use are explicitly scored. Extra logos have no separate scoring benefit.[^prizes][^judging]

## Current rules and honest prize arithmetic

The official Arkiv event hub now differs materially from the supplied brief and ETHRome's own published prize page. The sponsor hub denominates its pool in **EUR 2,500**, with EUR 500 per mission and EUR 1,000 overall; it still permits only one award per team. Its scoring is now **why Arkiv 30%, execution 25%, usefulness/adoption 20%, feedback 25%**. The older event brief instead uses USD, emphasizes query depth, and describes a USDC-on-Ethereum payment rail. Prefer the current sponsor-owned criteria for product planning, but retain the discrepancy: the hub does not resolve conversion, settlement currency or the older payment promise.[^arkiv-hub]

| Award | Maximum for one winning project under published rules | Do not count |
|---|---:|---|
| Arkiv overall | EUR 1,000 | The other three mission awards as additional winnings |
| Arkiv mission instead | EUR 500 | Three mission awards for doing all missions |
| Swarm | USD 500 | Both USD 500 winner slots |
| Team1 Track A | USD 400 first, or USD 200 second | Both placements or Track B as well |
| Team1 Track B | USD 300 first, or USD 100 second | Both placements or Track A as well |
| ENS | An unspecified share of USD 500, up to five winners | USD 500 per winner; a guaranteed equal split |
| ETHRome main | Up to three annual memberships | A fabricated dollar value |

Sponsor applications can stack where the project genuinely qualifies; selections remain independent sponsor decisions. Team1 is the explicit one-track exception. Therefore Arkiv-overall + Swarm + Team1-A has a **conditional upper payout of EUR 1,000 + USD 900**. Adding ENS raises the mathematical ceiling to **EUR 1,000 + USD 1,400**, only if this project receives the entire ENS pool. With a hypothetical five-way equal ENS split, that becomes EUR 1,000 + USD 1,000; equal division is not promised. Track B reduces either total by USD 100. Arkiv + Swarm + ENS alone has a ceiling of EUR 1,000 + USD 1,000. All outcomes can be zero.[^prizes]

These ceilings are not expected values. A useful planning expression keeps currencies separate:

`E[EUR] = 1000·P(Arkiv overall) + 500·P(any Arkiv mission award)`

`E[USD] = 500·P(Swarm) + 400·P(A first) + 200·P(A second) + P(ENS)·E[ENS share | selected]`

Arkiv outcomes are mutually exclusive; Team1 placements are mutually exclusive. Linearity does not require independent selections, but no defensible probabilities or conditional ENS allocation are available. A stronger main-prize demo may also improve several sponsor prospects together. There is no reason to assign equal probabilities across awards or to optimize against the aggregate advertised pool.

Operational qualifications remain material. Teams have at most three physically present members. Existing work must be disclosed, its history preserved, and only work after Friday 18:00 counts. Repository reshuffling does not reset provenance. The submission closes Sunday 13 September at 10:00 Europe/Rome; the walkthrough must be no longer than three minutes, and code stays open for four weeks. Current ETHRome and Team1 form links still appeared unresolved in the inspected official pages. Arkiv now links its own Tally submission; its form returned HTTP 403 to a read-only request, so its exact fields were not inspected. The older published Arkiv qualification also requires `/arkiv/schema.md`, `friction.md` and a conversation by Saturday 20:00: omission from the shorter hub is not evidence those obligations were waived.[^rules][^submissions][^manual][^arkiv-form]

## Executable sponsor capabilities

**Arkiv:** both public transports are reachable on Tiramisu, chain 7738577. The raw WebSocket probe subscribed to logs from Arkiv's operation address and received 15 real entity notifications during 15 seconds. A separate installed SDK 0.8.1 probe used `webSocket(...)`, omitted `fromBlock`, and received ten decoded `EntityCreated`/`EntityDeleted` events with zero reported errors. This establishes a functioning read subscription, not an application two-wallet write demonstration, reconnect correctness or guaranteed future uptime.[^arkiv-network]

The current SDK delegates to viem's `watchEvent`. HTTP uses polling; a supplied historical start block also selects polling by default. Use an explicit socket for live delivery and a separate bounded reconciliation query after reconnect, deduplicating by event position. Arkiv's current Live Events guide still presents HTTP/polling, while the event hub requests a socket: this is a precise documentation friction finding. A new project should target native expiry and Live Wire, not invent an indexer migration to qualify for Decommission. Native expiration should remove discoverability/availability; contract money rules still need explicit onchain deadlines.[^arkiv-events][^arkiv-code][^viem-events]

**Swarm:** the event supplies storage gift codes, and Swarm ID is encouraged, not mandatory. Identity connection is insufficient: the documented client requires authentication plus upload capability, backed by a usable stamp or configured funded gateway. A custom Bee URL disables the subsidised fallback; the identity iframe's origin matters for CORS. This research performed no login, redemption or upload, so current project write access remains unassessed. The existing September 11 access report describes human faucet/postage gates and must not be relabelled a fresh outage.[^manual][^swarm-id][^swarm-subsidy]

Swarm ID's pinned upload code constructs encrypted chunks client-side and supports stamped/subsidised routes. Nonetheless the full native encrypted reference contains a decryption key: never put that reference in a public ENS record or Arkiv attribute. Application encryption uploaded as ordinary bytes is a straightforward alternative. Portable receipt/deliverable bytes must be retrievable independently, not just a decorative hash. Key rotation can exclude a recipient from future versions; it cannot recall previously downloaded plaintext or keys. Storage address permanence also does not guarantee perpetual funded retention.[^swarm-code][^swarm-encryption]

**Fuji:** the official C-Chain RPC returned chain 43113 and block 58324457. Either sponsor track accepts test assets; there is no need to acquire real funds or add a custom L1. Track A fits operational stablecoin spending and escrow; Track B requires a tokenized financial right, an eligibility/transfer rule and settlement. Native Avalanche interoperability is optional. ICM verifies Avalanche validator-set messages: it is not a ready-made Ethereum-Sepolia-to-Fuji ENS bridge.[^manual][^avax-icm]

**ENSv2:** nine current official Sepolia deployment addresses had nonempty bytecode; the registrar points to the current ETH registry, the root's `eth` subregistry points there too, and the managed resolver proxy points to the current v2 resolver. The probe records one block/hash for all dependent reads and code hashes for reproducibility. The registrar requires a 60-second minimum commitment age and 2,419,200-second minimum registration duration. Its MockUSDC uses six decimals and documented permissionless minting, but Sepolia gas remains necessary. No mint, registration, role mutation or funding action was attempted.[^ens-deploy][^ens-app][^ens-artifact]

Use the canonical deployment table's pinned commit `97a57293f3b4279d94b571e678edb53ce62638f4`, then verify the relevant current relationships. The repository's current main commit and older June/July deployment artifacts are not interchangeable evidence. The probe's `integration-tests` label is **reserved**, with no owner, in this current ETH registry; generic documentation test-name suggestions are not proof a chosen name is registered. A production demo must create or select its actual live namespace, not hardcode successful records.

## ENS authority that can safely compose with Fuji

ENSv2 uses a registry hierarchy. To make a newly deployed child registry resolvable, its parent must point to it; possessing an ERC1155 token in an unlinked registry is insufficient. An ancestor's expiry or pointer change can disconnect the resolution path. Inspect the entire relevant path and identify retained administrator/upgrader powers rather than calling any subname intrinsically unruggable.[^ens-hierarchy][^ens-contract]

Registry permissions and resolver permissions are different capabilities. A registry's `ROLE_SET_RESOLVER` controls the pointer; it does not grant permission to change records in another account's resolver. Root-level roles apply to all resources and can defeat an apparently narrow local restriction. Admin roles can grant or revoke corresponding roles; name-level admin roles are restricted after registration. Approved ERC1155 operators can inherit the owner's effective registry roles. A clean delegation UI should expose effective authority, not merely one local grant.[^ens-eac][^ens-registry]

For record delegation, use `authorizeTextRoles(DNSName,key,delegate,true/false)` or the address/data equivalents. Generic name/resource `grantRoles` and `revokeRoles` are deliberately disabled on PermissionedResolver. Record permissions can arise through broader name/root scopes, so removing one key-level grant is not proof that the account can no longer write. Resolver content clearing increments a record version; it is not a blanket role revocation. The pinned source does not make record setters automatically test the current registry owner or expiry.[^ens-resolver][^ens-source-resolver]

Use registry address plus stable labelhash/canonical identity when tracking names, while obtaining the current token and resource at execution. Role changes regenerate the token; renewal and ordinary transfers do not. The registry transfer hook moves the old owner's roles to the new owner, not every third-party delegate's permissions. Do not generalize “ownership changed” into “all delegates revoked.” Expiry affects the registry's active resource/ownership logic, but never grants a Fuji contract direct knowledge of that fact.[^ens-token][^ens-source-registry]

A defensible two-chain composition has three explicit steps:

1. **Sepolia authority:** an organization gives a worker permission to update only a work-order manifest or receipt pointer in its ENSv2 namespace. Demonstrate the permitted update, rejection of an unrelated payout-record update, and explicit revocation.
2. **Fuji authorization:** a treasury owner separately approves a bounded stablecoin mandate/escrow: exact chain, contract, token, payee, amount cap, deadline and replay-protected identifier. The Fuji contract enforces these fields and its own revocation epoch. A Sepolia observation may inform the human authorization; it is not itself a trustless Fuji proof.
3. **Portable verification:** Arkiv exposes active requests; Swarm carries signed evidence. Consumers resolve the current namespace and compare the signed manifest to the Fuji action. Report observation time and distinguish a now-revoked publisher from an already valid financial obligation.

If automatic cross-chain permission reflection is essential, name the trusted attestor/relayer, cap observation age and residual authorization lifetime, bind source block/registry/version and define outage behavior. That introduces trust and asynchronous revocation latency. Do not call it atomic or claim ENS expiry instantly cancels allowances, already signed payments, previously disclosed keys or existing escrow obligations. The simpler owner-approved snapshot is usually the better demonstrable boundary.

## Three candidate concepts

These are hypotheses with falsifiable user tests, not established markets. “Necessary” below means each integration carries a required product responsibility; none of these infrastructures is uniquely irreplaceable by any alternative technology.

### 1. Mandate — delegated purchasing with a receipt trail

**User/job:** a small distributed organization lets a temporary operator source a service and prepare evidence without giving that operator unrestricted treasury authority. The product shows exactly what the operator can publish, what the treasury has authorized, and what happens when the engagement ends.

**Four necessary roles:** ENSv2 supplies an organizational namespace with narrow receipt/work-order record delegation; Fuji enforces a stablecoin budget with payee/amount/deadline constraints; Arkiv discovers expiring purchase invitations and accepted responses through typed filters and socket events; Swarm preserves client-encrypted quotes, receipts and signed approvals that both parties can export. Swarm is justified by parties retaining evidence independently of the purchasing app; Arkiv by a neutral active-request layer writable by distinct parties rather than one operator's database.

**Decisive demo:** owner grants receipt-key permission; operator publishes evidence and fails to alter payout destination; supplier accepts a bounded order; treasury pays through Fuji; authority is revoked and a subsequent record write fails; a separately revoked Fuji mandate also fails. The UI must display those last two revocations separately. An expired unaccepted invitation disappears naturally, while the signed receipt stays retrievable.

**Track/risks:** Team1 A. Strongest four-way integration story and an excellent negative test, but procurement software and smart-account controls are established categories. The new value must be visible division of authority and portable evidence, not “an agent has a name.” An LLM can prepare an order; deterministic rules must decide whether it can spend. Kill or narrow the concept if three target operators cannot identify a real recent delegation/reconciliation failure, or if the user journey needs multiple custodians solely to satisfy sponsors. Initial recruitment hypothesis: small web3 service teams and event organizers; no claimed first-100 pipeline exists yet.

### 2. Handover — milestone escrow with evidence both sides retain

**User/job:** client and contractor agree on one deliverable, reserve payment, transfer the artifact and explicitly accept or dispute it. The distinction is a shared evidence package surviving the disappearance of the intermediary, with a finite response/acceptance process.

**Three necessary roles:** Fuji holds test stablecoins and enforces milestone funding, approval, dispute and refund transitions; Swarm stores encrypted deliverables and signed scope/evidence; Arkiv carries active proposals, response deadlines and status discovery. Invitations can expire natively without deleting the underlying signed agreement. An optional fourth ENSv2 role would let a project lead delegate only delivery-record updates to a contributor and revoke that publishing authority later.

**Decisive demo:** the client funds; contractor uploads; client independently retrieves/verifies the bytes; an explicit acceptance releases payment once. In a second path, an unanswered invitation expires or a disputed milestone stays escrowed under a disclosed resolution policy. Do not equate a content hash with delivery quality, claim fair exchange from merely uploading ciphertext, or allow Arkiv record absence alone to release money.

**Track/risks:** Team1 A unless a genuine transferable financial right is introduced; do not mint an unnecessary NFT to reach B. Easier to understand and safer to demonstrate than a generic claim exchange, but crowded escrow prior art and subjective disputes weaken novelty. Kill if the problem statement requires an unavailable quality oracle or promises automatic satisfaction adjudication. For this concept ENS is the first sponsor to skip: signed party identities may already suffice, so hierarchy can easily become ornamental.

### 3. Commons — scoped reviewers and portable grant milestones

**User/job:** a small grant program assigns reviewers to milestones, gathers evidence and makes the final treasury decision inspectable. Review authority rotates without giving reviewers control of payment addresses or the treasury.

**Four necessary roles:** ENSv2 scopes named reviewers to particular evaluation-record keys; Swarm holds reproducible deliverables, reviews and the signed decision dossier; Arkiv makes open review assignments discoverable and removes unaccepted assignments at expiry, with live claimant updates; Fuji releases a funded stablecoin milestone only under its explicit approver/quorum policy. Expiry reopens staffing discovery, not the financial award. A retained signed decision can remain evidence even after a reviewer's current publishing permission ends.

**Decisive demo:** two reviewers see a live assignment; one receives a narrow record role and submits a signed report; an unauthorized funding-address edit fails; the treasury pays after its own approval; the next assignment expires and is no longer offered. The evidence can be downloaded by a second client and checked without the grant UI.

**Track/risks:** Team1 A. ENS and Swarm are more naturally central than in plain escrow, and Arkiv's public writable index is credible for cross-organization reviewers. The downside is subjective judging and governance complexity: signatures prove authorship, not competent review or grant impact. Kill if the demo becomes a dashboard of invented program data, or if access to a real grant administrator cannot establish that review assignment/evidence portability is painful. This is a narrower workflow prototype, not a decentralized reputation oracle.

## Selection and scope discipline

Prefer **Mandate** if live ENSv2 registration/delegation and a crisp dual-authority demo are achievable. Prefer **Handover with three sponsors** if that fourth integration obscures the user task. Commons is a viable alternative when a real grant operator can validate the workflow; without that contact it is a weaker feasibility story.

ENS has the smallest clearly bounded incremental pool and is the first candidate for removal when it adds a second-chain authority illusion. Conversely, an ENS-native delegation tool could drop Team1 and settle on Sepolia, keeping Arkiv/Swarm/ENS while losing at most the selected Team1 first prize; this can improve coherence if naming rights are the true product. Arkiv's overall award is the largest individually available cash-denominated award, so prioritize a defensible decentralized-data reason, native expiry and useful feedback rather than chasing all missions. Do not dilute a convincing three-minute demonstration to increase a theoretical upper payout.

Before choosing, require one real end-to-end probe for each integration that needs writes, one meaningful adversarial failure, a user-understandable state transition caused by native expiry, independently retrieved Swarm bytes, and a documented product problem. Those are implementation gates; the passive connectivity successes in this report do not satisfy them.

## Reproduction and limits

Run `node docs/pivot/sponsor-probes/network.mjs` and `node docs/pivot/sponsor-probes/sdk-socket.mjs` from an installed repository. The committed JSON files preserve the observed public results. Network observations occurred on September 11 UTC / September 12 Europe/Bucharest. Page digests are retained in `source-snapshots.json`; the source inventory records conflicts and unavailable form fields.

The first exploratory root-subregistry read mistakenly supplied a hex labelhash to an ABI string-label parameter; this queried a different label and returned zero. The corrected executable uses literal `eth`, and the retained run verifies the expected registry. No false outage is inferred from that discarded input error. No accounts, secrets, transaction submissions, form submissions, faucet claims or storage writes were used. Nine nonempty deployed contracts plus consistent getters prove read accessibility, not a full bytecode/source equivalence audit or a working writable product.

## Sources

[^prizes]: ETHRome, [Prizes and Bounties](https://www.ethrome.org/hackermanual/prizes.html). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^judging]: ETHRome, [Judging](https://www.ethrome.org/hackermanual/judging.html). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^arkiv-hub]: Arkiv Network, [Arkiv at ETHRome](https://hub.arkiv.network/ethrome). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^rules]: ETHRome, [Hackathon Rules](https://www.ethrome.org/hackermanual/rules.html). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^submissions]: ETHRome, [Submissions](https://www.ethrome.org/hackermanual/submissions.html). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^manual]: ETHRome / urbeETH, [Hacker Manual](https://github.com/urbeETH/ethrome-2026-hacker-manual/blob/3ffd55daec53c7ecb4ed3901ba034f328ea731c0/HACKER-MANUAL.md). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^arkiv-form]: Arkiv Network / Tally, [ETHRome sponsor submission](https://tally.so/r/vGZ98v). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^arkiv-network]: Arkiv Network, [Tiramisu](https://docs.arkiv.network/networks/tiramisu/). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^arkiv-events]: Arkiv Network, [Live Events](https://docs.arkiv.network/typescript-sdk/live-events/). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^arkiv-code]: Arkiv Network, [watchEntityEvents source](https://github.com/Arkiv-Network/arkiv-sdk-js/blob/ace83ed19ad0e9f56c15f3c54f7dc5b71bc0c3a0/src/actions/public/watchEntityEvents.ts). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^viem-events]: wevm, [watchEvent](https://viem.sh/docs/actions/public/watchEvent#poll-optional). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^swarm-id]: Snaha / Swarm ID, [Quick Start](https://swarm.snaha.net/docs/getting-started/). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^swarm-subsidy]: Snaha / Swarm ID, [Subsidised Gateway](https://swarm.snaha.net/docs/subsidised-gateway/). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^swarm-code]: Snaha, [Swarm ID upload implementation](https://github.com/snaha/swarm-id/blob/2f08cd94089852e66875a0158e3e4ed51c03a9d3/lib/src/proxy/upload.ts). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^swarm-encryption]: Swarm Foundation, [Store with Encryption](https://docs.ethswarm.org/docs/develop/tools-and-features/store-with-encryption/). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^avax-icm]: Ava Labs, [Deep Dive into ICM](https://docs.avax.network/docs/cross-chain/avalanche-warp-messaging/deep-dive). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^ens-deploy]: ENS, [Deployments](https://docs.ens.domains/learn/deployments/). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^ens-app]: ENS, [For App Developers](https://docs.ens.domains/ensv2/tutorial-app-developers/). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^ens-artifact]: ENS, [ETHRegistry deployment artifact](https://github.com/ensdomains/contracts-v2/blob/97a57293f3b4279d94b571e678edb53ce62638f4/contracts/deployments/sepolia/ETHRegistry.json). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^ens-hierarchy]: ENS, [Registry Hierarchy](https://docs.ens.domains/ensv2/registry-hierarchy/). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^ens-contract]: ENS, [For Contract Developers](https://docs.ens.domains/ensv2/tutorial-contract-developers/). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^ens-eac]: ENS, [Enhanced Access Control](https://docs.ens.domains/ensv2/enhanced-access-control/). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^ens-registry]: ENS, [Permissioned Registry](https://docs.ens.domains/ensv2/permissioned-registry/). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^ens-resolver]: ENS, [Permissioned Resolver](https://docs.ens.domains/ensv2/permissioned-resolver/). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^ens-source-resolver]: ENS, [PermissionedResolver.sol pinned deployment source](https://github.com/ensdomains/contracts-v2/blob/97a57293f3b4279d94b571e678edb53ce62638f4/contracts/src/resolver/PermissionedResolver.sol). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^ens-token]: ENS, [Mutable Token IDs](https://docs.ens.domains/ensv2/mutable-token-ids/). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
[^ens-source-registry]: ENS, [PermissionedRegistry.sol pinned deployment source](https://github.com/ensdomains/contracts-v2/blob/97a57293f3b4279d94b571e678edb53ce62638f4/contracts/src/registry/PermissionedRegistry.sol). Accessed 2026-09-12 Europe/Bucharest (2026-09-11 UTC); publication date not stated.
