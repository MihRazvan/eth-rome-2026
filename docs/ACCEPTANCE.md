# Cutout submission documentation — verified

Submission-facing README now follows the layered structure of the team's Anyware/Autark repos: product brief, quickstart, user flow, architecture, security boundaries, deployed contracts, individual sponsor pages and evidence index. Current entrypoint is [docs index](README.md); EXIT's earlier README remains in [history](history/EXIT.md). Original code, handoff and licenses are preserved. No application deployment changed.

125 focused Node tests passed; one optional external test skipped. 18 contract tests, explicit pilot TypeScript and UI build passed. Bare Vite desktop/mobile walkthrough and four actual public hosted browser checks passed with zero page errors/writes. Independent read-only documentation review corrected setup prerequisites and scoped evidence claims. [Artifacts](cutout/evidence/submission-prep/README.md). Fresh Docker bootstrap and full public paid flow were not run. Arkiv mission recordings, final paid receipts, video/slides and actual submissions remain listed in [the submission checklist](cutout/BOUNTIES.md).

---

# Reviewer wallet role recovery — deployed

12 September2026: source5530ce8, production `dpl_9KwmtoqwTKQxUWNevCFThysqxuu8`. Reviewer view no longer replaces proof setup with client publication when the wallet returns the funding account. It displays an explicit mismatch and lets the user request account selection, or reconnect after selecting manually. Same-account selection remains a mismatch; only Client view offers publication. Account permissions do not request signing/spending or revoke existing access.

26wallet-network tests, TS/build pass. Six actual production Chromium checks against public funded task3 pass using a synthetic wallet: wrong account, preserved client functionality, cancellation, unchanged account, different account/events/reconnect and native file picker. Zero page errors and no transactions/signatures. [Evidence](design/cutout/evidence/wallet-role/README.md). This does not verify the teammate's actual extension account selection or complete public payment.

---

# Presenter explanation and current-state reconciliation

12 September2026: rewrote the teammate cue sheet and added [full presenter guide](CUTOUT-PRESENTER-GUIDE.md), covering each action, file provenance, issuer trust, private/public data, solo demo and sponsor-specific Q&A/source pointers. Independent read-only source review found no material inaccuracies; approval-button wording was clarified. All new local documentation links resolve. No app/deployment or financial action in this documentation pass.

Fresh finalized read at18:06UTC/block58335866 observed task1 Refunded, task2 Open with expired acceptance window, task3 Open/unassigned. No accepted/paid task was observed. [Public state evidence](design/cutout/evidence/presenter/public-state.json). Sponsor submission index now reflects deployed integrations while preserving outstanding public paid/expiry/two-browser evidence gates. Team1 official Builder Hub submission was located; no form submitted.

---

# Proof-file handoff and teammate credential — deployed

12 September2026, source83e18e0, Vercel `dpl_2iAmKhZoyKhugVtbKJa6jfieVNKc`. Issued the teammate's test credential from their provided public enrollment request; no holder secret received. Private download link delivered; credential expiry2026-09-13T17:58:21Z. Their own holder/proof still requires their browser.

The proof form now explains both file sources, rejects enrollment requests/swapped/mismatched/expired files locally and provides an enabled-when-ready wallet reconnect action for disabled inputs. Six targeted tests, TypeScript/build pass. Actual production Chromium native chooser and operator-held credential/holder generated a proof accepted by funded task#3's Fuji acceptance simulation, with zero page errors and no signatures or transactions. [Evidence](design/cutout/evidence/proof-file-selection/README.md). Full paid lifecycle remains unverified.

---

# Wallet/publication recovery and browser enrollment — deployed

12 September2026, source `0c690d2` (application change `42b0993`), production `dpl_7AuDuD9WAAXcgnmbqiAk2VGs6y3B`. Connected-wallet header repaired; Arkiv unknown-network handling and actionable error reporting added; default discovery lease up to900blocks, automatically shortened to the remaining acceptance window. Actual task#1 was funded by the user but had no Arkiv listing and zero creator gas at17:08UTC. A0.01testGLM top-up is confirmed; creator publication signature remains required.

Real browser holder creation/downloads and public enrollment request now work in the hosted app. A fresh operator test request was signed by the existing deployed issuer; the resulting actual hosted browser proof passed Fuji verifier eth_call and rejected an altered recipient. No external reviewer assessment, automatic issuance, escrow acceptance or payment is implied.46targeted tests and TypeScript/build pass; actual production desktop/mobile enrollment and guided walkthrough pass. [Evidence and precise boundaries](design/cutout/evidence/enrollment-publication/README.md).

---

