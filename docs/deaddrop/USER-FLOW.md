# Deaddrop — user flow

[Docs](../README.md) · [Architecture](ARCHITECTURE.md) · [Manual end-to-end test](TESTING.md)

The client buys a review. The reviewer does the work. The issuer service automatically enrolls reviewers. These are separate responsibilities, even when one presenter demonstrates them all.

## 1. Connect and choose work

Connect your reviewer wallet and open a task. If this browser needs a reviewer pass, Deaddrop starts setup as part of taking the task. Sign the enrollment message; it requests no token transfer. The browser saves your private holder and reply key, submits an encrypted request and collects the issuer’s encrypted response automatically.

No team approval or credential file exchange is required. The pass remains in this browser for later tasks. The issuer never receives your holder secret.

**Backup or restore a pass** is optional. Existing users can import their old issued credential and matching holder file once. A private pass backup preserves a pass when changing browsers; it must remain private. Wallet recovery alone does not recover these browser secrets.

Enrollment is open. A pass confirms valid enrollment, not technical expertise; the client evaluates the work. [Automatic enrollment and proof architecture](QUALIFICATION.md).

## 2. Prepare each participant's browser

Use a separate browser profile for client and reviewer. Connect the intended payment wallet on Fuji. There is no separate private-report setup step. First funding or acceptance requests registration of the browser’s public report key automatically when needed; its private key stays in IndexedDB. An existing matching registration skips that transaction.

Storage is included through the Swarm gateway. The user does not create a Swarm account or enter storage identifiers. Both wallets need Fuji test AVAX. The client also needs canonical test USDC and Arkiv Tiramisu gas for publishing a listing.

**Client/Reviewer switches the interface, not the wallet account.** The connected address must match the role. If the proof form says “This is the client's wallet,” use **Choose reviewer account**, authorize the reviewer in the wallet, and reconnect. Keep the task open.

## 3. Client: scope and fund

Enter a public question, reward and deadlines. The app uploads the exact public scope to Swarm, checks its bytes, and includes its reference/digest in the funded task. If prompted, sign the browser report-key registration transaction, then approve the token allowance and Fuji funding transaction. The finalized escrow record is the source of truth for the client, reward, qualification class, scope and deadlines.

Use a non-sensitive scope. The report is encrypted later; the task description is not private source-code intake.

## 4. Client: list the funded task

From the task's Activity card, choose **List this review**. Approve switching to Arkiv Tiramisu and the listing transaction, then return to Fuji. This creates a wallet-owned discovery advertisement. Funding and listing are separate transactions on separate networks.

The listing has a native expiration time in blocks. When it expires, it disappears from discovery; that does not destroy the Fuji task or refund its reward. If publication fails, inspect its receipt before retrying. Do not fund a duplicate task to repair discovery.

## 5. Reviewer: prove and accept

Find the task, open **View verified scope**, and check its terms. Deaddrop verifies the listing against finalized Fuji state rather than trusting advertisement text alone.

Click **Accept this task**. Deaddrop completes automatic pass setup if needed, then runs the Go prover inside a WebAssembly worker in the browser. It proves the issuer signature, required class, validity and nonrevocation, and binds the proof to this task and payment wallet. Private proof inputs stay local.

After proof verification/simulation, click **Confirm acceptance**. If this browser needs a report-key registration, sign that transaction first, then sign acceptance. The contract rechecks eligibility and freshness when the transaction executes. A generated proof alone does not reserve the task; another eligible reviewer can accept first.

## 6. Reviewer: seal and deliver

Write the report. The browser creates a random encryption key, encrypts the report with AES-GCM and wraps that key separately for the client and reviewer using their registered public keys. Swarm receives ciphertext. A separate retrieval checks its digest before the reviewer signs the delivery transaction.

Fuji records the report reference and digest from the assigned reviewer. Uploading bytes alone does not mark a task delivered. If upload succeeded but a later step failed, retain the reference and check task state before retrying.

## 7. Client: open and pay

Open the delivered report in the original client browser/profile. Deaddrop retrieves the envelope, checks it against the onchain digest and decrypts using the local private key. Slide to open it, or use the keyboard/click alternative.

Inspect the text, save a copy and choose **Approve & pay**. Sign the Fuji transaction. The escrow sends the already-funded reward to the assigned reviewer; this is not a second client USDC payment. The UI enables approval after successful opening, but the contract cannot prove that a human read the report.

If a wallet already has a key from another browser, replacing it requires explicit confirmation. Earlier reports still need that original browser’s key. Reloading the same browser preserves document keys. Changing hostname, device or clearing browser storage can lose access; the wallet alone cannot reconstruct the report key.

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

For a quick explanation, use the [no-account walkthrough](TRY-IT.md), clearly introducing its simulated settlement. For a live demo, prepare both funded wallet profiles, then show task funding, automatic reviewer setup and acceptance. A returning reviewer reuses their saved pass. Follow the [manual test](TESTING.md) through Paid before relying on that task flow onstage. The [bounty pages](BOUNTIES.md) explain each sponsor’s role and integration.
