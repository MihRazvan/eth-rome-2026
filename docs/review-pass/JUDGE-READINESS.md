# Cutout — judge release checklist

Working checklist, 12 September 2026. Owner **Agent** means implementation/verification I can do; **Team** means Razvan/teammate-held access, participation or submission. A checked local test is not a checked public bounty requirement. This is the release plan for the existing `review-pass/product` branch, not a new product pivot.

## Current customer-facing pass

Cutout now has the supplied paper/ink/orange identity, Tasks / Activity / workspace navigation, a task preview, and a cut-open report interaction. Judges can enter a clearly labelled no-wallet guided demo that uses real browser encryption and simulated financial/qualification steps. Live Fuji functionality remains separate. Private device namespaces and earlier contract names are retained for compatibility.

Latest actual local lifecycle:21browserchecks, including approval blocked before opening the report. Public snapshot publication and hosted browser proving are verified; the full public funded review and Arkiv expiry still need execution. The rehearsal wallets are funded. Browser Swarm authentication remains account setup; users never paste technical IDs/signers into Cutout.

## Release definition

A judge opens one stable HTTPS URL, understands the product within 15 seconds, starts a funded review using a prepared test wallet, sees a qualified reviewer accept and deliver an encrypted report, decrypts it as the client and approves an actual Fuji test-USDC payment. The reviewer may be a prepared team counterpart, clearly identified as such. For fully independent reviewer testing, the judge must also receive an explicitly demo-issued qualification and generate their own task/wallet-bound proof without giving secrets to a server.

**Core pitch:** Commission a qualified second review. Keep the report private. Pay after reviewing the delivery. The credential proves current eligibility, not report quality. Public wallet reuse still links work.

## Agent checklist

