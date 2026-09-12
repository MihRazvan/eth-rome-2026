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

## Source closure at f8e8f1a

A read-only source follow-up examined root commit `f8e8f1a83ba84e70768b090e8f4fa1d308e7b6c1` on September12,2026. No wallet interaction, process restart, public write, deployment or new browser test occurred in this follow-up. The original five findings are addressed in source as follows:

| Finding | Closure evidence |
| --- | --- |
| Publication errors suppressed by session-generation change | The publication action now catches its own errors and writes `#discovery-change`, so expected chain changes no longer suppress the error through `run`. |
| Escrow/config identity mismatch | Startup reads escrow `token`, `verifier`, `issuer` and `arbitrator`, rejects mismatches, checks six token decimals and restricts Fuji to the configured canonical test-USDC address. |
| Cached Open-state publication | The action now calls `verifyListing` before switching chains and publishing. That callback rechecks current/finalized job state and exact committed scope. |
| Blanket encryption wording | Introductory text now says reports are encrypted. Public scope confirmation remains explicit. |
| Paid jobs labeled FUNDED | An unrelated observer now sees the actual uppercase job status as the amount caption; client/reviewer role captions remain. |

Exact source SHA256 values at this closure observation:

```text
experiments/qualification/pilot/web/main.ts
b8a83c5032f9739a907a534a98b80818e0c0d7e2cfdd1d0c36171da75c0e9a0b
experiments/qualification/pilot/web/index.html
563dd3701b4e1f8e210ebc537548c4f6cd4ee7306f3958fa80b4149f38378fbc
experiments/qualification/pilot/start.mjs
35b54167d0fb9663c8ee149a2c048307f8f5852c65de3f51758d1b4a003548de
experiments/qualification/pilot/listings.ts
6c64fdfd3e4acf277975b04c579a41555568bba8831d336f506b7d96fa1dcca6
```

One residual low-severity publication feedback issue remains at this exact source revision: `driver.publish` can return a confirmed creation receipt, after which a rejected switch back to the settlement network reaches the same catch and replaces success text with “Publication was not confirmed.” Preserve the confirmed receipt and handle return-network failure separately. The existing instruction to inspect Arkiv activity before retrying helps avoid blind duplicate publication but does not make that status wording correct. This was reported to root; no real wallet rejection was executed.

The current/finalized job check is a point-in-time observation. Another transaction can accept the job while the client is switching networks or approving publication; the board will still reject a stale advertisement. There is no cross-chain reservation or atomic publish-and-fund guarantee. Signer/client binding and browser account-list checks remain; a dedicated publication session guard for unexpected account changes is not present. The observed source does not establish a wrong-owner signing bypass, and wallet authorization remains required.

Root reported separate six-check final-startup and sixteen-check full browser evidence; this source review did not rerun or independently attest those counts. The earlier actual Chromium WSS observation is preserved above at its original asset/hash context. Public creation, a relevant two-client event update, native-expiry receipts and the public deployed dapp remain unverified by this review. Closing source findings does not complete the sponsor missions.

## Executable closure of publication receipt preservation

The residual feedback issue is closed in source at root `68fdf3704801cad067d12550259bff669ca2b979`. At09:50:19UTC on September12,2026, an isolated control-flow probe extracted the actual `case "publish"` branch from `main.ts`, removed TypeScript annotations with Node24 `stripTypeScriptTypes`, and executed it with local injected wallet, verification, driver and DOM test doubles. No branch was reimplemented. All public methods were replaced with local stubs; no network call, wallet interaction or transaction occurred.

| Injected scenario | Actual extracted-branch result |
| --- | --- |
| Successful publication and successful return switch | One verification, one publish call, Arkiv then settlement switch; entity key, transaction hash and expiry retained. |
| Successful publication, rejected return switch | One verification and one publish call; confirmed entity key, transaction hash and expiry retained, plus explicit manual-network-switch guidance. The text does not say publication was unconfirmed. |
| Rejected publication | One verification, one publish attempt and only the outward Arkiv switch; feedback says publication was not confirmed and instructs checking wallet activity before retry. No successful entity receipt appears. |

All three scenarios passed assertions. The two switches were `0x7614d1` (Arkiv7738577) and `0x7a6a` (local settlement31338). Each action returned the existing `preserve` sentinel. The actual returned-network error is caught inside the success branch, so it cannot overwrite the confirmed publication receipt through the outer catch. The CSS now applies `overflow-wrap: anywhere` to `#discovery-change` and `#transactions`; this follow-up inspected that rule but did not rerun its browser layout.

```text
main.ts SHA256
7c71c56567fff255a1a3fba05abe58dd6555cb93e2286a4a81cb69448ed2320b
extracted case "publish" branch SHA256
188932c6a4b40bc77dfcc5c7a5b7ff198b4a498c02c464c8ee8e566f83f4b7f4
pilot.css SHA256
a16295583fd7b70151bc6e0c89d660d26379db224d93c40e799489a057bb6dbb
```

This is an executable application-control-flow regression check, not a browser-wallet or funded-public-network test. It does not close the separately documented point-in-time cross-chain race, unexpected actor-change limitation or missing public mission evidence. The original browser and source observations retain their earlier dates and hashes.
