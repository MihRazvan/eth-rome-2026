# Cutout — teammate manual test

Use https://cutout-ethrome-2026.vercel.app in a fresh browser. The teammate owns the human review; engineering owns fixes, automated checks, network diagnosis and evidence.

## Test now — no account needed

1. Explain what Cutout does after seeing the first screen. Note any wording that needs explanation.
2. Choose **Try the demo**. Edit the brief and budget, reject an invalid example credential, then continue with a valid one.
3. Write your own report, seal it and cut it open. Confirm the exact text returns and the receipt has your budget. Try keyboard opening too.
4. Return to the live workspace. Switch Client / Reviewer and Tasks / Activity / Your workspace. Confirm each page and next action make sense.
5. Repeat on mobile. Check text, buttons, scrolling and the visible distinction between real encryption and simulated qualification/payment.

Report only: **URL/role → action → expected result → actual result**, plus a screenshot or recording if useful. Include confusing wording even if nothing crashes.

## Real payment test — after authenticated storage is ready

Two separate browser/wallet contexts are required; the role toggle alone does not switch wallets. Existing operator profiles use the preserved Review Pass hostname, which displays Cutout; keep each profile on its original hostname to retain its registered private report key.

1. In both prepared profiles, use **Your workspace → Private reports & storage → Connect storage** to sign into the intended Swarm account with usable upload capacity. The latest operator check found neither rehearsal role ready for uploads. No pasted IDs, keys or recovery phrase in Cutout.
2. Follow the prepared client/reviewer flow: **fund 10 test USDC → list review → prove and accept → seal and deliver → client opens → approve and pay**. Detailed button-by-button instructions are in the [team brief](CUTOUT-TEAM-BRIEF.md#how-to-test-the-real-flow-end-to-end).
3. Judge the experience: wallet prompts describe the right action, the report survives reload in the same profile, another wallet cannot read it, and the final paid amount/receipt are clear.

Engineering will verify transaction finality, balances, cryptography, Arkiv expiry/subscription recovery and stored-byte integrity. Do not treat a walkthrough receipt as a real payment. Public funded lifecycle and native-expiry evidence remain pending until actually executed.
