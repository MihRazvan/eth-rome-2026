# Runtime integration review — EXIT

Independent read-only review, 11 September 2026. Scope: `packages/runtime/{server,services,chain}.ts`, `packages/client/controller.ts`, `scripts/deploy.ts`, `scripts/start-local.mjs`, and the design worktree's model/App only where needed to inspect their shared boundary. These runtime files were uncommitted and being integrated during review; this is a recorded review of observed source and targeted executable probes, not a deployed-app audit. No real credentials were displayed, no real sponsor resources were spent, and no runtime files were edited by the reviewer.

All findings were sent to the integrator promptly. The table below distinguishes an observed correction from an independently executed regression check. A final integrated browser evaluation and actual sponsor evidence remain separate gates.

## Findings and disposition

| ID / priority | Concrete finding | Observed impact and closure evidence |
| --- | --- | --- |
| RT1 / release blocker | Controller exported `Offer.deadline = Number(q.deadline)` in Unix seconds, while App compared it with `Date.now()` in milliseconds. | Every real fresh offer was treated as expired and its sale button disabled. A 300-second-future adapter timestamp still satisfied `deadline <= Date.now()` in the executable probe. Convert only the display adapter timestamp to milliseconds; retain bigint seconds for contract checks. Integrator now multiplies the adapter deadline by 1,000. Source correction inspected; final rendered sale still requires browser verification. |
| RT2 / medium | `transaction()` treated every successful replacement receipt as completion of the requested action. | A successful wallet cancellation returned `status: replaced, message: Confirmed onchain`, despite not calling EXIT. Reproduced against the actual imported controller with a stubbed provider. Integrator added cancellation rejection and comparison of replacement destination/calldata/value; independently reprobed cancellation rejection, changed-target rejection and identical repricing success. Controller correction verified. |
| RT3 / medium | A successful receipt was followed by `await refresh()`; a discovery/storage failure could discard the successful result and make the action appear failed. | Controller now preserves the receipt when refresh fails; independently verified with a throwing refresh stub. App's separate `run()` also called `actions.refresh()` after showing the result and caught that failure as an action error, so the UI layer needs equivalent handling. It also only closed the sale modal for `confirmed`, excluding successful `replaced`. Controller correction verified. Final root App source also removes its redundant post-result refresh and closes the modal for both confirmed and successfully replaced results; this UI correction was inspected, not browser-tested by this reviewer. |
| RT4 / medium | Full deployment objects exposed `rpcUrl` via `/api/config`; deployment initially persisted raw `EXIT_RPC_URL` into the Fuji manifest. Server errors additionally returned raw SDK `e.message`. | A credential-bearing provider URL could be exposed to visitors or committed. Integrator separated fixed public manifest URLs from private backend transport URLs. However raw Viem HTTP errors contain the full private URL: an offline fetch probe using `https://rpc.invalid/REVIEW_FAKE_TOKEN` confirmed the marker appears in `error.message`. Use a public configuration allowlist and safe application errors; never return or log raw provider exceptions with URLs. Server now returns only its own `RequestError` messages or a fixed generic failure, and generated manifests use a fixed public URL. Source corrections inspected. Hand-edited path-token URLs must still be treated as secrets; basic/query URL rejection does not detect every credential-bearing URL. |
| RT5 / medium | Local startup inherited `EXIT_RPC_URL` and `EXIT_DEPLOYMENT`, and removed shared `.runtime/bindings`. | With Fuji configuration exported, local startup could select the Fuji API manifest or erase Fuji key certificates. Integrator introduced explicit local environment overrides and `.runtime/local` vs `.runtime/fuji` data directories. Source correction inspected; no destructive startup experiment was performed. |
| RT6 / medium, privacy acceptance | Independent maker `makeOffer()` only supported public publication. Private team offers used publicly known deterministic 99.00/99.40/99.60% multipliers over a public residual. | Ciphertext hides bytes, but outsiders can derive all scripted prices. A confidentiality demonstration must disclose this limitation and provide independently chosen private offers encrypted in the maker client. Encryption still protects signatures and payload from direct storage reads. Integrator added a private maker mode: the browser encrypts its independently entered quote, and `/api/publish-envelope` uploads an allowlisted envelope containing ciphertext/routing only. This source correction was inspected. Scripted team pricing remains inferable and needs explicit disclosure; no live/browser private publication was executed by this reviewer. |
| RT7 / medium, hosted availability | `/api/request-offers` and `/api/publish-offer` spent the server's Arkiv gas and Swarm postage without authentication, throttling, reuse or a budget. | Repeated anonymous requests for an existing claim can repeatedly publish three records. This is a concrete resource-exhaustion path once hosted with funded publisher credentials; no live resource attack was executed. Require bounded publication, duplicate reuse and/or per-request rate/budget limits before exposing a funded public service. Integrator added a process-local 100-publication/hour ceiling and request-offer cooldown for Fuji. Bounded cost correction inspected; anonymous callers can still consume the shared allowance, and restarting the process resets it. Hosted abuse resistance is not established. |
| RT8 / low, evidence accuracy | Arkiv/Swarm badges were set to `connected` solely from configured transport environment strings. | With zero claims, refresh performs no sponsor round-trip but marks both connected. Integrator now gates Arkiv connected status on a discovery read and Swarm connected status on independently verified retrieved bytes. Source correction inspected; retrieval evidence still does not prove current postage-funded upload capability. |
| RT9 / low, deployment recovery | The two seed-origination receipts were awaited without inspecting status, then included in a successful deployment manifest. | A reverted seed transaction could still produce a manifest presented as seeded. Also preflight distinct maker addresses and funded gas before deployment so accidentally duplicated keys do not masquerade as independent funded makers. Integrator added four-distinct-account/gas preflight and receipt success checks for both seeded originations. Source correction inspected; no fresh Fuji deployment was executed by this reviewer. |
| RT10 / low, key-loss recovery | `refresh()` loaded IndexedDB keys outside the per-offer authentication catch. | If browser key storage is blocked, any owned claim with private records could abort all refresh, including public data. Integrator now catches key-loading failures per record. Independent controller probe with a throwing key store completed refresh with one claim and one encrypted/unavailable offer. Correction verified at the controller boundary. |
| RT11 / low, economic display | Controller's `Claim.expected` already included cash, while Receipt used `total = expected + collected`. | With 6,000 pending and 4,000 recognized cash, total rights are 10,000; the widget computed 14,000 and 71% remaining. Root Receipt now compares cumulative withdrawn value with expected remaining rights, rather than adding recognized cash twice. Source correction inspected; rendered economics remain part of browser evaluation. |

