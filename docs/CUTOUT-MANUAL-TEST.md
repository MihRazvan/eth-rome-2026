# Cutout — teammate end-to-end tutorial

App: https://cutout-ethrome-2026.vercel.app. The [3-minute judge walkthrough](CUTOUT-JUDGE-TUTORIAL.md) works without setup.

The public paid lifecycle has passed in operator-controlled Chromium browsers: task **#4**, **0.1 test USDC**, real qualification, encrypted delivery, exact client decryption and finalized payment. [Receipts and evidence](cutout/evidence/saved-pass/README.md). That run used a test-wallet bridge; the teammate's real wallet-extension rehearsal below remains a separate check.

## Prepare two browser profiles

Use separate **Client** and **Reviewer** profiles and wallets you control. The role toggle changes the view, not the wallet account. Keep the same app hostname and browser profile throughout.

| Needed | Client | Reviewer |
| --- | --- | --- |
| Fuji test AVAX for transactions | Yes | Yes |
| Canonical Fuji test USDC reward | 0.1 is enough for this rehearsal | None |
| Arkiv Tiramisu test GLM for listing | Yes | None |
| Browser report key | Enable private reports | Enable private reports |
| Current reviewer pass | No | Apply and collect approval below |

Browsing and proof generation need no gas. Document storage is included without a Swarm account. Opening a report needs its recipient's original browser key, not gas.

1. In each profile, connect the intended wallet. Open **Your workspace → Private reports & storage → Enable private reports**. Sign the Fuji registration transaction. Reuse an existing valid registration; no key rotation is needed.
2. Confirm storage is available. If needed, use **Check storage connection**.
3. In the reviewer profile, open **Reviewer → Your workspace → Your reviewer pass → Apply for a reviewer pass**. Sign the application message in the wallet; it requests no payment.
4. Wait for the Cutout team's **manual approval**. The application and returned approval travel encrypted through the app. Applying does not approve anyone automatically.
5. Click **Check approval**. Continue when the app shows **Reviewer pass ready** and its validity date. The pass is saved in this browser for the connected wallet. Reload, reconnect the same wallet and check that it remains ready.

Prepare the approved pass before funding a task so approval does not consume the task's acceptance window. These are temporary test passes, not professional accreditation.

## Run the real flow

1. **Client → Tasks:** title “Review withdrawal permissions”; public scope “Check whether an unauthorized account can bypass withdrawal approval”; reward **0.1 test USDC**. Check **This brief is safe to publish.** Keep generous deadlines and the default **900-block** listing lease, normally about 30 minutes and shortened if the acceptance deadline is closer.
2. Click **Fund & post task**. Approve any required token allowance and the funding transaction. Wait for finality. **Activity** must show the task ID and **0.1 test USDC**. Save the funding receipt.
3. **Client → Activity → List this review:** approve the Arkiv switch and listing transaction. Save the receipt, return to Fuji and reconnect if prompted. Funding and listing are separate actions.
4. **Reviewer → Tasks:** find the listing and click **View verified scope**. Check the title, scope and amount. Click **Verify my eligibility**; the saved pass is used locally, without selecting files. After verification, click **Accept this task**, sign and wait for finalized acceptance. A proof alone does not reserve the task.
5. **Reviewer → Activity:** write a recognizable, non-sensitive report containing a unique sentence and “✓”. Click **Seal & deliver report**. Wait for verified Swarm upload and the Fuji delivery transaction. Confirm **Submitted**.
6. **Client → Activity → Refresh activity:** confirm payment is unavailable before opening. Drag to cut or click **Cut open report**. Check every character matches. Save a copy; trial storage has no retention guarantee.
7. Reload the same client profile, reconnect if needed and open the report again. The saved report key should still decrypt it.
8. Click **Approve & pay 0.1 test USDC**, sign and wait for finality. Confirm **Paid**, save the payment receipt and check the reviewer's USDC balance increased by **0.1** (**100,000** base units). The client funded this reward earlier; gas is separate.

If a step fails, record **URL + role + task ID → action → expected → actual**, with public transaction hash and screenshot where useful. Inspect receipts before retrying a transaction. Keep private pass backups, credentials and wallet secrets out of feedback.

## Recovery and account selection

**Optional pass backup:** in **Your reviewer pass → Backup or restore a pass**, choose **Save private backup** before changing browsers or clearing site data. Restore it with **Restore a Cutout backup**, connected to the same wallet and deployment. A wallet alone cannot recover a lost pass. This backup does not restore private report keys.

**Already have the older two files?** In that same disclosure, select the **Issued credential** and its **Original holder backup**, then **Save existing pass to this browser**. This is a one-time import; normal task acceptance uses the saved pass. An enrollment request is not an issued credential. Expired or mismatched files need correction before import.

**Reviewer view says “This is the client's wallet”:** use **Choose reviewer account**, authorize the reviewer account in the wallet's connected-site settings if needed, then **Reconnect selected account**. Do not fund or list a duplicate task. An old task's Open status alone does not mean its acceptance deadline remains valid.

## Finish the teammate rehearsal

- [ ] Reject a wallet prompt; the app must not claim success.
- [ ] Disconnect the client after opening a report; displayed plaintext should clear.
- [ ] Confirm an unrelated wallet/profile cannot decrypt the report.
- [ ] Try the guided walkthrough on mobile and use its keyboard alternative to dragging.

The recorded operator run also covers real Arkiv native expiry and a second browser receiving listing updates. For a live judge presentation, rehearse the intended wallet extensions separately, prepare the approved pass and report keys beforehand, and show actual receipts or a clearly labelled recording. The guided demo simulates qualification and payment; it is not transaction evidence.
