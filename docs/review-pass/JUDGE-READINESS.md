# Review Pass — judge release checklist

Working checklist,12September2026. Owner **Agent** means implementation/verification I can do; **Team** means Razvan/teammate-held access, participation or submission. A checked local test is not a checked public bounty requirement. This is the release plan for the existing `review-pass/product` branch, not a new product pivot.

## Release definition

A judge opens one stable HTTPS URL, understands the product within15seconds, starts a funded review using a prepared test wallet, sees a qualified reviewer accept and deliver an encrypted report, decrypts it as the client and approves an actual Fuji test-USDC payment. The reviewer may be a prepared team counterpart, clearly identified as such. For fully independent reviewer testing, the judge must also receive an explicitly demo-issued qualification and generate their own task/wallet-bound proof without giving secrets to a server.

**Core pitch:** Commission a qualified second review. Keep the report private. Pay after reviewing the delivery. The credential proves current eligibility, not report quality. Public wallet reuse still links work.

## Agent checklist

| ID | Priority | Deliverable | State / acceptance evidence |
|---|---|---|---|
| J01 | P0 | One obvious client/reviewer starting choice and role-specific next action | Implemented in current pass; independent fresh-browser evaluation passed |
| J02 | P0 | Wallet/network/gas/reward/private-report/storage readiness | Implemented;16real Chromium lifecycle checks pass with the new UX |
| J03 | P0 | Reviewer can generate a proof without installing the CLI | Browser-local WASM feasibility probe running; **not yet complete** |
| J04 | P0 | Explicit, repeatable test-qualification provisioning | Still needed; separate issuer and holder roles, test label, no hidden server prover |
| J05 | P0 | Fresh funded tasks available for each judge session | Still needed; never reuse consumed proofs, reset revocation or fake an open state |
| J06 | P0 | End-to-end client → reviewer → client workflow on actual public resources | New UX local lifecycle16/16passed; public deployment pending |
| J07 | P1 | Deadline-aware actions and intelligible funding/delivery/payment stages | Implemented; boundary unit tests pass; contract remains authoritative |
| J08 | P1 | Report settings secondary; mobile role navigation and keyboard access | Implemented; independent390px/keyboard checks pass |
| J09 | P1 | Public ciphertext export and usable success/failure recovery | Disconnected actual download verified; action-specific messages added |
| J10 | P0 | Fuji deployment and canonical test-USDC lifecycle | Preparation verified; blocked on authorized funded project access |
| J11 | P0 | Arkiv public native expiry and two-client WSS evidence | Adapter and read-only WSS verified; funded writes still required |
| J12 | P0 | Public Swarm encrypted-byte upload, independent retrieval and recipient decryption | Adapter/unauthenticated iframe verified; session/postage required |
| J13 | P0 | Stable HTTPS judge URL with the correct app/configuration | Hosting preparation exists; deploy and browser-test after public contracts are available |
| J14 | P0 | Final integrated browser, contract, proof and independent review pass | Run after integration; retain exact source/receipts and distinguish mocks/local/public |
| J15 | P1 | Submission README, schema, feedback, evidence and3minute script | Existing artifacts available; update to final deployed behavior and actual links |
| J16 | P0 | Fresh judge rehearsal on a second device, without agent intervention | Team-assisted check still required; failures must be recorded and fixed |

## Razvan / teammate checklist

| ID | Priority | Team action | What “done” means |
|---|---|---|---|
| T01 | P0 | Configure an authorized Fuji deployment signer | Project configuration available locally without putting private keys in chat/Git; enough test AVAX for verifier, key registry and escrow |
| T02 | P0 | Prepare distinct client and reviewer wallets | Both have Fuji test AVAX; client has canonical Fuji test USDC for several sessions. Share only public addresses for balance checks |
| T03 | P0 | Fund client publication wallet on Arkiv Tiramisu | Same client's wallet has test GLM; wallet chain7738577 configured; faucet challenge completed if needed |
| T04 | P0 | Obtain usable public Swarm postage | Actual sponsor gift/postage instructions and successful Swarm ID sign-in; canUpload must be true, not just connected |
| T05 | P0 | Agree who is the demo issuer and reviewer counterpart | Demo qualification explicitly labelled; ready to issue to holder-local commitments and accept each judge's fresh task |
| T06 | P0 | Provide two real browser/device participants for rehearsal | One client, one reviewer; verify wallet extensions, file custody, encryption, approval and recovery without terminal coaching where possible |
| T07 | P1 | Resolve Arkiv source conflict with sponsor | Confirm operative currency/rules; current sponsor hub/MCP supersedes older gates, but ETHRome page still conflicts. Do not invent sign-off |
| T08 | P0 | Obtain actual ETHRome and Team1 submission links | Official inspected pages still showed TBD for those forms; Arkiv form is linked below |
| T09 | P0 | Record and submit ≤3minute video | No-login access; matches actual deployed code; shows product, complete transaction and sponsor substance |
| T10 | P0 | Submit project and selected bounty forms on time | Team/contact fields, correct bounty checkboxes, honest prior-work declaration, repo/deployment/video links; submit Arkiv and separate Team1 forms too |
| T11 | P0 | Meet event participation and repository obligations | In-person demo/team eligibility, responsive Telegram contact, public repo retained at least4weeks |

