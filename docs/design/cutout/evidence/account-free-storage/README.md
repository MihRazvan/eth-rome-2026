# Account-free public Swarm storage

12 September 2026. The user requires customer uploads without Swarm account setup. Source `6e923a6` is deployed to Cutout and the preserved Review Pass origin. No contracts, wallet keys, existing browser report keys or issuer state changed.

The active hosted build explicitly selects `swarm-gateway`. Its direct browser POST uses the documented zero-stamp gateway path; the gateway supplies its own postage. No end-user Swarm ID iframe, login, drive, recovery phrase or gift signer is used. The team's previously imported gift drive is not consumed or replaced. This supersedes the earlier assertion that authenticated Swarm sessions are required for the paid public test.

Uploads are bounded, copied, timed out and use omitted credentials, no referrer and rejected redirects. A normal 32-byte reference is required. Separate GET retrieval must match SHA-256 before the app accepts the upload result. Propagation retries only read; they never repeat POST. If upload succeeds but retrieval fails, the error preserves its public reference and digest. Financial actions still use the existing wallet, finalized chain checks, recipient bindings and browser encryption.

## Actual verification

- 15 gateway adapter tests pass, including cancellation, stale readiness, transient retrieval, response streaming bounds, wrong digest and native key-bearing reference rejection.
- The preceding combined run passed 50 storage/read-API/journey/settlement tests with one optional Swarm-ID SDK browser case skipped; the subsequent added response-bound test passed in the 15-test adapter run.
- Targeted pilot TypeScript and active Vercel build passed.
- `gateway-browser.json`: final actual Chromium run uploaded one 1,625-byte generated recipient-encrypted report to the public gateway. Both test recipients recovered the exact Unicode text; reload retained the local key; a separate browser could retrieve ciphertext but could not decrypt. A separate Node GET also matched SHA-256. No Swarm account or wallet was connected. Generated recipient bindings were not authenticated against chain, so this is storage/crypto evidence, not a funded task.
- `hosted-browser.json`: actual production desktop/mobile, no-account storage readiness/no iframe, role navigation, browser walkthrough and offline-config fallback checks passed with zero page errors or writes. This does not establish public funding/proof/payment.
- Two initial 69-byte capability POSTs (one without stamp header, one with the gift batch ID) returned the same reference `47edba86f26f1fc5d4b4ad33f3965695b089f2ede43bdd10800dd4cfcfcb1fe9`; independent GET matched. Gateway source explains that the gateway replaces the batch header, so this is **not gift-drive evidence**. The shipped adapter uses the canonical zero placeholder instead. One earlier encrypted development probe also succeeded before response-bound hardening.

`production-origin.json` additionally verifies a real POST from the deployed Cutout origin under its actual CORS/CSP, independent digest retrieval, and recovery after a deliberately failed gateway health request. It reuses the same generated ciphertext, with no new customer report. Four-view hosted checks were collected at `e0c19e2`; `6e923a6` only changes the workspace introduction and is covered by the final production-origin check.

Replay (the last two commands perform small real public uploads):

```sh
node docs/design/cutout/verify-browser.mjs https://cutout-ethrome-2026.vercel.app .runtime/cutout-gateway/hosted
node docs/design/cutout/verify-gateway.mjs .runtime/cutout-gateway/evidence
node docs/design/cutout/verify-gateway-production.mjs
```

## Service and bounty boundary

The official gateway is a trial/testing service with unspecified retention and daily transfer limits; it does not give this app a retention SLA. The app says demo storage is temporary and supports local report export. Production continuation: an operator-funded gateway with a stated retention policy. No fallback fixture, local Bee substitution, signing-key extraction or uncoordinated batch counter allocation is used.

Swarm ID is optional in the supplied bounty brief; direct Bee HTTP integration is intentional because wallet authorization and recipient encryption already supply the app's necessary identity/security boundaries.

Sources: [Bee-JS gateway example](https://github.com/ethersphere/bee-js), [gateway stamp management](https://github.com/ethersphere/swarm-gateway/blob/master/src/proxy.ts), [gateway terms](https://gateway.ethswarm.org/termsandconditions), [Swarm ID subsidy still requires identity](https://swarm.snaha.net/docs/subsidised-gateway/), [supplied Swarm requirements](../../../../review-pass/supplied-bounties.txt).
