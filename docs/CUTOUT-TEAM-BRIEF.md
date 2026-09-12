> Storage update, 12 September: the public app now includes gateway-funded Swarm uploads. Users do **not** need a Swarm account, drive or gift code. Refresh the app and check that Document storage says included. Earlier Swarm sign-in instructions below are superseded; private report encryption and credential enrollment remain separate.

# Cutout — teammate brief and demo guide

Prepared 12 September 2026 from the implemented app and recorded verification.

**App:** https://cutout-ethrome-2026.vercel.app  
**Instant walkthrough:** https://cutout-ethrome-2026.vercel.app/?view=demo  
**Working branch:** `review-pass/product`

## What it is

**Cutout lets you hire a qualified technical reviewer, receive a private report, and pay through an onchain escrow. The reviewer proves they qualify without exposing a reusable credential identifier.**

Example: a protocol changes withdrawal permissions and wants a focused second review. The client posts the question and funds a reward. An eligible reviewer accepts, investigates, and delivers an encrypted report. The client opens the report and approves payment.

The useful combination is portable qualification, private delivery, and funded work. We are not claiming to invent these primitives or to replace a full security audit.

The name and visuals express the privacy boundary: keep the qualification; cut out the identifier. Paper, ink, orange, perforations and the cut-open envelope belong throughout the application.

## How it works

1. **An issuer qualifies a reviewer.** The reviewer holds a signed credential and their own private holder secret. Today this is one experimental test issuer, not an accredited professional network. Initial enrollment is operator-assisted; there is no live collective/roster administration screen.
2. **A client funds a task.** Its public scope and test-USDC reward are committed on Avalanche Fuji. Swarm stores the scope; Arkiv provides discoverable, expiring listings.
3. **The reviewer proves eligibility.** Their browser generates a task- and wallet-bound zero-knowledge proof that the credential is valid and not revoked. The contract verifies it before assigning the work. Private credential files remain local.
4. **The reviewer delivers privately.** The browser encrypts the report for the client and reviewer before uploading it to Swarm. An onchain reference and digest bind the delivered bytes to the assignment.
5. **The client opens and pays.** Cutout retrieves, verifies and decrypts the report locally. The client approves payment or disputes delivery. A timely submission can become payable after the review deadline if undisputed; disputes depend on the configured arbitrator.

Qualification proves eligibility, **not report quality**. Wallets, payments and task metadata remain public; wallet reuse links jobs. Avoid saying “anonymous reviewers,” “nobody knows who you are,” or “guaranteed good work.”

## What works now — and what we must not blur

| Surface | Actual status |
| --- | --- |
| Public Cutout UI and no-wallet walkthrough | Deployed and tested in fresh desktop/mobile browsers. |
| Walkthrough report encryption/decryption | Real browser AES-GCM. Nothing is uploaded. |
| Walkthrough qualification, funding and payment | Explicit simulations; no proof verification or chain transaction. |
| Complete local contract/storage lifecycle | 21 browser checks passed, including proof acceptance, two clients, encryption, recovery, revocation and payment. Local Anvil/Bee, not Fuji/Swarm bounty evidence. |
| Public infrastructure | Fuji contracts deployed/source-verified; public issuer snapshot retrieved and verified; hosted browser proof accepted by the Fuji verifier in a read-only check. |
| Full funded public lifecycle | Still outstanding. Public encrypted delivery, payment and actual Arkiv creation/expiry must be completed and recorded. |
| Live task discovery | A recent independent browser test saw a stale Arkiv connection. Do not promise a populated working marketplace yet. |

## What to show judges on the frontend

Use the **walkthrough now** for immediate hands-on exploration. Use a **prepared real client/reviewer session** for the onchain demonstration once the public rehearsal below passes. Tell judges which one they are watching.

A three-minute walkthrough:

| Time | What to do | What to say |
| --- | --- | --- |
| 0:00–0:20 | Open Cutout; point to Client / Reviewer. | “A protocol needs a second set of eyes. The reviewer should prove eligibility without sending every client their credential.” |
| 0:20–0:50 | Click **Try the demo**. Edit the task title, scope and budget. Continue and reserve the simulated reward. | “The brief is public. The review report will be private. This walkthrough simulates the financial steps.” |
| 0:50–1:20 | Become the reviewer. Untick credential validity and try eligibility, then restore it. | “An expired or revoked qualification cannot take new work. The live version checks a browser-generated proof onchain.” |
| 1:20–2:10 | Write a recognizable sentence in the report. Encrypt it. Optionally inspect ciphertext, then **drag to cut**. | “This encryption is real. We recover the exact text in this browser.” Use **Cut without dragging** for keyboard/accessibility. |
| 2:10–2:35 | Read the report and approve simulated payment. | “The client evaluates the work. Qualification alone does not prove it is correct.” |
| 2:35–3:00 | Show the receipt; return to the live workspace. | “The live product connects this flow to Fuji escrow, Arkiv discovery and Swarm storage.” Show actual evidence separately. |

**Frontend priorities during the presentation:** keep the task, reward, current role and next action visible. Let a judge edit the brief or report and make the cut themselves. Keep terminals, addresses, key rotation, lease-block inputs and setup troubleshooting out of the main narrative. Open transaction receipts or technical details when explaining evidence. Do not imply fictional collectives from the design references are implemented.

