# Saved reviewer passes and a paid public review

Recorded **13 September 2026**, public Cutout application. The enrollment and paid lifecycle ran source `a52e21f`; final interface checks use `cf02149` (the `57fff10` interface plus a stale-wallet approval guard). This is actual Fuji, Arkiv Tiramisu and public Swarm, driven through Chromium with **operator-owned test wallet signing bridges**. It is not a human wallet-extension test or production accreditation.

## What happened

1. Reviewer applied in the live app. Browser WASM generated a holder, saved it locally and HPKE-encrypted an application. A wallet signature authorized its actual Arkiv relay publication. The issuer approved explicitly offline; the browser collected the encrypted response and saved its pass without downloading or selecting files.
2. Client funded **task #4** with **0.1 canonical Fuji test USDC** and a generated non-sensitive public scope.
3. Client published an Arkiv listing. The reviewer's already-open board received it through its actual WebSocket subscription. A 20-block native lease expired: the same query returned the entity at block **377455**, then no entity at **377474**. The board removed it without refresh or deletion; the Fuji task remained funded and Open.
4. Client relisted the same funded task with a longer lease. The reviewer used its saved pass to generate a real browser proof, passed acceptance simulation and signed the actual acceptance transaction. No proof-file selection occurred.
5. Reviewer encrypted/delivered a generated Unicode report through public Swarm and committed it on Fuji. Client retrieved and decrypted the exact report, then approved payment. All Fuji receipts finalized; reviewer balance increased from **0 to 100,000 base units**.
6. After the final UI deployment, a separate read-only browser check confirmed **PAID**, exact report recovery before/after reload, saved reviewer pass persistence and no normal file picker. Recovery controls remained accessible behind a disclosure; mobile width was checked.

## Artifacts

| Artifact | Scope |
| --- | --- |
| [Enrollment receipt](enrollment.json) | Public ticket, Arkiv entity and encrypted-approval transaction; no private credential/holder bytes |
| [Collection/reload](collect-browser.json) | Actual encrypted response collected into the original browser |
| [One-time old-pass import](restore-browser.json) | Local UI migration and persistence using operator-owned legacy files |
| [Arkiv mission evidence](arkiv-missions.json) | Actual publication, entity, unchanged query before/after native expiry and two-browser observations |
| [Live listing screenshot](live-listing.png) | The second browser displaying the real public listing |
| [Full public flow trace](full-flow.json) | Actual steps and transaction hashes, including the final harness timeout described below |
| [Finalized payment reconciliation](finalized-payment.json) | Same task's funding/acceptance/delivery/payment receipts, balance increase, document hash and separate public retrieval |
| [Read-only payment replay](payment-replay.json), [executable replay](verify-payment.mjs) | Finalized receipt hashes, exact USDC Transfer event, current Paid task and stored ciphertext digest; no keys needed |
| [Final paid browser check](paid-ui.json) | Actual Paid UI, exact report recovery across reload, saved pass and mobile layout; all signing forbidden |
| [Paid task screenshot](paid-desktop.png), [saved pass](pass-desktop.png), [mobile pass](pass-mobile.png) | Final hosted interface with operator-generated non-sensitive test data |
| [Public desktop/mobile walkthrough checks](hosted-browser.json) | Actual UI; guided qualification/payment are explicitly simulated |
| [Build hashes](build.json), [deployment](deployment.json) | Exact final application source and public artifact hashes |
| [Independent enrollment review](enrollment-review.md) | Verified fixes and explicit remaining service/browser trust boundaries |
| [GitHub qualification CI](ci.json) | Full Go/protocol/security/contracts/transport/pilot/TypeScript/build workflow passed at final application source cf02149 |
| [Focused test summary](verification.json) | 142 passing Node tests, one optional external skip, TypeScript/build and browser checks |

Application records live for two days; approved passes have their own displayed expiry. The demonstration report is deliberately non-sensitive. Screenshots may show public wallet addresses and the synthetic report. The actual private holder, credential, reply key, report keys, operator keys and browser profiles are **not** in this evidence directory.

## Harness interruptions and corrections

This was **not one uninterrupted passing automation script**. The initial application probe clicked Connect before app initialization after reload; the request had already been published. A subsequent browser collected the existing approval successfully, without creating a duplicate. The final UI now disables Connect while initializing.

The funded-flow harness first tried to edit a lease field hidden in Activity; its resumption then asserted a proof button before the task refresh finished. Both were corrected in the harness, preserving task #4. Two redundant registrations of the same browser keys are visible in the public trace; no old key was discarded. The final run completed payment but waited for mixed-case “Paid” while the card renders “PAID,” causing a timeout **after** the successful payment transaction. The trace preserves that failure. Independent finalized receipt/balance reconciliation passed, and a subsequent read-only browser run asserted the actual PAID status and exact report decryption before/after reload.

The optional external test skip is retained; no skipped test is presented as passed. Earlier local contract/adverse-path evidence remains separate. No contract/circuit/setup change was made in this UX pass.

## Recheck without keys

From the repository root after `npm ci`:

```sh
node docs/deaddrop/evidence/saved-pass/verify-payment.mjs
node docs/design/cutout/verify-browser.mjs https://cutout-ethrome-2026.vercel.app .runtime/cutout-hosted-check
```

The first reads public receipts, verifies the payment Transfer and checks current ciphertext availability. The second is a read-only UI/guided-demo check. Historical native expiry cannot be recreated by querying an already expired entity; the recorded unchanged-query pair preserves that observation. A fresh native-expiry demo requires a new eligible listing, not a deletion.

Remaining human work: the teammate's own extension-wallet rehearsal, final presentation recording/slides and actual sponsor/event submissions. Manual issuer approval remains intentional; the new interface automates encrypted transport and local pass storage, not expertise assessment.
