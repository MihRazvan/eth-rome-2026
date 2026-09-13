# Cutout — selective UX priorities

13 September 2026. Assessment of external AI suggestions against the actual product and current rules. The immediate goal is a clearer, more polished user flow, not expanding the protocol to match every suggested feature.

## Decisions

| Suggestion | Decision and reason |
| --- | --- |
| Richer reviewer discovery | **Keep the user need.** Existing compound queries already select deployment, class, token and numeric minimum reward. Make the reward/deadline easier to compare and add presentation sorting over all verified query results. Avoid unused schema fields. |
| “Query depth is 30%” | **Outdated scoring.** The current [Arkiv hub](https://hub.arkiv.network/ethrome) instead weights fit 30%, execution25%, usefulness20% and feedback25%. Keep strong queries because they solve discovery, not to optimize an obsolete rubric. |
| Only hashes in every attribute | **Reject as a blanket rule.** Typed public reward/class/deadline fields enable useful queries. Credential identifiers and secrets stay out. Public wallet/timing data remain linkable. [Attribute/payload rationale](../../arkiv/schema.md). |
| Heartbeat lease for accepted work | **Reject.** Arkiv disappearance must not reopen a Fuji-assigned task or erase earned rights. It adds transactions and a heartbeat operator. Existing recruiting expiry already changes a real user-facing board and has public evidence. |
| WebSockets without historical start block | **Already implemented and documented.** Native WSS plus current-state reconciliation after reconnect; no claim of gap-free replay. [Feedback](../../feedback.md), [code](../../experiments/qualification/pilot/listings.ts). |
| Claim Mission01 from invented history | **Reject.** No qualifying Cutout indexer migration is claimed. Preserve actual earlier project history. |
| Force Swarm ID into onboarding | **Reject for this UX.** An extra account/setup loop was already a user blocker. The supplied Swarm brief explicitly makes it optional. Gateway-funded uploads already work without a customer account; the optional ID adapter remains. |
| Make every guided demo upload | **Keep the distinction.** The walkthrough is explicitly simulated and starts immediately. The real workspace already performed public Swarm upload/retrieval and a paid review. Show those receipts/live flow for integration judging instead of silently making the no-account walkthrough depend on a network write. |
| “Nobody can withhold or de-list the report” | **Reject the guarantee.** Content addressing gives verifiable document references. Storage retention, gateway availability, key loss and pre-delivery withholding still exist. |
| Ciphertext padding | **Useful later privacy work, not a UX fix.** It can reduce length precision; it does not hide timing or wallet linkage. Requires an explicit envelope format, authenticated length, bounded parsing and compatibility tests before claiming it. No padding implemented in this pass. |
| Feeds for key rotation/revocation | **Defer.** Fuji already authenticates report keys. A second mutable authority complicates recipient selection, and rotation cannot revoke previously learned plaintext or keys. |
| Switch Team1 tracks | **Keep TrackA.** [Current Team1 rules](https://build.avax.network/events/73a939b1-6d35-4847-9388-320024638249) distinguish stablecoin work/payment apps from tokenized-asset issuance/transfer/settlement. We sell a review service, not a tokenized asset. There is no evidence that the other track is less competitive. One entry only. |
| Complete the public paid lifecycle | **Already done.** Task4 paid0.1 canonical Fuji testUSDC; finalized receipts, balance reconciliation and browser decryption are [recorded](evidence/saved-pass/README.md). Human extension rehearsal remains separate. |
| Explain the problem before the stack | **Keep.** “Pay for a focused technical review without publishing the reviewer’s credential or the report.” Eligibility is issuer approval, not proof of competence. |
| Separate sponsor submission | **Keep.** Team1 Builder Hub entry and slides remain a human submission item; no form completion is claimed. |
| Distinct payout address | **Defer contract/account redesign.** Fresh addresses alone do not remove funding, timing or wallet correlations. Do not market the current payment as anonymous. |
| Add random delays or batch acceptance | **Reject for this release.** Added waiting does not solve visible wallet linkage and makes proof/acceptance harder to demo. |
| Whole snapshots / task-scoped nullifier | **Already implemented.** Browser fetches the whole revocation snapshot and derives its witness locally; no public reviewer profile is built from the nullifier. |
| Anonymous public scope by default | **Keep data minimization, reject anonymity claim.** Public brief guidance excludes secrets. The funding wallet remains public regardless of whether a company name is omitted. |
| Brand promises invisibility / “cooling” metaphor | **Reject.** Cutout keeps credential details and reports private; it does not hide participants or payment trails. Keep the existing paper/cutout identity and plain language. |

## This interface pass

- Paper task cards with reward, acceptance cutoff, verified scope and one clear action.
- Minimum-reward filtering retained; closing-soon/highest-reward sorting makes comparison useful without schema or settlement changes.
- Compact live status and useful empty state; technical stream details available on demand.
- Opened report becomes a verified state; download enables only after decryption. Payment safeguards remain.
- Metadata describes both report recipients accurately. No extra signup, artificial waits or mandatory credential downloads.

The browser's local date formatting and result sorting are presentation only. Contract state remains authoritative. Full service security/issuance limits remain in [security](SECURITY.md) and [qualification](QUALIFICATION.md).
