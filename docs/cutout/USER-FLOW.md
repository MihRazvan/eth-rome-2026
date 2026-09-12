# Cutout — user flow

[Docs](../README.md) · [Architecture](ARCHITECTURE.md) · [Manual end-to-end test](../CUTOUT-MANUAL-TEST.md)

The client buys a review. The reviewer does the work. The issuer decides who qualifies. These are separate responsibilities, even when one presenter demonstrates them all.

## 1. Qualify before taking work

In **Reviewer → Your workspace → Get qualified**, the browser generates a holder secret. Download the private holder backup and enrollment request. Send only the request to the Cutout team, which currently operates the experimental test issuer. After approval, the team returns a signed credential JSON.

| File | What to do with it |
| --- | --- |
| Enrollment request | Send to the issuer for approval; it cannot generate a proof |
| Private holder backup | Keep private; it is the secret needed to use the credential |
| Issuer-returned credential | Keep private; select it alongside the matching holder backup when proving |

There is no public “approve myself” endpoint. The demo issuer approves test participation; no outside professional accreditor is integrated. Issuance is an offchain signature, not an NFT mint. [Issuer operator instructions](../review-pass/QUALIFICATION-PROVISIONING.md).

## 2. Prepare each participant's browser

Use a separate browser profile for client and reviewer. Connect the intended payment wallet on Fuji and enable private reports. This registers the browser's public report key in the onchain key registry; its private key stays in IndexedDB.

Storage is included through the Swarm gateway. The user does not create a Swarm account or enter storage identifiers. Both wallets need Fuji test AVAX. The client also needs canonical test USDC and Arkiv Tiramisu gas for publishing a listing.

**Client/Reviewer switches the interface, not the wallet account.** The connected address must match the role. If the proof form says “This is the client's wallet,” use **Choose reviewer account**, authorize the reviewer in the wallet, and reconnect. Keep the task open.

## 3. Client: scope and fund

Enter a public question, reward and deadlines. The app uploads the exact public scope to Swarm, checks its bytes, and includes its reference/digest in the funded task. Approve the token allowance and Fuji funding transaction. The finalized escrow record is the source of truth for the client, reward, qualification class, scope and deadlines.

Use a non-sensitive scope. The report is encrypted later; the task description is not private source-code intake.

## 4. Client: list the funded task

From the task's Activity card, choose **List this review**. Approve switching to Arkiv Tiramisu and the listing transaction, then return to Fuji. This creates a wallet-owned discovery advertisement. Funding and listing are separate transactions on separate networks.

The listing has a native expiration time in blocks. When it expires, it disappears from discovery; that does not destroy the Fuji task or refund its reward. If publication fails, inspect its receipt before retrying. Do not fund a duplicate task to repair discovery.

## 5. Reviewer: prove and accept

Find the task, open **View verified scope**, and check its terms. Cutout verifies the listing against finalized Fuji state rather than trusting advertisement text alone.

Select the issuer-returned credential and original matching private holder file. **Cut a qualification proof** runs the Go prover inside a WebAssembly worker in the browser. It proves the issuer signature, required class, validity and nonrevocation, and binds the proof to this task and payment wallet. Private proof inputs stay local.

After proof verification/simulation, click **Accept this task** and sign. The contract rechecks eligibility and freshness when the transaction executes. A generated proof alone does not reserve the task; another eligible reviewer can accept first.

## 6. Reviewer: seal and deliver

Write the report. The browser creates a random encryption key, encrypts the report with AES-GCM and wraps that key separately for the client and reviewer using their registered public keys. Swarm receives ciphertext. A separate retrieval checks its digest before the reviewer signs the delivery transaction.

Fuji records the report reference and digest from the assigned reviewer. Uploading bytes alone does not mark a task delivered. If upload succeeded but a later step failed, retain the reference and check task state before retrying.

## 7. Client: open and pay

Open the delivered report in the original client browser/profile. Cutout retrieves the envelope, checks it against the onchain digest and decrypts using the local private key. Drag to cut it open, or use the keyboard/click alternative.

Inspect the text, save a copy and choose **Approve & pay**. Sign the Fuji transaction. The escrow sends the already-funded reward to the assigned reviewer; this is not a second client USDC payment. The UI enables approval after successful opening, but the contract cannot prove that a human read the report.

Reloading the same browser preserves document keys. Changing hostname, device or clearing browser storage can lose access; the wallet alone cannot reconstruct the report key.

## If work does not finish normally

| Situation | Contract behavior |
| --- | --- |
| No acceptance before deadline | Client can explicitly refund after the acceptance window |
| Accepted but not delivered before deadline | Client can explicitly refund after the delivery window |
| Timely delivery, client does not act | Reviewer can call the claim function after the review deadline if undisputed |
| Client disputes | Trusted test arbitrator resolves distribution of the escrowed reward |
| Credential expires or is revoked after acceptance | Existing assignment/payment rights continue; new acceptances require current eligibility |
| Arkiv advertisement expires | Discovery changes; settlement rights remain on Fuji |

These paths require transactions; no automatic cron pays or refunds. The app does not automatically assess report quality or furnish an independent arbitration service. See the [security and trust model](SECURITY.md).

## Showing the flow to judges

For a quick explanation, use the [no-account walkthrough](../CUTOUT-JUDGE-TUTORIAL.md), clearly introducing its simulated settlement. For a live demo, prepare both funded wallet profiles and credential files first, then start from an eligible funded task and its receipt. Follow the [manual test](../CUTOUT-MANUAL-TEST.md) through Paid before relying on that task flow onstage. The [presenter guide](../CUTOUT-PRESENTER-GUIDE.md) explains each sponsor's role and likely questions.
