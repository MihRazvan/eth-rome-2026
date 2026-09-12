# Independent Review Pass UI integration review

Reviewed root integration independently of its UI/server author on September12,2026. I authored the separate listings module, so this is independent review of `pilot/web/main.ts`, `start.mjs` and their integration, not independent certification of my own listings code. Source was uncommitted above root `ccd10426f1ce351ca45998a47181d4f9ef173ed5`; hashes are in `ui-review-evidence.json`. Root was actively editing, so later changes need their own verification.

## Actual browser observations

An isolated headless Chromium profile opened `http://127.0.0.1:18889` without an injected wallet, account connection or transaction. At09:26:13UTC the page loaded asset `index-CCsit4Dz.js`, displayed local-pilot chain31338 and reported a live Arkiv stream at block348405. One real WSS connection sent `eth_subscribe` for Arkiv logs at operation address `0x4400000000000000000000000000000000000044` and for `newHeads`;15 subscription notifications were observed. No page exception, failed request or CSP violation was observed. CSP explicitly allowed the configured WSS origin.

The public board was empty. It did not substitute local jobs into that board or claim a completed sponsor demonstration. Twelve `arkiv_query` requests included initial/head reconciliation and individual event hydration; source inspection shows no repeating entity-query timer and no live watcher `fromBlock`. These observations establish actual browser-to-public subscription plumbing, not a relevant two-client update or native-expiry demonstration.

The unauthenticated local view showed two already-paid local jobs with verified public scopes. Their plaintext report areas were empty and action buttons disabled. Desktop1440 and mobile390 widths had no horizontal overflow. Screenshots were visually inspected; the board, public-scope confirmation, device actions and separate funded-work area were legible. Screenshots were retained temporarily rather than committed with potentially changing local-job contents.

## Requested integration fixes

**Medium — publication errors disappear after the expected network switch.** `action('publish')` switches to Arkiv; the `chainChanged` listener increments `generation` and clears wallet state. Any subsequent `driver.publish` failure is caught by `run`, which deliberately suppresses errors from the old generation. An insufficient-GLM error, user rejection or storage/RPC failure after that switch can therefore leave only the unrelated “private views cleared” notice. Keep a publication-specific result/error channel across its expected chain transition, invalidate unexpected account changes and restore or explain the current network after failure. This is a source-level deterministic control-flow finding; no actual wallet rejection was triggered during this read-only review.

**Medium — configured payment identity is not independently checked at startup.** `verifyListing` compares token to `config.token`, and terms matching also uses that value. Server startup verifies code exists but does not compare escrow `token()`, `verifier()`, `issuer()` and `arbitrator()` with configuration. An accidentally wrong yet deployed token address can make UI descriptions differ from the token the escrow actually uses. Check immutable addresses before serving the app. This is a configuration boundary finding, not evidence that the observed deployment was misconfigured.

**Low — publication uses a cached Open job.** The publish button is derived from the last `refresh()` and the action only checks cached scope/client. A job accepted or otherwise changed since that read can still incur a GLM publication transaction, after which discovery correctly rejects it. Re-read finalized/current job state and authenticated terms immediately before asking for publication; explain that the check cannot reserve the job. No custody bypass was found: authoritative board verification and acceptance remain separate checks.

**Low — blanket encryption copy conflicts with public scope.** The introduction says documents are encrypted for recipients, but the new scope is deliberately public. The checkbox correctly states only the completed report is encrypted. Change the introductory noun to “reports” so this boundary is consistent before a client uploads anything.

**Low — paid local jobs retain a FUNDED amount caption.** The actual screenshot has PAID status alongside a FUNDED reward caption for a disconnected observer. This does not alter chain state, but the secondary label should reflect paid/refunded status or simply say “Reward.”

## Correct boundaries observed in source

`verifyListing` binds configured chain/escrow/token, current owner and immutable creator, reward, qualification class, acceptance deadline, onchain terms reference and exact SHA256 digest. Its job and reference reads share one observed block; fetched canonical terms are rehashed and compared with the funded job. Failed scope retrieval throws, preserving unavailable-state handling rather than treating malicious or missing data as valid.

The Arkiv board and escrow job list are separate. Public deployment filtering keeps a connected actor’s own jobs plus explicitly selected jobs visible independently of discovery lease retention. The lease notice says that escrow and accepted work remain on the settlement chain. This is honest: saved job identifiers may still be accepted while the Fuji contract allows it; lease expiry is a discovery feature, not cancellation authority or cryptographic revocation.

Public titles and scopes are escaped for HTML rendering. Device/private document state is cleared on account, chain and provider disconnect events. `run` disables actions while pending; stale or error board states disable the board’s view action. Listings never receive credentials or holder secrets, and the provided source still uses explicit projected public terms.

The server now refuses a stale issuer snapshot against the current root, a useful improvement observed during the review. It still serves only its assigned loopback host/port; this is not the public deployment required by the current Arkiv form. `/api/config` is intended for public network configuration; keep access-key-bearing RPC URLs and extra secret fields out of that configuration because browser clients necessarily receive it.

## Remaining evidence gates

No public Arkiv creation, client publication, native lease expiry, lease renewal, wrong-owner transaction, two-client relevant event update, browser wallet network rejection or deployed-public-origin test ran in this review. The earlier socket-close probe and deterministic listings tests remain separately labeled. Native-expiry mission proof still requires an actual create receipt, identical query before/after, applied expiry and natural block advance, visible app change, and evidence no delete caused it. A live stream badge over an empty board is not Mission03 completion.
