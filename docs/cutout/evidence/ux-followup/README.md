# Selective UX follow-up

13 September2026. Final application source **4f67608**. [Deployment](deployment.json), [build hashes](build.json), [accepted/rejected suggestions](../../UX-PRIORITIES.md).

The reviewer board now presents reward, acceptance cutoff and verified scope on paper task cards. Existing compound filtering is preserved; display sorting adds closing-soon and highest-reward order. Stream diagnostics are disclosed, empty state provides the guided demo, and direct reviewer links show the correct heading. Reports become a compact verified state after actual decryption; download stays disabled until then. No contract, circuit, key namespace, envelope or Arkiv schema change.

## Actual checks

[Full qualification GitHub CI](ci.json) passed at final source4f67608, covering Go/protocol/security/contracts/transport/pilot/TypeScript/build. This includes the new board tests.

- **20 focused Node tests passed:** board/listing suites. New cases cover full-precision reward ordering without mutating query results, escaping untrusted text, disabled stale-state actions and distant deadline rendering.
- Pilot TypeScript and active hosting build passed.
- [Final hosted browser checks](hosted-browser.json): desktop/mobile navigation, guided real AES-GCM/simulated settlement, direct reviewer URL/sort control and offline-config walkthrough; zero page errors or storage writes.
- [Actual empty board](empty-public.json), [390px screenshot](empty-public-mobile.png): genuine Arkiv connection returned no eligible listings at the recorded time; the empty-state action entered the explicitly labelled guided demo. No fake records or wallet needed. This is a dated state, not an expectation that the board stays empty.
- [Existing paid task browser checks](paid-ui.json), [screenshot](paid-desktop.png): actual public task4 remains PAID; authorized client recovers exact report before/after reload, download enables after decryption, cut control becomes the verified state, saved pass persists and recovery remains available. These ran at27df5ce; the final4f67608 change adds only the empty-board action. Wallet bridge permitted reads only; no new funding, acceptance, delivery or payment occurred.
- [Labelled layout checks](board-browser.json), [desktop](board-layout-desktop.png), [mobile](board-layout-mobile.png): populated card states use an explicitly labelled frozen copy of the local rendered DOM with synthetic records. They prove layout/escaping/control behavior, not live opportunities or sponsor transactions. Sorting logic has executable unit tests; no fabricated listings are shipped in the product.

The actual public paid lifecycle and Arkiv native-expiry/two-browser write evidence remain in the separate [saved-pass record](../saved-pass/README.md). This UX pass does not claim new issuer accreditation, anonymous payments, guaranteed storage retention, padding or separate payout contracts.

Replay the read-only UI checks from the repository root:

```sh
node docs/design/cutout/verify-browser.mjs https://cutout-ethrome-2026.vercel.app .runtime/cutout-hosted-check
node --import tsx --test experiments/qualification/pilot/board-presentation.test.ts experiments/qualification/pilot/listings.test.ts
```
