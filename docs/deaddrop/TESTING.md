# Test a real review end to end

[Open Deaddrop](https://cutout-ethrome-2026.vercel.app) · [No-setup walkthrough](TRY-IT.md) · [Deployment](DEPLOYMENT.md)

Use two browser profiles and wallets you control: **Client** and **Reviewer**. The role toggle changes the interface, not the connected wallet. Keep the same hostname and browser profiles throughout so private report keys remain available.

## Prepare

| Requirement | Client | Reviewer |
| --- | --- | --- |
| Fuji test AVAX for gas | Yes | Yes |
| Canonical Fuji test USDC | 0.1 for this rehearsal | None |
| Arkiv Tiramisu test GLM | For listing publication | None |
| Browser report key | Registered automatically during first funding | Registered automatically during first acceptance |
| Reviewer pass | No | Created automatically on first use |

1. Connect the intended wallet in each profile. No separate report-key setup is required: first funding and first acceptance request registration when needed. Reuse an existing valid registration; do not rotate a key just to rehearse.
2. Confirm document storage is available. Storage is included; no Swarm account, drive or recovery phrase is required.
3. Use a fresh reviewer profile to exercise first-time setup. Open **Your reviewer pass → Get started** to check setup separately, or continue directly to a task. The app should obtain the reviewer pass automatically when needed: sign the enrollment message and wait for setup to finish. Nobody on the team should run an approval command. A returning profile may reuse its saved pass.
4. Reload and reconnect the same wallet to check pass persistence. Enrollment currently requires at least 0.001 test AVAX in the reviewer’s Fuji wallet; it does not transfer those funds.

Use generous acceptance deadlines to allow for first-time artifact downloads, network confirmations and browser proving. Enrollment does not assess the reviewer’s technical expertise.

## Complete the flow

1. **Client → Tasks:** enter a non-sensitive public brief, a **0.1 test USDC** reward and generous deadlines. Confirm the brief is safe to publish. Keep the default **900-block** listing lease.
2. **Fund & post task:** sign browser report-key registration if prompted, approve the token allowance if required, then sign the Fuji funding transaction. Wait for finality. Save the task ID and funding receipt shown in Activity.
3. **Client → Activity → List this review:** approve the Arkiv network switch and publication transaction. Return to Fuji when prompted. Funding and discovery are separate transactions; failed publication does not require a second funding transaction.
4. **Reviewer → Tasks:** open the matching listing and **View verified scope**. Check its terms. Choose **Accept this task**, complete automatic setup if prompted, wait for the local proof, then **Confirm acceptance**. Sign browser report-key registration if prompted, followed by the Fuji acceptance transaction. A proof alone does not reserve the task.
5. **Reviewer → Activity:** write a harmless report containing a unique sentence and “✓”. Choose **Seal & deliver report**. Wait for verified Swarm upload and the Fuji delivery transaction. Confirm **Submitted**.
6. **Client → Activity:** refresh if needed. Open the private report using the slider or button. Every character must match. Approval must remain unavailable until opening succeeds. Save a local copy.
7. Reload the same client profile, reconnect and open the report again. The saved browser key should still decrypt it.
8. Choose **Approve & pay 0.1 test USDC**, sign and wait for finality. Confirm **Paid** and save the payment receipt. The reviewer’s USDC balance must increase by **100,000 base units**. This releases the already-funded reward; gas is separate.

## Check failure and recovery states

- First-time setup must finish without contacting the team, uploading credential files or manually collecting an approval. If issuance is unavailable, the app must show a recoverable service error; it must not claim a pass was issued.
- Reject a wallet prompt: the app must not report success. Inspect any existing transaction receipt before retrying.
- Switch or disconnect the client after opening: displayed private report text must clear.
- An unrelated profile/wallet may fetch ciphertext but must not decrypt it.
- If the same wallet already has a key from another browser, key replacement must require explicit confirmation. Earlier reports still need the original browser’s key; do not replace it casually.
- Try the walkthrough at mobile width and use its keyboard alternative to dragging.
- If the reviewer screen shows the client’s wallet, choose the reviewer account in the wallet’s connected-site settings and reconnect. Do not create a duplicate task.

An expired listing disappears from Arkiv discovery without refunding its Fuji escrow. An Open task may still be past its acceptance deadline. Existing assignment, refund and payment rights follow the contract’s deadlines.

## Private data and backups

**Save private backup** under **Your reviewer pass → Backup or restore a pass** is optional before changing browsers or clearing site data. Restore it while connected to the same wallet and deployment. Older credential/holder pairs can be imported once there. An enrollment request is not a credential.

A pass backup does **not** contain the separate report-decryption key. Wallet recovery alone restores neither browser secret. Preserve the original profile and export reports you need; trial Swarm storage has no retention guarantee.

For a failure report, provide the URL, role, task ID, action, expected/actual result and public transaction hash. Exclude wallet secrets and private backups.

## Existing acceptance evidence

[Public task #4](evidence/saved-pass/README.md) completed the paid lifecycle with the previous manually issued pass using actual public networks and operator-controlled Chromium wallet signers. The same run captured native Arkiv expiration and two-browser listing updates. A human wallet-extension run is a separate check; automation is not presented as that signoff.
