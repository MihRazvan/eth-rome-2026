# Submission documentation verification — 12 September 2026

The root README and docs index now describe Cutout, with a separate product brief, quickstart, user flow, architecture, trust model, deployment, sponsor pages and evidence map. The earlier EXIT README is preserved in [the historical EXIT README](https://github.com/MihRazvan/eth-rome-2026/blob/c50937c/docs/history/EXIT.md). Original application paths and protocol identifiers are unchanged.

[Check summary](checks.json), [public hosted browser](hosted-browser.json), [local UI walkthrough](local-ui.json), [local links](links.json).

The documented focused Node test command passed 125 tests, with one optional external case skipped. All 18 contract tests, explicit pilot TypeScript and the static UI build passed. The bare Vite frontend passed desktop/mobile encryption and simulated-settlement walkthroughs with zero page errors or writes. The actual production origin passed four read-only checks, also with zero page errors/storage writes. The README application image was captured in that run; its draft scope was not funded.

An initial attempt to use the full hosted verification harness against bare Vite timed out waiting for API-dependent wallet readiness. That harness expects a configured backend. The local check was narrowed to the explicitly documented UI-only walkthrough and passed; no API response was fabricated. The standard full harness then passed against the actual hosted app.

Independent read-only review checked source claims, links and setup commands. Corrections: document the underlying local chain/Bee prerequisites; require Chromium for browser-using unit tests; build contract ABIs before active hosting; use the committed verifier fixture for standalone contract tests; avoid calling a task-only observation an Arkiv entity receipt.

No fresh Docker stack was created over the existing shared runtime. No new issuer credentials, keys, public transactions, sponsor submissions or app deployments were made in this documentation pass. The previously issued teammate credential was re-linked privately; it is not in this artifact set. Full public payment and Arkiv mission recordings remain separate acceptance items.