## Targeted execution evidence

The reviewer imported `ExitController` through the installed `tsx` loader. Only its chain client, wallet response and refresh were replaced with local stubs. These probes test controller branching; they are not browser-wallet or live-chain evidence.

Original cancellation result:

```json
{"status":"replaced","hash":"0x2222222222222222222222222222222222222222222222222222222222222222","message":"Confirmed onchain"}
```

After the integrator's controller correction, the same boundary was exercised in four cases:

```text
cancelled       REJECTED: Transaction was cancelled in the wallet. The requested action did not complete.
changed target  REJECTED: Wallet replacement changed the requested action; inspect chain state.
repriced        status=replaced, message=Confirmed onchain, replacement hash retained
refresh failure status=confirmed, message=Confirmed onchain, successful hash retained
```

The pinned installed Viem implementation (`node_modules/viem/actions/public/waitForTransactionReceipt.ts`) explicitly classifies same destination/value/input as `repriced`, self-transfer zero value as `cancelled`, and other nonce replacements as `replaced`, then resolves with the replacement receipt. Therefore successful receipt status alone cannot authenticate the originally requested action.

Provider-error probe used no network and no real token:

```ts
const client = createPublicClient({ transport: http(
  'https://rpc.invalid/REVIEW_FAKE_TOKEN',
  { retryCount: 0, fetchFn: async () => { throw new Error('test offline'); } },
) });
try { await client.getBlock(); }
catch (error) {
  // Actual result: true. Returning this message would expose a real token in the URL.
  console.log(error.message.includes('REVIEW_FAKE_TOKEN'));
}
```

## Boundaries that held in the inspected source

- Server derives seller, ownership epoch and request identifier from current market state; a request body does not supply authoritative owner/context.
- Quote codec binds signed ownership epoch to the canonical request identifier after the earlier independent-review correction.
- Server custody is limited to explicitly configured team maker signers; browser encryption private keys are generated separately and remain nonextractable IndexedDB keys. The reviewed browser does not send these private keys to the API.
- Stored private bytes pass application encryption before upload. Retrieval checks the stored digest and then authenticates decrypted maker terms. Failed private operations do not invoke a plaintext fallback.
- Local storage is explicitly labelled a local adapter, not a failed-live fallback. The manifest loader now restricts environment/chain pairs to local/31337 and Fuji/43113 and validates contract addresses.
- `ready()` checks wallet chain and current authorized account immediately before a transaction. This prevents a stored UI address from silently authorizing a different account's transaction. Account/network UI event recovery still needs actual browser evaluation.

This report records open integration requirements, not permission to present the system as complete. Close each remaining item against the final integrated source and record browser, chain and sponsor evidence independently.

## Corrected-source snapshot

SHA-256 values captured after the targeted correction pass (source was still uncommitted):

```text
197060c98378f832a3371e71352c2b1ee3b1e290add5bb2b6274600fb35ae8f5  packages/runtime/server.ts
1e00a208f8c32b5017f4045e7c5e630d083f0e1592d9df474c3e1a0464fa6784  packages/runtime/services.ts
9191002aa6ff0afda78afe31cad6c9b5e3d0021d69c48e49c58daefbb574718d  packages/runtime/chain.ts
04d7d6cacac53525d0eeede3c833f40174e0c61ca8bbcbd61833d0b20d420036  packages/client/controller.ts
76223d410518ca40a61f1b25a05093589bcb54a72093a1ada9aacb807d86211d  scripts/deploy.ts
4d22318d3811f9347911aba6ddbbe44866ff2aed8339a0dcb1ecb66dafbb6f39  scripts/start-local.mjs
4fd9815aa66fe81e0dedb7b409366f2cba5ab941c90c2af71fe3952cad9713c1  apps/web/src/App.tsx
```
