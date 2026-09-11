# Navigation, confidentiality and keyboard follow-up

Implemented after baseline research commit `6538582`, on shared interface foundation `7e94920` (worktree cherry-pick `1cb7ccf`). Assigned product changes are confined to `apps/web/src/App.tsx`, `styles.css`, the new pure `navigation.ts`, and `tests/browser/navigation.spec.ts`.

## Changes

- Route contains only public navigation metadata: `view`, numeric `claim`, and `offers=public|private`. Existing `preview`, `concept`, `role`, unrelated search parameters and fragments survive navigation. Reload and browser Back/Forward restore context. Missing or malformed explicit claims have a recovery screen and never substitute the first claim.
- Chain state last-checked time uses `AppData.updatedAt`. Its ordinary text does not announce every timer tick or imply offer-specific freshness/reserved funding.
- Successful empty discovery says no active offers; per-claim `offersUnavailable` shows a discovery-failure message, disables offer acceptance and leaves chain inspection/collection independent. Controller population of the new field is integrator-owned and requires integrated failure-path verification.
- Dialogs use a referenced native element with a stable heading label. Effect cleanup closes before restoring focus, including StrictMode's development effect replay; unavailable invoking controls fall back to main content.
- Wallet/network identity changes synchronously suppress confidential dialogs, then clear frozen review terms, bid input, acknowledgement and transient selection before painting. Public route/mode remain. No claim of secure heap erasure is made.
- Both public and private maker forms disclose the separate fixed 100,000 test-USDC capital authorization, no reservation, and signature-scoped spending. Consent explicitly includes this limit. The shared constant comes from the integrator; actual approval policy is controller-owned. Private-mode copy states that request metadata/timing and submitted settlement remain public.

## Executed checks, 2026-09-11

Own development frontend at `http://127.0.0.1:5175`, existing API at 8787, and own production preview at 5176. No shared runtime reset, onchain transaction, new offer request, key change or signature. Local role changes affect only the isolated browser context and trigger reads.

```
EXIT_BROWSER_BASE_URL=http://127.0.0.1:5175 playwright test tests/browser/navigation.spec.ts
```

**5 passed**: private-route reload/history with preview flags; missing/malformed claim safety; named maker/sale dialogs with Escape/close focus return and no entered price in URL; actual read-only chain freshness plus 320px reflow; external-account-change simulation through the public local role control clearing private price/consent. The latter dispatches a change while the native modal makes background controls inert, modeling an external wallet account change. It neither approves nor transacts.

```
tsc --noEmit
vite build apps/web
EXIT_BROWSER_BASE_URL=http://127.0.0.1:5176 playwright test tests/browser/navigation.spec.ts --grep 'trade dialogs'
```

TypeScript **passed**. Production build **passed** with existing HPKE Node-crypto externalization and >500kB chunk warnings. Production dialog regression: **1 passed**. Screenshot capture reported **zero page errors**.

Post-change screenshots: [private route desktop](improved-private-route-1440.png), [private route 390px after reload](improved-private-route-390.png), [maker consent in production preview](improved-maker-consent-production.png). Original `current-*` images in this directory describe the pre-change read-only assessment, not the new implementation.

These checks do not validate live sponsor integration, transaction persistence across reload, new allowance behavior, or discovery failure propagation from the integrator's updated controller. They do not constitute a complete accessibility audit. Parent integration must run affected checks on its final combined head.
