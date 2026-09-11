# Economics comparison verification

2026-09-11. These are **explicit design-preview checks**, not chain transactions or live integration evidence. The worktree frontend ran on `127.0.0.1:5175`; no chain or API process was changed.

- `vitest run tests/economics.test.ts`: 16 tests passed. Checks cover net-versus-expected discount/premium/equality, zero denominators, micro-USDC differences, large integers, rounded percentages, upside/downside/break-even, fees counted once, inconsistent gross rejection and malformed amounts.
- `tsc --noEmit`: passed.
- `vite build apps/web`: passed. Existing HPKE `crypto` externalization and bundle-size warnings remain.
- Standalone Chromium/Playwright: opened `/?preview=1&role=seller&view=trade&claim=1042`; verified the ticket and frozen sale review both show 40.00 test USDC less, a 0.40% discount. Closed review with Escape.
- Opened `/?preview=1&role=seller&view=claim&claim=1041`; focused “Make an offer” and opened with Enter. Entered 5985 net payment, focused “Check a payout scenario” and expanded with Enter. Default assumed proceeds 6000 showed +15.00; break-even was 5985.00. Replaced the assumption using the keyboard with 5700 and verified a −285.00 loss.
- Verified the signed-payment input stayed 5985, the URL stayed unchanged, and **zero HTTP requests** were emitted during assumption editing, screenshot capture and dialog closing/reopening. No offer was signed or submitted.
- At 390 × 844, the dialog had no horizontal overflow. Escape restored focus to the invoker; reopening reset the scenario assumption to the current expected 6000. No browser page errors occurred.

Screenshots: [seller](economics-seller-preview.png), [buyer desktop](economics-buyer-preview.png), [buyer narrow screen](economics-buyer-mobile-preview.png). The expanded scenario scrolls vertically inside the native dialog on a narrow screen; the funding disclosure and consent remain below it. The scenario starts collapsed to keep the primary offer task compact.

Implementation boundary: only `bid` and `bidMode` reach `actions.makeOffer`. Assumed proceeds live in a child component inside the dialog, so closing it or changing wallet/network destroys that state. Current custom offers have zero protocol fee; the pure buyer helper also accepts canonical gross/fee terms and never adds an included fee twice. Gas and other costs are explicitly excluded from the displayed scenario and break-even.
