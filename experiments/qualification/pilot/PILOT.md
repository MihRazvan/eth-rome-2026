# One issuer, two independent clients: pilot worksheet

This is a proposed validation protocol and an unsent outreach draft. No issuer/client participant is recruited, named, represented as committed or contacted by this document. The user's instruction authorizes implementation, not messages to unspecified people. Pilot dates and people remain unassigned until they opt in.

## Decision to test

Would two independent clients accept one assessment issuer's portable permission to perform confidential technical reviews, while avoiding routine disclosure of the reviewer's credential identifier or whole profile? Would an assessment collective operate issuance/revocation, and would a reviewer use the local proof flow for a second client without re-enrollment?

The test is not whether a proof verifies; the existing local experiment already establishes a bounded technical result. The decision is whether minimized disclosure and portable assessment remove enough real friction to justify wallets, issuer operations, encrypted document delivery and onchain settlement. Do not count sponsor eligibility, friendly compliments, fabricated reviews or testnet transfers as demand.

## Participant and trust worksheet

| Role | Unfilled commitment to obtain | Role separation |
|---|---|---|
| One issuer | Assessment policy owner; one generic technical-review class; expiration, appeal and revocation policy; accountable key/root operator | Holds issuer authority, never requests holder secrets; no pretend recognized accreditation |
| Client A | Supplies one realistic, safely shareable review task, stated quality rubric and approval decision | Controls A's own wallet and document key; cannot impersonate B |
| Client B | Independently supplies a different task and explains whether A's issuer/class is acceptable | Controls B's own wallet/device; does not inherit A's decrypt authority |
| One reviewer | Consents to assessment and performs both tasks; preserves holder-local credential and device key | Proves locally; server receives proof/public inputs only |
| Arbitrator | Explicitly accepts a limited test dispute role and timeout expectations | No invisible integrator override; explain possible stalled-dispute behavior |
| Facilitator | Records errors, timings, decisions and support interventions | No transaction impersonation; no undisclosed private key collection |

Individuals may consent to multiple organizational roles for an initial usability session, but that weakens the independence claim. Record overlaps. The facilitator may run a clearly labeled rehearsal with test accounts; that is not a recruited pilot. Agree whether any personal data is collected before beginning. Prefer synthetic/non-sensitive task content in the first public-network session, even though bytes are encrypted.

## Preconditions and stop conditions

- Record repository/deployment revision, actual network, contract addresses and verifier setup provenance. The Groth16 setup remains experimental and has no production ceremony/security assurance; use test assets only.
- Run `preflight.mjs`, preserve its actual output, and resolve public gates through authorized accounts. If resources remain missing, run the explicitly local rehearsal and label the public pilot blocked; never swap endpoints under a public label.
- Have each wallet/device register its current key and confirm recipients before encrypting. Demonstrate reload persistence and the documented new-device/key-loss limit. No participant shares a wallet private key or credential with the facilitator.
- Agree task class, expected work, exact token/base-unit reward, acceptance/submission/review deadlines, approval/dispute policy and intended recipients before funding. Clients consent to public job/reward/payment metadata. The issuer and reviewer understand correlation from small cohorts, timing and reused payout addresses.
- Public assignment advertisements contain only allowed generic metadata and ciphertext references. Issuer snapshots are whole-state downloads; no per-credential URL lookup.
- Stop the session if plaintext/holder secrets reach a server, the wrong recipient decrypts, unauthorized funds move, someone cannot identify the current recipient or chain, or a participant cannot give informed consent. Retain a minimal redacted reproduction rather than asking them to repeat the risky action.

## Session sequence and observable evidence

