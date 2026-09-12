# Cutout: the guide for presenting alone

Start here. This guide replaces the older presentation narrative; the operator runbooks are for troubleshooting, not the pitch. Checked against the deployed implementation on 12 September 2026.

**App:** https://cutout-ethrome-2026.vercel.app  
**No-wallet walkthrough:** https://cutout-ethrome-2026.vercel.app/?view=demo  
**Source:** [review-pass/product](https://github.com/MihRazvan/eth-rome-2026/tree/review-pass/product)

## The explanation to give first

> Cutout is a way to hire and pay a technical reviewer. A client posts a question and puts the payment into escrow. A reviewer proves that a trusted issuer has approved them, without publishing their actual credential. They deliver an encrypted report. The client reads it and approves the payment.

Use one example throughout: **“Our team changed a withdrawal permission. We want a second reviewer to check whether an unauthorized wallet could withdraw.”** This is a focused review, not a promise of a complete security audit.

There are three people, although the presenter plays the first two during the demo:

| Person | Their responsibility |
| --- | --- |
| Client | Describes the work, funds it, evaluates the report and approves payment. |
| Reviewer | Has an issuer-approved credential, does the work and delivers the report. |
| Issuer | Decides who may receive that credential. In this demo, this is the Cutout team. |

A future issuer could be an established reviewer collective. **No external collective or accreditation partnership is implemented today.** In the hackathon, we approve test participation. Cryptography checks that approval; it does not assess a person's expertise.

The product has three separate questions: **May this reviewer take the task? Can the client read the delivered work privately? Who receives the money?** The qualification proof, document encryption and escrow answer those questions respectively.

## What happens at every step

### 0. The reviewer gets approved — prepare this before presenting

**What the reviewer does:** In Reviewer → Your workspace → Get qualified, click Prepare my enrollment. Save the private holder backup and send only the enrollment request to the Cutout issuer. The issuer returns a signed credential file after approval.

**What happens behind the screen:** The browser generates a random secret. It calculates a public commitment from that secret: a value the issuer can sign without receiving the secret itself. The issuer signs the commitment together with the qualification class, expiry and a private registry slot. This is a signed document, not a minted NFT or an onchain registration transaction.

**The three files are different:**

| File | Plain-English meaning | What to do with it |
| --- | --- | --- |
| `cutout-enrollment-request.json` | “Please issue a credential for this holder.” | Send to the issuer privately. It cannot produce a qualification proof. |
| `cutout-private-holder.json` | The secret needed to use that credential. | Keep it on the reviewer's device. Select in **Private holder JSON**. |
| The credential JSON returned by the issuer | “This issuer approves this holder for this kind of work until this time.” | Keep it private too. Select in **Credential JSON**. |

Generating the first two files does **not** mean approval has happened. Issuance and private delivery are currently assisted by the team; there is no automatic assessment service. We have now issued your test credential from your enrollment request. Use it with your original holder backup, not a newly generated one. It expires **13 September at 20:58 Bucharest / 19:58 Rome**.

**Say:** “The reviewer gets approved once, then proves that approval separately for each task.” A current credential can serve multiple tasks; each task needs its own proof.

### 1. Both users connect their payment wallets and enable private reports

**What they do:** Use separate client and reviewer browser profiles, connect their wallets on Fuji, then enable private reports in Your workspace.

**What happens:** Connecting identifies the payment wallet. Separately, the browser creates a document-encryption key and the wallet registers its public part on Fuji. Other users can then encrypt a report for that browser. The private part stays in that browser profile.

There are **three different keys/purposes**: the wallet signs money/contract actions; the holder secret proves qualification; the browser document key decrypts reports. One does not replace the others. Keep the same app hostname and browser profile during the demo. A role toggle changes the view, not the wallet account.

**Say:** “The wallet handles payment. A separate browser key handles private documents.” No Swarm account or drive setup is required in the current app.

### 2. The client writes the scope and funds the task

**What they do:** Write the withdrawal-permission question, choose a reward such as 10 test USDC, then click **Fund & post task**. Approve the token allowance and funding transaction.

**What happens:** The public scope document is uploaded to Swarm and retrieved to check its bytes. The Fuji escrow records the exact scope hash and storage reference, reward, qualification class and deadlines. The USDC moves from the client into the contract. The client cannot silently edit the scope after funding.

The scope is public in this version. Do not paste confidential code or findings into it. The later report is private.

**Say:** “The reviewer can see both the agreed question and that the money is already reserved.” Show the task ID and actual funding receipt. A funded task has not yet been advertised to the job board.

### 3. The client advertises the funded task

**What they do:** In Activity, click **List this review**. Approve switching to Arkiv Tiramisu and publishing the listing. Return to Fuji and reconnect if prompted.

**What happens:** Arkiv receives a small public listing owned by the client wallet: searchable task category, required class, reward, settlement address and deadline, with a pointer to the scope. It does not receive the reviewer's credential or the report plaintext. Reviewers' job boards query Arkiv, then cross-check listings against Fuji and the stored scope.

The listing has a limited lifetime: normally up to about 30 minutes, shortened if the acceptance window is closer. Natural expiry removes the advertisement from queries. **It does not delete the funded task, refund money or revoke credentials.** Those are different rules.

**Say:** “Fuji holds the funded task. Arkiv helps someone discover it.” These are two transactions on two networks, not a bridge: USDC stays on Fuji. The client needs AVAX for Fuji gas and GLM for Arkiv gas.

### 4. The reviewer proves qualification and accepts

**What they do:** Find the listing, open **View verified scope**, select the issued credential and matching private holder file, and click **Cut a qualification proof**. After it verifies, click **Accept this task** and sign.

**What happens:** A worker in the browser reads the two files locally. It also downloads the issuer's whole public revocation snapshot. It constructs a zero-knowledge proof that:

- The configured issuer signed this credential.
- The reviewer knows its matching holder secret.
- It covers the required kind of work and remains valid through the proof deadline.
- Its hidden registry slot is not revoked under the current issuer state.
- This presentation is bound to this task and the receiving wallet.

The private files are not uploaded. The browser first simulates acceptance against the actual Fuji contract. The subsequent signed transaction submits the proof and public inputs; the contract verifies them and assigns the reviewer. Producing a proof alone does not reserve the task.

**Say:** “The contract checks that an approved reviewer is taking the task. The client never needs the underlying credential.” The issuer, qualification class, receiving wallet, task and payment remain public. This is credential privacy, not an anonymous payment system.

### 5. The reviewer delivers the report

**What they do:** Write the findings in Activity and click **Seal & deliver report**, then approve the delivery transaction.

**What happens:** The browser encrypts the report with a new random content key. It encrypts a copy of that key for each intended recipient: the client and the reviewer, using their registered public document keys. Swarm stores this encrypted envelope. A separate retrieval checks that the uploaded bytes can be fetched and have the expected hash. The assigned reviewer commits the reference and hash on Fuji.

**Say:** “Swarm stores the report, but receives ciphertext. The contract records which exact encrypted document was delivered.” An upload alone is not a completed onchain submission. The hash proves which bytes were committed, not that the report is good.

### 6. The client opens the report and pays

**What they do:** Switch to the client profile, refresh Activity, and **Cut open report**. Read the findings, then **Approve & pay** and sign.

**What happens:** The app retrieves the encrypted envelope, matches its hash to the onchain commitment, and decrypts it locally with the client's browser key. The UI enables approval only after opening it. The client's transaction releases the task's USDC from escrow to the assigned reviewer.

**Say:** “The client evaluates the work. Their approval releases the reserved payment.” The scissors make the opening action tangible; they are not a cryptographic primitive. The UI's open-before-approve rule is not enforced by the contract, which cannot see whether a human read a document.

## What if something goes wrong?

**No one accepts, or the reviewer never delivers:** after the applicable contract deadline, the client can reclaim the task's funds. A refund requires a transaction; the UI cannot move funds by itself.

**The client disappears after timely delivery:** after the agreed review window, the reviewer can call the contract to claim payment if the client has not disputed. There is no background automatic payout job.

**The client disputes the work:** payment is held for the configured arbitrator. In this prototype that is a trusted team-controlled authority. The arbitrator can split the reward. ZK does not settle quality disputes, and automatic private evidence sharing with the arbitrator is not implemented.

**A credential is revoked:** a new issuer root prevents new acceptance with that credential. This does not cancel already accepted work or claw back payments. The issuer must publish the matching updated snapshot for new proofs to work.

**A holder backup or document key is lost:** they are different losses. A wallet alone cannot recover either. Preserve the holder backup and browser profile; save needed decrypted reports locally. Key rotation does not erase plaintext someone already received.

**Someone copies a credential:** the credential alone is insufficient; they also need its holder secret. Someone who gets both could use them. This is not proof of a unique human, a nontransferable identity or a Sybil defense.

## The three sponsor explanations

### Avalanche / Team1 — Track A: stablecoin payments for real work

**Lead with:** “We use test USDC escrow on Fuji to pay for technical reviews. Funding reserves the reward; a verified qualification proof gates assignment; delivery is committed; client approval releases payment.”

**Show:** one actual task's funding, acceptance, delivery and payment receipts, plus the USDC balance change. An allowance transaction alone is not payment. A verifier `eth_call` alone is not acceptance. The guided demo's receipt is not onchain evidence.

**Expect these questions:**

| Question | Answer |
| --- | --- |
| Did you deploy your own stablecoin? | No. We use canonical Fuji test USDC, with six decimals. We deployed the escrow, qualification verifier and document-key registry. |
| Which contracts do the work? | `QualificationEscrow` holds funds and enforces task states; the generated verifier checks the proof; `QualificationKeys` binds wallets to document-encryption public keys. |
| Who can redirect payment? | Acceptance binds the receiving wallet into the proof. Normal payment goes to the assigned reviewer. Disputed funds follow the explicitly trusted arbitrator's resolution. |
| Can someone copy a proof from the mempool? | It cannot redirect the assignment to another recipient. Anyone may relay a valid proof, but its beneficiary is fixed. The contract also consumes a task-specific nullifier to reject replay. |
| Why Avalanche? | It is the EVM settlement network for this deployment. We use Fuji to demonstrate the whole stablecoin workflow with test assets. We do not claim this requires Avalanche-specific consensus or uses ICM/custom L1s. |

**Track choice:** enter **Track A only**, not Track B too. Creating a new stablecoin is not required by the current track description. The [official Avalanche event page](https://build.avax.network/events/73a939b1-6d35-4847-9388-320024638249) asks for a useful stablecoin flow, verifiable onchain activity, public source and a working demo. Its submission is through Builder Hub and asks for pitch slides.

**Code to open:** [escrow](../experiments/qualification/contracts/src/QualificationEscrow.sol), [document-key registry](../experiments/qualification/contracts/src/QualificationKeys.sol), [browser proof](../experiments/qualification/pilot/browser-prover.ts).

### Arkiv — Mission 02, Mission 03 and Best Use consideration

**Lead with:** “Our job board is a public, wallet-owned index of funded opportunities. Clients choose how long an opportunity is advertised; listings disappear through native expiry, and boards respond to a real event stream.”

**What is stored:** small public entities, not report files. Typed attributes support questions such as: “Show technical-review tasks for this qualification class on our Fuji escrow, paying at least this much USDC.” The title and scope reference live in the payload. The app verifies the purported funding/client against Fuji before displaying a listing as valid.

**Show two separate things:**

1. **Mission 02:** publish a deliberately short-lived listing; show the same query before and after its native expiry. Do not delete it to simulate expiry. Show that the funded task still exists on Fuji.
2. **Mission 03:** keep a second reviewer browser open while the client publishes. Show the board updating without Refresh. Then point to the real WebSocket transport and subscriptions in code. Explain that reconnect re-queries current state to catch missed changes.

**Expect these questions:**

| Question | Answer |
| --- | --- |
| Why not Postgres? | Postgres can build a job board. Arkiv gives us publicly queryable, wallet-owned listings with network-enforced lifetimes; another client can discover them without our private database or publisher account. We still validate settlement on Fuji. |
| Are you polling? | The live Arkiv client uses `webSocket(...)`, entity subscriptions and `newHeads`, without a historical start block. It re-queries after relevant events, reconnects and known expiry boundaries. Network reads still occur; there is no periodic polling loop for the live board. |
| Is expiry just a frontend timer? | No. At a known lease boundary, a received block head triggers a fresh query. Successful absence from that query is the expiry evidence. Expiry itself does not emit an entity event. |
| What happens if Arkiv is unavailable? | Discovery reports unavailable/stale state. Existing task rights and money remain on Fuji. Listing storage does not authorize settlement. |
| Are credentials stored there? | No private credentials, holder secrets or plaintext reports. Listings do reveal ordinary public job/wallet/payment metadata. |
| Did you replace an existing indexer? | No. We are not claiming Mission 01. |

The [current Arkiv hub](https://hub.arkiv.network/ethrome) specifies native-expiry and WebSocket missions, public demo/source/feedback evidence, and **one Arkiv award per team**. Best Use consideration is automatic for qualifying entries. Do not add the mission prizes together.

**Code to open:** [listing driver and query](../experiments/qualification/pilot/listings.ts), [schema](../arkiv/schema.md), [feedback](../feedback.md). Search for `listingQuery`, `webSocket`, `watchEntityEvents`, `watchBlockNumber` and `ExpirationTime.fromBlocks`. Feedback should distinguish an SDK issue from our own wallet/UI bugs.

### Swarm — encrypted reports that recipients can retrieve

**Lead with:** “Swarm holds the actual scope documents, encrypted reports and public issuer revocation snapshot. The report is encrypted in the browser before upload, so storage does not need to be trusted with its contents.”

**Show:** write a distinctive report, upload it, show its content reference, retrieve it, verify the committed digest, and open it in the client browser. An unrelated browser must not be able to decrypt it. Do not publicly open the two private qualification files as part of this demo.

**Expect these questions:**

| Question | Answer |
| --- | --- |
| Are you using Swarm ID? | We integrated it as an optional adapter. The current customer path uses the Swarm public gateway's funded upload service, so customers need no Swarm account, gift card or drive. Do not claim the live flow uses the team's gift drive. |
| Who pays for storage? | The public gateway supplies postage for this trial upload path. It is not free forever; sustainable funding and retention are follow-up work. |
| What exactly is encrypted? | Report plaintext uses AES-256-GCM with a fresh content key. HPKE with P-256/HKDF-SHA256/AES-GCM protects a copy of that key for each recipient. Public scope and the whole revocation snapshot are not confidential. |
| Is the reference itself a decryption key? | Our report reference addresses the encrypted envelope. It does not expose a plaintext content key. The intended recipient needs the matching private browser key. Recipient/context metadata in the envelope are public. |
| Why not S3? | S3 could store the same ciphertext. Swarm gives content-addressed retrieval outside a Cutout-owned bucket; the committed reference and exported envelope can be used by compatible clients. We still depend on available storage/postage and currently use one gateway. |
| Did you retrieve through independent operators? | We verified a separate retrieval and byte digest. The current app uses the same public gateway URL; do not call that proof of independent gateway operators. |
| Does it stay forever? | No retention guarantee. The trial gateway is temporary. Recipients can export ciphertext and save decrypted work. Content addressing establishes identity of bytes, not permanent availability. |

Swarm ID is optional under the [supplied bounty requirements](review-pass/supplied-bounties.txt). The important demonstration is real Swarm storage/retrieval doing useful work. A next-step answer is: **“Add explicit paid retention and a usable recovery path for document keys.”**

**Code to open:** [active gateway adapter](../experiments/qualification/pilot/swarm-gateway.ts), [recipient encryption and key storage](../experiments/qualification/pilot/keys.ts), [optional Swarm ID adapter](../experiments/qualification/pilot/swarm-id.ts).

## If a technical judge asks how the proof works

The implementation uses **gnark Groth16 over BN254**, with a generated Solidity verifier. The Go prover runs as WebAssembly inside a browser Web Worker. The circuit verifies an EdDSA issuer signature, knowledge of the holder secret, matching qualification class, expiry bounds, and a depth-16 Merkle nonrevocation path. It derives task-specific values to bind the presentation and prevent replay. The escrow supplies the current issuer/root and checks task state and time.

The browser downloads the **whole** public revocation snapshot and constructs its path locally. It does not ask a server, “Is credential number123 revoked?” That avoids revealing the hidden credential slot through an individual status lookup. The root is the compact onchain commitment to that whole state. Issuing a new unrevoked slot does not change it; revoking a slot does.

Nine values go onchain: issuer public-key coordinates, current root, class, proof deadline, task context, recipient wallet, nullifier and presentation tag. The credential signature, actual credential expiry, holder secret/commitment, index and path stay private inputs. A proof deadline still reveals a lower bound on validity.

This is an **experimental implementation with a single-process test Groth16 setup**, not a production ceremony or an audited protocol. We did not reproduce ShadowPath or invent zero-knowledge credentials. The project combines private eligibility with paid work and encrypted delivery. Source: [circuit](../experiments/qualification/prover/circuit.go), [setup/prover](../experiments/qualification/prover/main.go).

## Presenting alone: rehearse this sequence

Have two separate browser profiles ready, labelled **Client** and **Reviewer**. Keep the correct wallets, registered document keys, valid reviewer files and generous task deadlines ready before judges arrive. Do not try to explain issuer setup while simultaneously troubleshooting wallet confirmations.

For a three-minute live presentation:

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:25 | One concrete withdrawal-review brief | “We need a second reviewer. We want issuer-approved eligibility, a private report and reserved payment.” |
| 0:25–0:50 | A pre-funded task and its real funding receipt | “The agreed scope and USDC reward are committed on Fuji.” |
| 0:50–1:30 | Reviewer profile, selected files, proof and acceptance | “The browser proves current approval without uploading the credential. This transaction assigns the reviewer.” |
| 1:30–2:10 | Write and seal a short report | “The report is encrypted locally, stored on Swarm, and its reference is committed onchain.” |
| 2:10–2:45 | Client opens and approves | “The client checks the work and releases the reserved USDC.” |
| 2:45–3:00 | Paid state and actual receipt | “Avalanche settles, Arkiv discovers, Swarm stores. Qualification and report contents are protected separately.” |

Transaction timing can exceed three minutes. Use a truthful recording of a completed run where necessary, labelled as recorded. For Arkiv judges, allocate extra time to the two-browser update and short expiry demonstration. For Swarm judges, let them supply a harmless report sentence and open it themselves.

The `?view=demo` route is a **guided simulation** of funding, qualification and payment, with real local encryption/decryption. It uploads nothing. Say that before using it. It helps a judge understand the flow; it is not a substitute for live sponsor evidence.

## What is actually verified today

At the finalized Fuji read on **12 September, 18:06UTC**, task1 was refunded; task2 remained Open but its acceptance deadline had passed; task3 was Open with no assigned reviewer. An Open enum alone does not mean a task is still eligible. This read did not observe any accepted or paid task.

Real public contracts and task funding, actual Arkiv listings, actual encrypted Swarm upload/retrieval, real issuer credential issuance, and browser proofs accepted by Fuji simulations have evidence. The local complete lifecycle also has test evidence. **The complete public reviewer-accepts → delivers → client-pays sequence is not yet signed off.** Do not say it is until its actual receipts exist. Current evidence: [file selection and funded-task simulation](design/cutout/evidence/proof-file-selection/README.md), [public storage](design/cutout/evidence/account-free-storage/README.md), [acceptance ledger](ACCEPTANCE.md).

Before presenting, complete the [manual end-to-end checklist](CUTOUT-MANUAL-TEST.md), save the real receipts and capture the short Arkiv expiry/subscription evidence. Public demo availability does not automatically complete bounty eligibility. Submit the event entry and applicable sponsor entries, including their feedback/evidence. The current [Team1 Builder Hub page](https://build.avax.network/events/73a939b1-6d35-4847-9388-320024638249) has its own submission and lists Sunday16:00 Rome; the previously checked ETHRome manual listed Sunday10:00 Rome. Treat the earlier event deadline as the safe cutoff; do not assume the sponsor deadline extends it.

## Five questions to answer without reading

1. Who decides that a reviewer qualifies? **The issuer; currently the Cutout test team.**
2. What does the proof establish? **Valid issuer approval for this task, not the quality of the work.**
3. Where is the money? **In the Fuji escrow until a contract payment/refund/dispute path moves it.**
4. Where is the report? **Encrypted on Swarm; readable with the intended recipients' document keys.**
5. What is Arkiv doing? **Discovering funded opportunities through public, expiring, searchable listings and live updates.**

If these five answers are clear, the presentation has a coherent foundation. Lead with the review being bought; introduce each technology at the moment it performs a useful job.