Do not buy mainnet assets for this rehearsal or send wallet secrets in chat. All required financial demo activity can use permitted testnet assets. Hosting can use existing project access; it does not substitute for actual public contract/storage resources.

## Bounty acceptance matrix

| Target | Must demonstrate | Current gap |
|---|---|---|
| **Avalanche Team1 Track A** | A useful stablecoin workflow on Fuji: fund → proof acceptance → delivery commitment → payment, finalized receipts and stablecoin balance changes; public source, architecture and in-person demo | Funded deployment and actual public lifecycle. **Issuing a custom stablecoin is not required.** One Team1 track per project. |
| **Arkiv Mission02** | Public entity naturally expires; identical query before/after; useful UI change; no delete used as expiry; escrow remains enforceable | Actual funded entity, creator/key/tx/expiresAt, query/recording evidence |
| **Arkiv Mission03** | Real WSS-driven relevant updates in a second browser, filtering, reconnect reconciliation without interval polling | Actual two-client public writes/recording and network trace |
| **Arkiv Best Use** | Deployed usable app, real reason for Arkiv, execution, feedback and plausible adoption plan | Live mission completion and public judge route; only one Arkiv award per team |
| **Swarm** | Real uploaded bytes, encrypted reports, independent retrieval, onchain digest verification, clear storage purpose; repo/run/code links, demo and one-line next step | Public session/postage and actual roundtrip; two$500winners does not mean one team can claim both |
| **ETHRome overall** | Public source, deployed contract addresses, ≤3minute no-login video, accurate pre-existing-work declaration and selected bounty submissions | Final deployment/video/forms and human participation |

Checked official deadline: **Sunday13September,10:00 Europe/Rome —11:00 Bucharest.** The user did not impose an artificial build-time limit, but the event submission deadline is real.

Sources checked12September: [ETHRome submissions](https://www.ethrome.org/hackermanual/submissions.html), [rules](https://www.ethrome.org/hackermanual/rules.html), [judging](https://www.ethrome.org/hackermanual/judging.html), [prizes](https://www.ethrome.org/hackermanual/prizes.html), [current Arkiv hub](https://hub.arkiv.network/ethrome), [Arkiv form](https://tally.so/r/vGZ98v). The current Tally re-fetch returned403; detailed fields rely on the earlier successful same-day inspection. Current hub-linked MCP explicitly supersedes the old mandatory Saturday conversation/five-gate version. This is a documented source conflict, not a claimed sponsor waiver or conversation.

## Three-minute demonstration

1. **0:00–0:25:** One concrete task: second-review an allowance change. Explain the client/reviewer relationship and the privacy boundary.
2. **0:25–1:05:** Client scopes and funds the review. Show the exact test-USDC amount and actual explorer receipt.
3. **1:05–1:40:** Prepared demo-qualified reviewer generates a fresh proof, accepts and submits a short encrypted report. Explain that credential identity stays local.
4. **1:40–2:20:** Client retrieves from Swarm, decrypts, approves and shows the reviewer’s actual paid state/balance.
5. **2:20–3:00:** Show a second browser receiving the Arkiv update and a short lease disappearing naturally while escrow survives. Point to independent report export and the evidence page.

Keep two-client confidentiality, scoped nullifiers, revocation and dispute/refund adverse cases in an extended evidence recording. A prepared counterpart and pre-funded test wallets are acceptable demo preparation when disclosed; pre-recorded or simulated state must never be presented as a live transaction.
