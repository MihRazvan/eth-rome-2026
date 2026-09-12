# Cutout — the presentation cue sheet

**Read this first.** Use the [full presenter guide](CUTOUT-PRESENTER-GUIDE.md) for what happens behind every click, sponsor questions, code links and failure cases. This replaces the earlier technical brief.

App: https://cutout-ethrome-2026.vercel.app

## What to say

> Cutout lets a team hire and pay a technical reviewer. The team puts the reward in escrow. The reviewer proves that a trusted issuer has approved them, without publishing their actual credential. They deliver an encrypted report. The client reads it and approves payment.

**Example:** “We changed a withdrawal permission. Can someone independently check whether an unauthorized wallet could withdraw?”

The reason to use it: the client can require issuer-approved eligibility and reserve payment for the job without publishing the reviewer's credential identifier or the report's contents. This is a prototype for focused reviews, not a guarantee of a correct audit. A real issuer partnership and customer demand still need validation.

## Three people, three responsibilities

- **Client:** buys the review and decides whether the work is acceptable.
- **Reviewer:** proves eligibility, does the review and delivers it.
- **Issuer:** decides who may receive the qualification. Currently this is our Cutout team issuing test credentials, not an external accreditor.

The qualification proof checks the issuer's approval. It does not assess expertise or judge the report.

## The story, step by step

1. **Before the demo: the reviewer gets a credential.** Their browser creates a private secret and an enrollment request. They keep the secret and send the request to us. We return a signed credential. Approval happens here; generating the request does not approve anyone.

2. **The client posts a question and reserves USDC.** The public scope goes to Swarm. A Fuji transaction puts the reward in escrow and records the scope's hash and deadlines. Show that the money is actually there.

3. **The client lists the task.** A separate Arkiv transaction puts a searchable advertisement on the job board. Reviewers discover it there. The advertisement expires; the money does not disappear with it.

4. **The reviewer proves approval and accepts.** Select the issuer-returned credential and original private holder backup. The browser generates a proof of the issuer's signature, correct qualification, validity and nonrevocation, bound to this task and wallet. The files stay local. Then sign **Accept this task**; generating a proof alone does not reserve it.

5. **The reviewer writes and seals the report.** Their browser encrypts it for the client and reviewer. Swarm stores the encrypted bytes. The reviewer signs a Fuji transaction recording the exact report reference and hash.

6. **The client opens the report and approves payment.** The browser retrieves, checks and decrypts it. The client reads it and signs **Approve & pay**. The escrow sends USDC to the assigned reviewer.

## The file confusion, resolved

| File | Meaning | Use |
| --- | --- | --- |
| `cutout-enrollment-request.json` | Request for approval | Send only this to the issuer. Never use it as a credential. |
| `cutout-private-holder.json` | Secret needed to use that approval | Keep private; select in **Private holder JSON**. |
| Credential JSON returned by us | Signed approval | Keep private; select in **Credential JSON**. |

Your issued test credential expires **13 September, 19:58 Rome / 20:58 Bucharest**. Use its original matching holder backup. If file controls are disabled, reconnect the reviewer wallet on Fuji.

## What to say to each sponsor

**Avalanche / Team1 Track A:** “Fuji holds the test USDC and enforces funding, qualified assignment, delivery commitment and payment.” Show actual transaction receipts. We use existing test USDC; we did not deploy a new stablecoin. We enter one Team1 track.

**Arkiv Mission 02 + Mission 03:** “Arkiv is our public, wallet-owned job board. Compound queries find relevant funded work, native expiry removes stale advertisements, and WebSocket updates refresh another user's board.” Show real expiry without deletion, and a second browser updating without a manual refresh. No Mission01 migration claim. Best Use consideration is also targeted; only one Arkiv award can be won.

**Swarm:** “Swarm stores the real documents. Reports are encrypted before upload and checked after retrieval.” Show a recognizable report being sealed and opened. The current path uses gateway-funded uploads with no customer Swarm account. Swarm ID is an optional adapter, not the active sign-in flow. Trial storage is not guaranteed permanent.

## Before walking up to the judges

Prepare separate **Client** and **Reviewer** browser profiles, funded wallets, registered report keys, valid credential files and a funded task with time left. A role toggle alone does not switch wallets. Keep the same hostname/profile so document keys remain available.

Perform one complete real acceptance → delivery → opening → payment rehearsal and save its receipts. **That public paid sequence is not yet signed off in our evidence.** A successful proof simulation is not a payment. Public live tasks and storage exist, but show only completed actions as completed.

For a three-minute pitch, start with an already-funded task and its receipt, then show the reviewer and client stages. Prepare a clearly labelled recording if wallet timing is too slow. The `?view=demo` walkthrough simulates qualification and payment; call it a simulation before using it. Its encryption is real, but nothing is uploaded.

Remember: **the issuer approves the reviewer; the proof checks that approval; the client evaluates the work; the contract pays.** Wallets, rewards and public scope remain visible. Credential contents and report plaintext are the protected parts.