# Account-free document storage — deployed

12 September 2026: Cutout now uses gateway-funded public Swarm uploads by default, with no end-user storage account or drive. Source `6e923a6`, Vercel `dpl_BaPyTpRQXJupsZy7wTrKXTQbadv4`. Actual isolated-browser encrypted upload/retrieval, both recipients, reload and outsider rejection passed; production desktop/mobile checks passed. [Evidence and exact scope](design/cutout/evidence/account-free-storage/README.md).

Swarm session authentication is **no longer a blocker**. The gateway funds postage; this does not consume the user's gift drive and has no promised retention period. The full paid public lifecycle and native Arkiv expiry remain unrun in this change. The older session-blocked entries below are historical, not current prerequisites.

---

# Technical follow-up before teammate manual review

12 September 2026: deployed Arkiv recovery and client-visible listing receipts, source dfa6054. 16 listing and 26 journey/settlement/storage tests passed; 1 optional external browser test skipped; targeted TypeScript/build pass. Actual isolated Chromium with public WSS recovered deliberate initial failure and established disconnect. No public write/expiry/payment is claimed by those fault-injected tests. Current deployment and production browser observation: [follow-up evidence](design/cutout/evidence/release-followup/README.md). [Teammate's short checklist](CUTOUT-MANUAL-TEST.md).

Wallets are funded and the public snapshot returns HTTP 200. Neither isolated Swarm role session was ready for uploads at the latest check; finalized nextJob was 0. Full public paid lifecycle/native expiry remains pending authenticated storage. Earlier evidence remains below with its original scope.

---

# Cutout — current design pass

12 September 2026. Cutout is the new user-approved identity for Review Pass; previous EXIT ledgers below are historical.

- Actual isolated local browser lifecycle: **21 checks passed**, including local browser-generated proof, two recipient-isolated encrypted reports/payments, reload/rotation/revocation and approval disabled before decryption. `.runtime/cutout-browser/evidence`; fresh contracts on existing local Anvil, no public transaction claimed.
- Targeted app/read-API/storage checks: **22 passed, one optional external browser check skipped**. Explicit pilot TypeScript and active public bundle build pass.
- Cutout uses the supplied paper/ink/orange references, locally hosted licensed fonts, role/navigation/task preview and official in-flow Swarm ID control. Brand changes preserve all cryptographic namespaces and deployed contracts.
- Guided demo is deliberately labelled a simulation: real browser AES-GCM, simulated qualification/funding/payment. It does not count toward live sponsor requirements.
- Public snapshot and hosted proving are verified; funded Fuji lifecycle and Arkiv creation/native expiry are still pending. Funded wallets are available; isolated Swarm login sessions were pending when the user changed focus to design.

Production Cutout is deployed at https://cutout-ethrome-2026.vercel.app from sourcec90eae1 (role/visibility/CSP follow-ups to9b8db9e). Actual production Chromium verifies desktop/mobile navigation, walkthrough encryption/decryption, keyboard and offline fallback; zero exceptions and storage writes. [Hosted evidence](design/cutout/evidence/hosted/browser.json), [build/deployment](design/cutout/evidence/deployment.json), and [21-check local lifecycle](design/cutout/evidence/local-lifecycle/browser.json). Earlier ledger entries retain their original scope/date.

---

> **Current Review Pass judge pass:** [shared release checklist](review-pass/JUDGE-READINESS.md), [20-check browser evidence](review-pass/evidence/judge-pass/README.md), [qualification provisioning](review-pass/QUALIFICATION-PROVISIONING.md). Browser-local proving and the complete local payment flow are verified; public bounty writes and a second-device judge rehearsal remain pending. The EXIT ledger below is historical.

# Current Review Pass acceptance

Current product-branch outcomes and limits are tracked in [Review Pass BUILD.md](review-pass/BUILD.md) and [public evidence](review-pass/evidence/README.md). The EXIT ledger below is preserved historical scope.

---

# Acceptance ledger

Last integrated local verification: 2026-09-11. A passing local result does not discharge a public network requirement.

| ID       | Outcome                                                                    | Owner                             | State                                                                            | Actual verification / blocker                                                                                                                                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Exact seller net, maker debit, fees and rollback                           | protocol + independent reviewer   | verified local                                                                   | `forge test`: exact/fuzz/fee/fee-alias/underfunded-fee/fee-token cases; browser checks exact seller balance                                                                                                                                                                                                             |
| P2       | No prior-owner authority or arbitrary execution                            | protocol + reviewer               | verified local/fork                                                              | Former-owner and outsider attacks; bounded account fork cancellation/recovery; no operators/delegatecall                                                                                                                                                                                                                |
| P3       | Exact residual bundle and stale rejection                                  | protocol + integrator             | verified local                                                                   | Cash collection preserves bundle; withdrawal depletes; browser partial4000 → stale → resale5985; dust harmless                                                                                                                                                                                                          |
| P4       | Domain/party/source/price replay boundaries, seller consent                | protocol + reviewer               | verified local                                                                   | All-field mutation, cross-market/chain, nonce consumption/cancel, ERC1271 execution-time checks; epoch request binding fixed independently                                                                                                                                                                              |
| P5       | Independent maker funds, no implicit reservation                           | protocol + integrator             | verified local                                                                   | Distinct wallets/balances/allowances, insufficient balance fails, maker runner replenishes only its own valueless test currency                                                                                                                                                                                         |
| P6       | Callback safety across market/vault                                        | protocol + reviewer               | verified admitted boundary                                                       | Malicious token callback regression; immutable exact-transfer TestUSDC is the enabled payment token. Unsupported-token results are not universal admission                                                                                                                                                              |
| P7       | Current owner retains cash and recovery rights                             | protocol + reviewer               | verified local/fork                                                              | Recovery before/after standard exhaustion, balance conservation, fork returned shares. Persistent ownership record                                                                                                                                                                                                      |
| LIFE     | Normal and adverse economics                                               | integrator                        | verified local; Fuji blocked                                                     | `npm run scenario`, local-lifecycle.json; normal25/15, adverse25/-285. Actual browser residual lifecycle independently reads chain                                                                                                                                                                                      |
| PRIVATE  | Client HPKE, wallet key binding, registry, request/epoch, reload/isolation | transport + reviewer + integrator | verified local after boundary correction                                         | Actual private approval calldata uses fixed 100,000 capital limit rather than bid; custom price 9987.123456 remains encrypted in upload/index; session-race, key substitution/retry and reload/outsider tests; public settlement. Baseline b36fbf1 confidentiality conclusion superseded; see research-integration.json |
| RECOVERY | Replacement/cancellation/wrong-account and degraded reads                  | integrator + reviewer             | verified local                                                                   | 15 controller/boundary tests; stale wallet refresh cannot publish; failed discovery preserves onchain claims/collection; certificate retry; replacement/cancellation checks. Eight HTTP/queue tests prevent incomplete-body mutation blocking                                                                           |
| ARKIV    | Real discovery and native expiry                                           | transport                         | read verified; write/expiry blocked                                              | SDK0.8.1 real Tiramisu compound query returned0; native expiry probe implemented but no funded signer supplied. Identical query/no cleanup required                                                                                                                                                                     |
| SWARM    | Actual upload and independent retrieval verification                       | transport                         | implemented; live upload blocked                                                 | Gateway HTTP200; byte transport+independent verifier and integrity tests; no supplied funded postage/upload endpoint                                                                                                                                                                                                    |
| SOURCE   | Pinned BENQI implementation, origination/collection/recovery               | integrator + reviewer             | fork verified                                                                    | Three tests at95031281, implementation+codehash pin. Redemption explicitly simulates future operator publication with1wei; source prototype not an enabled market                                                                                                                                                       |
| UI       | Original full market/trade/portfolio/detail                                | design + independent evaluator    | verified local                                                                   | Three rendered directions, receipt selected; 10 integrated browser checks; widths 320/390/1024/1440 across checks, reload/history, accessible dialog focus, confidential state clearing; seller comparison and buyer scenarios with 16 arithmetic tests                                                                 |
| DEMO     | Fresh visitor backed origination and funded makers                         | integrator                        | verified local; public Fuji blocked                                              | `npm run start:local`, visible funding/create/request paths; timed blocks and a real one-minute browser wait verify idle payout maturity; standalone public funding/hosting requires missing network access                                                                                                             |
| RELEASE  | CI, runnable commands, licenses, evidence and submissions                  | integrator                        | local gates and implementation CI passed; preview refreshed; human steps pending | Integrated c8ce819 passed 55 JS, 39 reported Solidity and 10 Chromium tests; research-integration.json. Exact pushed CI and hosting status in CONTINUATION.md. Human forms/conversation/attendance/camera not done                                                                                                      |

## Viability reassessment — September 11

The latest user instruction authorizes a commercial direction change, recorded in [decision 002](decisions/002-viability-pivot.md). The first candidate is an embedded service for existing Lido/standard ether.fi NFTs on Ethereum. This does not discharge Avalanche/sponsor requirements or admit these sources into the test-vault market.

| Outcome | State | Evidence |
| --- | --- | --- |
| Existing-claim mechanics | Sampled fork eligibility verified | Four Ethereum tests at25956536, no storage caching, pending transfer/resale and already-finalized full collection to current owner; no operator/time/balance overrides |
| Native Exit Check | Read-only implemented and browser verified | Actual mainnet owner/state reads; one-block observations; implementation drift and unavailable reads explicit; finalized amount does not certify payout execution |
| Pricing instrument | Arithmetic verified; inputs unvalidated | Eight new economic tests, eight inspector tests, independent 2,211 fee / 48 budget cases; no fabricated bid, buyer capital or seller floor |
| Commercial viability | Unverified, conditional pilot | Cheap observed BENQI routes weaken original premise; pending ETH claim stock is not customer demand; no independent holder acceptance, funded maker commitment or distribution agreement |
| Integrated release | Local checks passed | 71 JS tests, 39 reported Solidity, 7 source forks and 15 Chromium scenarios; five checker scenarios use explicit RPC mocks, separate browser observations use actual public RPC |

See [viability assessment](viability/README.md), [pilot worksheet](viability/PILOT.md), [independent review](viability/economics-review.md) and [release evidence](evidence/viability-integration.json). Source NFTs collect/burn whole; partial residual behavior belongs to the disclosed test vault. Current code/CI/hosting revisions are in [restart handoff](CONTINUATION.md).

## Evidence interpretation

Solidity integrated report 39 includes 16 inherited reviewer-harness repetitions; meaningful newly authored reviewer cases 5. Two invariant campaigns each 128×64 successful calls, zero reverts. The earlier research baseline had 55 JS tests including exact amount ranking, 16 economics cases, 15 controller/session cases, 9 privacy cases, 8 HTTP/queue cases and 6 preflight cases. Browser tests assert visible behavior and independent ownership/balance state; production screenshots are reviewed separately from fixture concept images. Latest command results and exact commit status belong in CONTINUATION.md.

Missing requirements are retained, not downgraded: Fuji deployment/public lifecycle, Arkiv publication/native expiry, live Swarm upload/independent round-trip, and human bounty steps. No fixture fallback is used for any failed live service.

The research pass reproduced approval side-channel and cross-wallet plaintext defects in the earlier baseline. Those historical checks remain preserved with explicit scope corrections; current evidence includes their fixes and independent reproductions. See [research](research/README.md), [integrated results](evidence/research-integration.json) and [human test guide](USER-TEST.md).


## Review Pass public Swarm connection — September 12

User uploaded a generated non-sensitive connection note through Review Pass on Vercel using sponsor-funded Swarm ID. The first independent read failed because the configured gateway website returned HTML200. Corrected the retrieval API origin and CSP, preserving SHA-256 verification. The application adapter and fresh Chromium at the production origin now retrieve the actual142bytes with the exact expected digest. This verifies public storage connectivity only; encrypted reports, issuer snapshot publication and the Fuji lifecycle remain pending.19storage/read-API tests passed,1optional live test skipped; TypeScript, public build and hosted setup browser checks passed. [Durable evidence](review-pass/evidence/swarm-public/README.md).


## Review Pass public contract rollout — September12

Clean sourcea9d0181 deployed the verifier, wallet-owned encryption-key registry and canonical-Fuji-USDC escrow, with three finalized success receipts and post-deployment authority/code checks. All three have exact runtime source verification on Sourcify. The issuer root and arbitrator are controlled by the disclosed team deployer. Separate agent rehearsal client/reviewer wallets each received0.05testAVAX; testUSDC/ArkivGLM transfer remains required. [Deployment, source and funding evidence](review-pass/evidence/fuji-rollout/README.md).

Chromium generated a real qualification proof with the matching experimental public setup; an eth_call to the deployed Fuji verifier accepted it and rejected an altered recipient. This used a synthetic unfunded context and sent0transactions; it is not funded escrow acceptance. [Replayable crypto evidence](review-pass/evidence/fuji-crypto-probe/README.md).

Hosted publisher now exposes only a reviewed public whole-snapshot upload, exact hash checks and independent retrieval. The user must perform its explicit click from the connected Swarm ID session. Public metadata static hashes, capability gating, real iframe initialization and390px layout were verified in Chromium.6publisher tests,19storage/read-API tests,18contract tests, TypeScript and pending build pass;1optional network test skipped. Active build/finalizer actually reject absent/wrong snapshot references without modifying deployment. The funded UI remains disabled; public payment/report/Arkiv lifecycle is not yet complete. The guarded Arkiv runner is prepared, with source/readonly checks only.