| Step | Participant action | Evidence to record without secrets |
|---|---|---|
| 1. Baseline | A and B describe their existing reviewer selection/payment workflow before seeing the product | Current verification effort, information actually required, alternatives used; direct quotes only with permission |
| 2. Assessment | Issuer applies its real stated policy, issues once through its own durable registry | Policy/version, public root epoch, issuance success; no credential/index/holder secret in the shared worksheet |
| 3. Separate accounts | A, B and reviewer connect independent wallets and register device encryption keys | Public registrations, key versions/expiry, browser/device distinction |
| 4. First task | A funds and publishes a generic class advertisement; reviewer discovers it via Arkiv | Actual entity/transaction IDs, deadline, exact reward, route observed; no local fallback |
| 5. Prove and accept | Reviewer downloads whole issuer state and runs local proof for exact A job and payout recipient | Elapsed proof time, public verification result and acceptance receipt; no witness or credential upload |
| 6. Deliver and pay | Reviewer encrypts for authorized recipients, stores bytes; A independently retrieves/decrypts, evaluates and approves | Ciphertext reference, integrity result, recipient key versions, approval/payout receipts, quality rubric outcome |
| 7. Reuse with B | Reviewer uses the same qualification for B's distinct funded job without re-enrollment | Whether B accepted the issuer policy; new job-bound proof/receipt; B's independent retrieval/decryption; A cannot decrypt B-only content |
| 8. Revocation boundary | Issuer revokes the test qualification and publishes current whole state | New acceptance rejection under the current root; already-earned payment remains valid; no false erasure claim |
| 9. Expiry and recovery | Let a separate funded publication expire naturally, then test documented device reload/key rotation behavior | Arkiv before/after native expiry block and query; independent UI response; old ciphertext/key retention limits, not a claimed recall |
| 10. Decision interviews | Each participant compares observed costs with their baseline | Repeat intent tied to a concrete next task, objections, unacceptable disclosures and support burden |

Time actual user actions rather than inventing targets or benchmark success. Separate confirmation delays, proof computation, content transfer and facilitator assistance. If an action needs the integrator's terminal or signing key, record that intervention. Public evidence should contain transaction/content references only where participants consent; private work content and assessment records stay outside Git.

## Acceptance, rejection and follow-up decisions

Before the session, ask each participant to state a concrete acceptable support/time cost for their existing workflow; record those thresholds before results are visible. A credible positive pilot requires both clients independently accepting the same issuer/class, two actual evaluated tasks, successful authorized delivery/payment, no unintended disclosure and the reviewer completing the second presentation without re-enrollment. It also requires a next-task commitment from at least one client and an issuer willing to repeat operations under a documented policy. This is small-sample evidence, not product-market fit.

Reject or narrow the thesis if both clients still demand the same complete identity/profile, if an ordinary pseudonymous roster satisfies the whole need more cheaply, if assessment trust cannot transfer to B, or if key/proof operations require continuing integrator custody. Reconsider a mature credential stack if interoperability matters more than this custom EVM workflow. A technically passing pilot with no willingness to repeat is a commercial negative. Record withdrawals and negative interviews, not just completers.

Worksheet fields: session date/network/revision; consenting roles and overlaps; original workflow; agreed thresholds; task rubric/reward/deadlines; action timings; support interventions; failures; actual disclosure matrix; issuer operations burden; client A/B repeat decisions; reviewer preference; final continue/narrow/stop decision and owner. Leave participant identities and confidential answers in a separately authorized private record, not this repository.

## Outreach draft — not sent

> We are testing Review Pass, an experimental way for assessed reviewers to accept confidential paid review tasks for more than one client without sharing a full qualification profile each time. We are looking for one assessment collective and two clients willing to evaluate the workflow with realistic, non-sensitive tasks and testnet assets. This is an early pilot, not a production credential or payment service. We want to learn whether it improves your current process; a negative result is useful. Participation would involve agreeing an assessment/quality policy, using your own test wallet/device and discussing what information you actually require. We would not ask for wallet private keys or confidential credential files. If interested, we would agree scope, data handling, time commitment and compensation before scheduling anything.

Recipient, channel, compensation and sending authorization are intentionally unfilled. Do not send this draft or submit a participant form without specific authorization.
