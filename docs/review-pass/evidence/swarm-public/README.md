# Public Swarm connection verification

Observed September12,2026. The user connected their existing Swarm ID account on https://review-pass-ethrome-2026.vercel.app and uploaded a generated public connection note. The agent independently retrieved the exact bytes; no signer, recovery phrase or authenticated browser session was used for retrieval.

- Reference: `7da258b6f55a74b9dffa25bafa99f435b8833b85ecad14d25f8d33a37acb5f03`
- SHA-256: `0xd98c0d67934860864524b299d645f77a3fd7b9fe4bccb9d5a217139ac02dc60f`
- Actual length:142bytes; format `review-pass-public-storage-test`.
- Retrieval: https://api.gateway.ethswarm.org/bytes/7da258b6f55a74b9dffa25bafa99f435b8833b85ecad14d25f8d33a37acb5f03
- Production fix: `dpl_3HkvAAqBsRkyydWRXc2r3kfW4dKq`, immutable URL https://review-pass-ethrome-2026-axlrr21vc-mihrazvans-projects.vercel.app.

Root cause: `https://gateway.ethswarm.org/bytes/...` returned960bytes of website HTML with HTTP200, whose SHA-256 correctly failed authentication. The API subdomain returned the correct142bytes and allows cross-origin reads. Changed the adapter default, setup page, deployer default, hosting config/CSP and corresponding API-test configuration. Preserved credentials-omission, redirect rejection, size/time limits and digest verification. The attached console's unrelated chunk references do not establish failure of this uploaded note.

`retrieval.json` records an actual application-adapter download plus a fresh unauthenticated Chromium fetch at the production origin, verifying live CSP/CORS and exact digest. `hosted-browser.json` records the production setup regression checks. No network interception, response fixtures, retries via uploader or new storage writes were used for these reads.

Validation:19storage/read-API tests passed and1optional iframe-network test skipped; TypeScript and isolated pending build passed; fresh hosted browser role/iframe/mobile/API checks passed. This is public connection-note evidence, not encrypted-report or Fuji settlement completion. Sponsor postage expiry was reported by the user's UI as roughly September16; this dated observation does not promise indefinite availability.
