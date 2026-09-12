# Cutout — teammate end-to-end tutorial

App: https://cutout-ethrome-2026.vercel.app. Start with the [3-minute judge walkthrough](CUTOUT-JUDGE-TUTORIAL.md); it can be tested immediately without any setup. The live procedure below is an acceptance test, not a claim the whole funded public flow has already passed.

## What needs funds?

| Action | Needed |
| --- | --- |
| Guided demo; browse live tasks and public scope | Nothing |
| Swarm document storage | Included; no account, drive or tokens |
| Register each browser's private-report key | That role's Fuji test AVAX |
| Fund a real review | Client: 10 canonical Fuji test USDC plus test AVAX |
| List the funded review on Arkiv | Same client: Tiramisu gas token (test GLM) |
| Generate a real qualification proof | Current class-7 credential plus matching private holder file; proof generation itself needs no gas |
| Accept work and submit delivery | Reviewer: Fuji test AVAX |
| Open a delivered report | Authorized recipient's original browser key; no gas |
| Approve payment | Client: Fuji test AVAX; reward comes from escrow, not a second USDC payment |

No particular address is allowlisted. Use wallets you control. The participant addresses Razvan previously supplied were:

| Role | Address |
| --- | --- |
| Client | `0x92AAe0857979a139344f5b6F008e71F27A507522` |
| Reviewer | `0x3a4205C246a48eC073ED4B3D12951cd4203713dA` |
| Deployer/issuer operator — not needed for ordinary task actions | `0xB9080458DE79F614DB5d5208AB31bbF22A33DeAd` |

Funding was reported earlier; check the app's current balances for whichever wallets you actually connect. Engineering also has a separate funded rehearsal pair (`0x7259…3a60` / `0x7292…8A1`); those are operator-controlled and are not automatically available in your wallet.

## Prepare before funding a task

- [ ] Open two separate browser profiles, one client and one reviewer, each connected to its intended wallet. Changing the role toggle does not switch wallets.
- [ ] In each profile, open **Your workspace → Private reports & storage → Enable private reports**. Sign the Fuji key-registration transaction and confirm this browser's key is registered. Reuse an existing valid registration; no key rotation is needed.
- [ ] Confirm **Document storage: Included · no storage account needed**. If unavailable, use **Check storage connection**. No Swarm login is required.
- [ ] Confirm the reviewer's current **class-7 credential JSON** and matching **private holder JSON** are available locally. For first enrollment, open Reviewer → Wallet & storage readiness → Set up qualification. Prepare enrollment, save the private holder backup, and send **only the enrollment request** privately to the Cutout team. Engineering signs the approved test credential and returns it; the holder's secret stays on the holder's device. Creating a request alone does not grant qualification. [Enrollment details](review-pass/QUALIFICATION-PROVISIONING.md).
- [ ] Confirm client reward/gas and reviewer gas, and an **Arkiv live** board. Keep both profiles on their chosen hostname throughout. Existing engineering profiles use `review-pass-ethrome-2026.vercel.app`; their keys do not automatically carry over to the Cutout hostname.

## Run the real flow

1. **Client → Tasks:** enter the example title “Review withdrawal permissions”, a non-sensitive public scope, and **10 test USDC**. Check the public-scope checkbox. Set the discovery lease to **900 blocks** for this rehearsal so the default short lease does not disappear during proving; leave generous task deadlines.
2. Click **Fund & post task**. Approve the token allowance and funding transactions. Wait for finalized confirmation. **Activity** must show the task ID, scope and 10 test USDC reward. Save the funding receipt.
3. **Client → Activity → List this review:** approve the Arkiv network switch and listing transaction. Save the entity/transaction receipt. Return to Fuji and reconnect if prompted. Funding and listing are separate actions.
4. **Reviewer → Tasks:** find that listing and click **View verified scope**. Verify the title, scope and amount match the client's task.
5. Select the two local files in **Credential JSON** and **Private holder JSON**. Click **Cut a qualification proof** and wait for verification. Then click **Accept this task**, sign and wait for finalized acceptance. Generating a proof alone does not reserve the task.
6. **Reviewer → Activity:** type a recognizable, non-sensitive report, including a unique sentence and “✓”. Click **Seal & deliver report**. Wait for verified Swarm upload and the Fuji delivery transaction. The task must become **Submitted**.
7. **Client → Activity → Refresh activity:** confirm the task is Submitted and payment is unavailable before opening. Drag to cut or click **Cut open report**. Verify every character of the report matches. Save a copy; demo gateway storage is temporary.
8. Reload the client page in the same browser/profile. Reconnect if needed, reopen the report and verify the text again. Reloading should preserve the live report key; it may require opening the report again before payment.
9. Click **Approve & pay 10 test USDC**, sign and wait for finality. Check **Paid** and the payment receipt. Reviewer USDC should increase by 10; client paid the reward at funding. AVAX gas is separate.

If any step fails, stop at that step and record **URL + role + task ID → action → expected → actual**. Include the public transaction hash and screenshot if useful. A rejected or stalled transaction is not a completed action; inspect its receipt before repeating funding. Never include wallet keys, credential contents or holder secrets in feedback.

## Extra manual checks

- [ ] Judge walkthrough on mobile; keyboard alternative to dragging; clear distinction between real encryption and simulated payment.
- [ ] Reject a wallet prompt and confirm the app does not claim success.
- [ ] Disconnect the client wallet after opening a live report; displayed plaintext should clear.
- [ ] An unrelated wallet/profile cannot open the live report. Public ciphertext and task metadata remain readable by design.

Engineering owns transaction/balance reconciliation, snapshot and proof diagnostics, tampered-byte tests, and the separate Arkiv native-expiry/reconnect evidence. Revocation and deadline/dispute tests need separate tasks and credentials; preserve the main demo credential.

## What to show during the demo

Use the judge walkthrough immediately. Promote the real flow to the stage only after this entire checklist passes. For the live presentation, prepare both profiles/credential files beforehand; show funding, qualification/acceptance, report delivery/opening and payment with actual receipts. Keep terminal provisioning and storage/network troubleshooting offstage, and describe the issuer as an experimental test issuer rather than an accredited reviewer network.

Publication recovery: if task #1 is already funded, use its existing Activity card and **List this review**; do not fund a duplicate. The task creator needs to approve adding/switching to Tiramisu and the listing transaction, then reconnect Fuji. The default discovery lease is now up to 900 blocks (about 30 minutes), automatically shortened to fit the remaining acceptance window. The actual creator wallet `0x746bb7beFD31D9052BB8EbA7D5dD74C9aCf54C6d` received 0.01 test GLM for publication on 12 September.

### Qualification file selection

The enrollment download produces a private holder backup and an enrollment **request**. It does not produce a signed credential. The issuer returns a separate credential JSON after approving that request. In the proof form, choose that returned file for **Credential JSON** and the original `cutout-private-holder.json` for **Private holder JSON**. Keep both private. If the file controls are disabled, reconnect the reviewer payment wallet on Fuji. An enrollment request, swapped files, mismatched backups, expired credentials or the wrong qualification class must be corrected before proving. File-shape checks do not verify the issuer signature; the browser proof and contract simulation do that.

If connecting in Reviewer view previously returned to **List this review**, the wallet supplied the task's funding account. Cutout now shows **This is the client's wallet** instead. Use **Choose reviewer account** to open the wallet's account permission selector. If it still returns the funding account, select/authorize only the reviewer account in the wallet's connected-site settings, then **Reconnect selected account**. The task stays open; do not list or fund it again. Switching the Client/Reviewer tab alone never switches a wallet account.
