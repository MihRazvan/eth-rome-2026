# Deaddrop release evidence — 13 September 2026

Public app: https://cutout-ethrome-2026.vercel.app. Source **8afc0e7**, deployment **dpl_61mGwgZyBDWUEbrfJF7bKUsjmuBw**. [Deployment](deployment.json), [file hashes](build.json), [qualification CI](ci.json).

## Actually checked

- **145 Node tests passed, one optional test skipped**, full pilot TypeScript passed and the isolated Vercel build succeeded. The full qualification GitHub workflow passed at this source, including Go proofs, contract tests, security probes, browser dependencies, pilot tests and production build. [CI run](https://github.com/MihRazvan/eth-rome-2026/actions/runs/34735573627).
- **Six hosted browser check groups passed**, zero page errors and zero upload/terms writes: thermal landing; keyboard cooling; issuer explanation; 320px home; busy role-switch guard; live preview; client/reviewer/activity/settings navigation; desktop and 390px demo; exact Unicode AES-GCM recovery; explicit simulated payment; deep-link/reload state; unavailable-config walkthrough. [Results](browser.json), [replay](../verify-browser.mjs).
- **Five public read-only saved-state checks passed**, zero page errors: task #4 remains Paid; its original client browser retrieves and decrypts the exact committed report before and after reload; download remains disabled until decryption; recovery stays disclosed; original reviewer pass survives this deployment and fits 390px. [Results](saved-state.json). Operator-owned original browser profiles and a read-only account bridge were used; all wallet signatures and transactions were forbidden. This is not a fresh funded lifecycle or a human extension-wallet signoff.
- A local candidate passed navigation with WebGL disabled, reduced motion and unavailable live configuration. [Fallback result](fallback.json). This is local interface evidence, not public network evidence.
- Independent source review caught and corrected role changes during wallet busy state, stale view URLs, the home skip target and thermal BFCache cleanup. Protocol formats and browser key namespaces were checked for preservation.

## Visual inspection

[Hosted landing](../assets/home.png) · [hosted client draft](../assets/application.png) · [320px landing](home-mobile.png) · [simulated demo receipt](demo-receipt.png) · [actual paid report](paid-report.png) · [saved pass on mobile](saved-pass-mobile.png).

These are rendered application captures, not design mockups. The paid task's historical title and plaintext still say Cutout because they are real committed content; the rebrand does not rewrite them. The client draft is unfunded. Demo payment is labelled simulated. No sample users, collectives or financial activity were added to production.

## Preserved boundaries

No contract deployment, funding, acceptance, payment, Arkiv publication, issuer reset, proof setup regeneration or new Swarm upload was performed for this visual release. Existing public paid-lifecycle receipts remain in [saved-pass evidence](../../../deaddrop/evidence/saved-pass/README.md). Retrieval in this pass used that genuine prior report.

The existing app hostname remains in use because credential/report keys are origin-bound. Historical internal names and paths remain for compatibility. [Design and bounty decisions](../README.md) explicitly separate the proposed heartbeat, auction, feeds, padding and asset-track changes from implemented behavior. Team1 track selection was not changed in this pass.
