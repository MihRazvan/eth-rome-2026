# Try Deaddrop in three minutes

[Open the walkthrough](https://cutout-ethrome-2026.vercel.app/?view=demo) · [Real testnet test](TESTING.md) · [Docs](../README.md)

No wallet, funds, reviewer pass or storage account is needed. The walkthrough uses real browser encryption; qualification and payment are clearly labelled simulations. It uploads nothing.

1. **Write a brief.** Try “Review withdrawal permissions” and ask whether an unauthorized account can bypass approval. Set a budget of **10 demo USDC** and continue.
2. **Reserve payment.** Confirm the simulated escrow. No money moves.
3. **Check eligibility.** Disable the example credential’s validity and try to continue: qualification must refuse. Restore validity and take the task.
4. **Write the report.** Include a recognizable sentence and a Unicode character, for example “Only the owner can withdraw. Test a revoked operator. ✓”. Choose **Encrypt & seal the review**.
5. **Open it as the client.** Slide to open, or choose **Open without dragging**. The recovered text must match exactly. AES-GCM encryption and decryption run in this browser.
6. **Approve payment.** The receipt should show **10 demo USDC** and **Simulated · no transaction**.
7. **Explore the live workspace.** Switch between Client and Reviewer. Browse Tasks, Activity and Your workspace. The public board may be empty when no eligible listings exist.

Reloading or restarting discards the walkthrough and its in-memory key. Use a harmless report, not work you need to retain.

## What the real product adds

The client funds test USDC on Fuji and advertises the task on Arkiv. An approved reviewer generates a real proof in the browser and signs acceptance. Swarm stores the encrypted report. The client opens it and releases the escrowed payment.

Reviewer approval is manual. Apply in **Reviewer → Your workspace → Your reviewer pass**, then collect the issuer’s approval in the app. The resulting pass is saved locally; ordinary use requires no credential JSON exchange. The issuer approves test participation, not professional accreditation.

A complete public run already settled **task #4 for 0.1 test USDC**, including browser proving, Swarm delivery and exact report decryption. [Inspect the receipts and verification scope](evidence/saved-pass/README.md). For your own real flow, use the [two-wallet tutorial](TESTING.md).
