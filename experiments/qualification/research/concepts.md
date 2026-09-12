# Two application concepts and a three-role demonstration

Design research, 12 September 2026. These are text concepts, not screenshots of implemented software. Test credentials, test USDC and toy cohorts must be labeled on every route. Both use the proposed relation; neither claims anonymous employment.

## Concept A — REVIEW PASS

**“Approved to review. No certificate number required.”**

A restrained work ticket, not a public talent marketplace. The reviewer arrives through a specific client's invitation. The interface emphasizes what that client learns, the exact task and payment, and when qualification was checked.

```text
REVIEW PASS                         Fuji · test assignment
Allowance-flow second opinion                          25 test USDC
Client: named project team       Issuer: Test Review Collective

WHAT THIS CLIENT WILL LEARN
✓ Current permission for this task class
✓ A job-specific duplicate-prevention value
✓ Your payment address and eventual payment
  Certificate number, index and complete document remain hidden

Issuer state: block … / checked …       Application closes …
Your locally held credential: ready     Proof method: local CLI helper

[Review exact assignment terms]  [Prove eligibility and accept]

Payment terms
Client approval releases 25. Review quality is assessed by the client.
Later qualification revocation does not erase approved payment.
```

The accepted view replaces the qualification gate with a work receipt: confidential brief, artifact upload, client review, approved amount, withdrawable/paid amount and transaction. Do not keep an identity dossier in the side panel. A second client opens a separate job and receives a distinct scoped nullifier. The UI explicitly points out that reusing the payout wallet still links those jobs.

**Issuer view:** a small assessment register with locally issued test credentials, revoke/reissue, current published root and state distribution health. The issuer must not see a “clients this reviewer visited” analytics screen. **Client view:** exact trusted issuer/class policy, funded amount and acceptance receipt; no credential-index search field. A separate “What was disclosed?” panel shows the actual public inputs.

This is the selected direction because a concrete work obligation and privacy boundary can fit one screen. It also allows a human quality decision without pretending the ZK proof evaluated the review.

## Concept B — QUIET PANEL

**“A trained participant, without another personal dossier.”**

A research-session application for an accessibility panel. The design is an invitation/consent document rather than a trading ticket. It proves a panel-training class, not a disability diagnosis. Eligibility and task participation disclosures are separate steps.

```text
QUIET PANEL / Research invitation
Try the checkout with your usual assistive technology
30 minutes · fixed compensation · session deadline

Step 1 / Panel eligibility
Prove current training approval from the named panel operator.
This step does not send your certificate index or full profile.

Step 2 / Decide what this session shares
The study may reveal your voice, screen, assistive technology or identity.
Read the specific session request before accepting.

[Inspect eligibility request]     [Review session disclosures]
```

Select only if a real panel operator wants cross-client credentials. Do not add filters that reveal a participant's sensitive attributes on a public Arkiv index. Small cohorts and recordings defeat a broad anonymity claim. A text-only task is a useful demonstration boundary but does not prove that all accessibility research can avoid personal disclosure.

## Recommended 90-second three-role story

| Time | Role/action | Evidence shown |
|---|---|---|
| 0–15 s | Issuer signs a holder-generated commitment after a clearly labeled test assessment; publishes shared current state. | Named test issuer, credential class/expiry, chain root and retrievable snapshot. Holder secret never enters issuer logs. |
| 15–30 s | Client funds one exact review assignment. Holder examines the disclosure panel and proves locally. | Real proof verification, accepted assignment and bound recipient; no credential serial/index in public inputs. |
| 30–45 s | Holder attempts the same assignment with a changed recipient, then presents the proof to client B's job. | Both reject. A fresh client-B proof has a different scoped nullifier. Same-wallet linkage is called out if present. |
| 45–60 s | Issuer revokes the credential and publishes a new authoritative root. | New acceptance rejects both revoked witness and stale-root proof. Discovery updates through actual WSS, not a timer standing in for contract state. |
| 60–75 s | Client approves the already-performed first review and pays under its original terms. | Actual test-stablecoin settlement survives later revocation; balances and receipt reconcile. |
| 75–90 s | Holder retrieves the encrypted artifact through a second client; inspect verifier-visible data. | Real Swarm bytes decrypted locally, private fields absent from public transport; block, issuer and payment exposures remain visible. |

The short pitch must not call a manually seeded task a customer commission. Use a longer recorded negative-test appendix for wrong class, wrong secret, bad path/index, invalid signature, expired credential/deadline and cancellation/refund cases. Native expiry is a discovery behavior; separately show the same Arkiv query before/after expiry without a delete call.