| ID  | Priority | Deliverable                                                                        | State / acceptance evidence                                                                                                                                                      |
| --- | -------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J01 | P0       | One obvious client/reviewer starting choice and role-specific next action          | Implemented in current pass; independent fresh-browser evaluation passed                                                                                                         |
| J02 | P0       | Wallet/network/gas/reward/private-report/storage readiness                         | Implemented; 20 real Chromium lifecycle checks pass with the new UX and browser prover                                                                                           |
| J03 | P0       | Reviewer can generate a proof without installing the CLI                           | Local acceptance verified; public Fuji verifier accepted a browser proof via read-only synthetic context, not funded public acceptance                                                                         |
| J04 | P0       | Explicit, repeatable test-qualification provisioning                               | [Provisioning checklist](QUALIFICATION-PROVISIONING.md) documents actual CLI and file custody; issuer/holder human participation remains required                                |
| J05 | P0       | Fresh funded tasks available for each judge session                                | Guarded seed helper executed: real 250 qUSD open local task; rerun REUSED with 0 writes; public task funding pending                                                             |
| J06 | P0       | End-to-end client → reviewer → client workflow on actual public resources          | Local lifecycle20/20; public contracts deployed/source verified, snapshot publication and funded public lifecycle pending                                                                                                  |
| J07 | P1       | Deadline-aware actions and intelligible funding/delivery/payment stages            | Implemented; boundary unit tests pass; contract remains authoritative                                                                                                            |
| J08 | P1       | Report settings secondary; mobile role navigation and keyboard access              | Implemented; independent 390px/keyboard checks pass                                                                                                                              |
| J09 | P1       | Public ciphertext export and usable success/failure recovery                       | Disconnected actual download verified; action-specific messages added                                                                                                            |
| J10 | P0       | Fuji deployment and canonical test-USDC lifecycle                                  | Three contracts deployed/finalized/source verified; exact public snapshot publication and actual canonical-USDC lifecycle pending                                                                                |
| J11 | P0       | Arkiv public native expiry and two-client WSS evidence                             | Guarded public runner prepared with two independent software observers; actual funded creation/expiry and browser evidence still required                                                                                                                 |
| J12 | P0       | Public Swarm encrypted-byte upload, independent retrieval and recipient decryption | Public connection-note upload/retrieval verified; encrypted report and recipient decryption on public deployment still pending                                                                                                                |
| J13 | P0       | Stable HTTPS judge URL with the correct app/configuration                          | [Public HTTPS setup screen](https://review-pass-ethrome-2026.vercel.app) deployed/browser-verified; full workspace activates after verified public contract/snapshot publication |
| J14 | P0       | Final integrated browser, contract, proof and independent review pass              | 20 browser checks, 18 contract tests, 57 application tests pass; independent prover review fixes integrated; see [evidence](evidence/judge-pass/README.md)                       |
| J15 | P1       | Submission README, schema, feedback, evidence and 3-minute script                  | Local evidence, provisioning, schema and 3-minute script ready; actual public links/video/forms pending                                                                          |
| J16 | P0       | Fresh judge rehearsal on a second device, without agent intervention               | Team-assisted check still required; failures must be recorded and fixed                                                                                                          |

## Razvan / teammate checklist

| ID  | Priority | Team action                                                | What “done” means                                                                                                                                     |
| --- | -------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01 | P0       | Configure an authorized Fuji deployment signer             | Done: local key matches designated deployer; approximately 4 test AVAX verified; key remains outside Git/Vercel                                         |
| T02 | P0       | Prepare distinct client and reviewer wallets               | Done: client/reviewer each 0.5 test AVAX; client 20 test USDC verified. Use 10 USDC for the first review                                                    |
| T03 | P0       | Fund client publication wallet on Arkiv Tiramisu           | Done: client 0.1 test GLM verified on Tiramisu; receipt succeeded. Actual listing writes remain pending                                                 |
| T04 | P0       | Obtain usable public Swarm postage                         | Done: user Swarm ID upload and independent SHA-256 retrieval verified; reported postage expiry September16. See evidence/swarm-public/README.md                                  |
| T05 | P0       | Agree who is the demo issuer and reviewer counterpart      | Operator demo issuer/class7 rehearsal credential prepared privately; no external accreditation or independent participant claim                                 |
| T06 | P0       | Provide two real browser/device participants for rehearsal | One client, one reviewer; verify wallet extensions, file custody, encryption, approval and recovery without terminal coaching where possible          |
| T07 | P1       | Resolve Arkiv source conflict with sponsor                 | Confirm operative currency/rules; current sponsor hub/MCP supersedes older gates, but ETHRome page still conflicts. Do not invent sign-off            |
| T08 | P0       | Obtain actual ETHRome and Team1 submission links           | Official inspected pages still showed TBD for those forms; Arkiv form is linked below                                                                 |
| T09 | P0       | Record and submit ≤3-minute video                          | No-login access; matches actual deployed code; shows product, complete transaction and sponsor substance                                              |
| T10 | P0       | Submit project and selected bounty forms on time           | Team/contact fields, correct bounty checkboxes, honest prior-work declaration, repo/deployment/video links; submit Arkiv and separate Team1 forms too |
| T11 | P0       | Meet event participation and repository obligations        | In-person demo/team eligibility, responsive Telegram contact, public repo retained at least 4 weeks                                                   |

Do not buy mainnet assets for this rehearsal or send wallet secrets in chat. All required financial demo activity can use permitted testnet assets. Hosting can use existing project access; it does not substitute for actual public contract/storage resources.

## Bounty acceptance matrix

| Target                      | Must demonstrate                                                                                                                                                                                 | Current gap                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Avalanche Team1 Track A** | A useful stablecoin workflow on Fuji: fund → proof acceptance → delivery commitment → payment, finalized receipts and stablecoin balance changes; public source, architecture and in-person demo | Funded deployment and actual public lifecycle. **Issuing a custom stablecoin is not required.** One Team1 track per project. |
| **Arkiv Mission02**         | Public entity naturally expires; identical query before/after; useful UI change; no delete used as expiry; escrow remains enforceable                                                            | Actual funded entity, creator/key/tx/expiresAt, query/recording evidence                                                     |
| **Arkiv Mission03**         | Real WSS-driven relevant updates in a second browser, filtering, reconnect reconciliation without interval polling                                                                               | Actual two-client public writes/recording and network trace                                                                  |
| **Arkiv Best Use**          | Deployed usable app, real reason for Arkiv, execution, feedback and plausible adoption plan                                                                                                      | Live mission completion and public judge route; only one Arkiv award per team                                                |
| **Swarm**                   | Real uploaded bytes, encrypted reports, independent retrieval, onchain digest verification, clear storage purpose; repo/run/code links, demo and one-line next step                              | Public session/postage and actual roundtrip; two $500 winners does not mean one team can claim both                          |
| **ETHRome overall**         | Public source, deployed contract addresses, ≤3-minute no-login video, accurate pre-existing-work declaration and selected bounty submissions                                                     | Final deployment/video/forms and human participation                                                                         |

Checked official deadline: **Sunday 13 September, 10:00 Europe/Rome — 11:00 Bucharest.** The user did not impose an artificial build-time limit, but the event submission deadline is real.

Sources checked 12 September: [ETHRome submissions](https://www.ethrome.org/hackermanual/submissions.html), [rules](https://www.ethrome.org/hackermanual/rules.html), [judging](https://www.ethrome.org/hackermanual/judging.html), [prizes](https://www.ethrome.org/hackermanual/prizes.html), [current Arkiv hub](https://hub.arkiv.network/ethrome), [Arkiv form](https://tally.so/r/vGZ98v). The current Tally re-fetch returned 403; detailed fields rely on the earlier successful same-day inspection. Current hub-linked MCP explicitly supersedes the old mandatory Saturday conversation/five-gate version. This is a documented source conflict, not a claimed sponsor waiver or conversation.

## Three-minute demonstration

1. **0:00–0:25:** One concrete task: second-review an allowance change. Explain the client/reviewer relationship and the privacy boundary.
2. **0:25–1:05:** Client scopes and funds the review. Show the exact test-USDC amount and actual explorer receipt.
3. **1:05–1:40:** Prepared demo-qualified reviewer generates a fresh proof, accepts and submits a short encrypted report. Explain that credential identity stays local.
4. **1:40–2:20:** Client retrieves from Swarm, decrypts, approves and shows the reviewer’s actual paid state/balance.
5. **2:20–3:00:** Show a second browser receiving the Arkiv update and a short lease disappearing naturally while escrow survives. Point to independent report export and the evidence page.

Keep two-client confidentiality, scoped nullifiers, revocation and dispute/refund adverse cases in an extended evidence recording. A prepared counterpart and pre-funded test wallets are acceptable demo preparation when disclosed; pre-recorded or simulated state must never be presented as a live transaction.
