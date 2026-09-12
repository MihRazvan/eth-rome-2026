# Cutout — judge walkthrough (3 minutes)

Open https://cutout-ethrome-2026.vercel.app/?view=demo. No wallet, funds, credential files or Swarm account needed.

Cutout lets a client pay for a qualified technical review while keeping the report private. The reviewer proves issuer-approved eligibility before taking the work; the client opens the report before approving payment.

- [ ] **Write a brief.** Example title: “Review withdrawal permissions”. Scope: “Check who can withdraw and whether an unauthorized account can bypass approval.” Set **10 demo USDC**. Click **Continue to payment**.
- [ ] **Reserve the budget.** Click **Reserve 10 demo USDC**. This is a simulated escrow, not a wallet transaction.
- [ ] **Try qualification.** In the reviewer step, untick the example credential's validity and attempt qualification: it must refuse. Restore validity and continue. This example is simulated; it does not create a credential or proof.
- [ ] **Write a report.** Example: “Only the owner can withdraw. Add a test for a revoked operator. ✓” Click **Encrypt & seal the review**.
- [ ] **Open it as the client.** Drag the scissors, or use **Cut without dragging** with keyboard/touch. The recovered text must match exactly. The encryption/decryption here is actual browser AES-GCM.
- [ ] **Approve payment.** Click **Approve & pay 10 demo USDC**. Check the receipt shows the chosen amount and identifies payment as simulated.
- [ ] **Explore the app.** Choose **Open live workspace**. Switch Client/Reviewer and Tasks/Activity/Your workspace. Browsing requires no funds; the board can legitimately be empty. Document storage is included without a Swarm account.

The guided demo uploads nothing and keeps its encryption key only in memory. Reload/Start again discards the walkthrough; do not use it to store a real report. Mobile and keyboard use should work.

For the presentation: let the judge type the report and open it themselves. Explain the client → qualified reviewer → private report → approval sequence. Show real transaction evidence separately; the walkthrough receipt is not an onchain payment.

A live transaction demo needs prepared wallets, a current test credential and registered browser report keys. Follow the [teammate's real-flow tutorial](CUTOUT-MANUAL-TEST.md). The full funded public lifecycle has not yet been signed off.