For the real demo, prepare two browser profiles beforehand and switch visibly between **Client** and **Reviewer**. Changing the role toggle alone does not change wallets or make two independent users. Keep wallet confirmations visible when showing real transactions. If a network fails, identify the failure and switch explicitly to the walkthrough or a labelled recording; never present it as a live success.

## How to test the real flow end to end

This is the required rehearsal procedure, **not a claim it has already passed publicly**.

### Prepare before presenting

- Use desktop Chromium with separate client/reviewer wallet contexts. Client needs the chosen reward in canonical **Fuji test USDC**, test AVAX for gas, and Tiramisu test GLM in that same client address for listing publication. Reviewer needs test AVAX. Existing operator rehearsal wallets have already been funded; confirm the wallets actually in use.
- In each browser, open **Your workspace**, connect the payment wallet, **Enable private reports**, and connect Swarm storage with an active upload-capable drive. No pasted Swarm IDs, batch IDs, signing keys or recovery phrases in Cutout.
- Prepare a current class-7 test credential and matching holder file on the reviewer’s own machine. Use the [enrollment guide](review-pass/QUALIFICATION-PROVISIONING.md); the issuer receives the commitment, not the holder secret. Do not demonstrate enrollment or expose file contents onstage.
- Keep each role on the same hostname/browser profile throughout. Existing operator keys were registered on `review-pass-ethrome-2026.vercel.app`, which also displays Cutout. Opening the new Cutout hostname does not transfer those browser keys.
- Confirm the public snapshot is current and the opportunity board is live. Use generous task deadlines. The default 30-block discovery lease is deliberately short; choose a longer lease for the main rehearsal and use a separate short lease for the expiry demonstration.

### Execute and check

1. **Client → Tasks:** write a concrete public brief; set **10 test USDC**; confirm the public-scope checkbox; click **Fund & post task**. Confirm the token approval and funding transactions. **Activity** should show the actual funded task and amount.
2. **Client → Activity → List this review:** approve the Arkiv network switch and publication. Save its entity/transaction receipt. Return to Fuji and reconnect if prompted. Listing is a separate step from funding.
3. **Reviewer → Tasks:** find the live listing and open **View verified scope**. Check the exact scope and reward. Select the issued credential and holder files locally, click **Cut a qualification proof**, then **Accept this task** and sign. The task should become accepted onchain.
4. **Reviewer → Activity:** write a recognizable test report; click **Seal & deliver report**. Wait for upload and the delivery transaction. Save the public ciphertext reference and transaction receipt; never publish the plaintext as evidence.
5. **Client → Activity → Refresh activity:** the task should be submitted. Payment must be disabled before opening it. **Cut open report** and verify the exact reviewer text. Export ciphertext and save the decrypted report locally if desired.
6. **Client:** click **Approve & pay**, sign and wait for confirmation. Check **Paid**, the finalized transfer of 10 test USDC from escrow to the assigned reviewer, and the corresponding balances. Gas is separate AVAX. Other tasks may still hold funds in the same escrow.
7. **Record:** task ID, deployment/chain, funding/acceptance/delivery/payment hashes, Swarm ciphertext reference/digest, Arkiv entity/expiry, screenshots and final balance changes. This becomes the public bounty evidence.

### Extended checks, away from the stage

- An unrelated wallet/browser cannot decrypt the delivered report.
- Reload preserves access with the same browser key. Wallet disconnect clears displayed plaintext.
- An expired/revoked credential or proof bound to a different wallet/task cannot accept new work.
- Tampered report bytes fail commitment verification. Rejected wallet signatures never produce a false Paid state.
- A short Arkiv listing expires naturally: run the same fresh query before/after, with no deletion, and show that the escrow itself still exists. Record a second browser’s real subscription update and reconnect behavior separately.
- Exercise missed deadlines, refund and dispute paths on separate test tasks. Use a separate credential for revocation tests; revocation changes the public root and requires a matching published snapshot. Do not invalidate the main demo credential immediately before presenting.

## Bounty story and remaining responsibilities

- **Avalanche / Team1 Track A:** stablecoin escrow with actual funding, qualification acceptance, delivery commitment and payment on Fuji. We use test USDC; no custom stablecoin is claimed.
- **Arkiv Mission 02 / Mission 03 / Best Use:** useful task discovery, native expiry and real filtered subscription updates. One Arkiv award per team; write/expiry/reconnect evidence remains required.
- **Swarm:** useful public scopes and encrypted reports, independent retrieval and verified bytes. A storage connection test alone is insufficient.

**Engineering:** finish the public funded rehearsal, resolve discovery reliability, capture receipts/expiry evidence and leave fresh usable demo state. **Team:** rehearse the two roles, perform an independent participant test, prepare the presentation/recording, and complete the applicable event/bounty submissions. The guided demo is already available for judges to explore without account setup.

[Acceptance evidence](design/cutout/evidence/README.md) · [Detailed release checklist](review-pass/JUDGE-READINESS.md) · [Operator runbook](review-pass/RUNBOOK.md)
