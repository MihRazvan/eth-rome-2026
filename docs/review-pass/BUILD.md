# Review Pass product build

Branch `review-pass/product`, starting from `4f0cc87b405b8522f59e4c14d87ea546e77a4858`. This is the user-authorized continuation of Review Pass, after its local wallet pilot. Preserve EXIT/REPRISE and all real history. Research precedes product integration; research findings and executable probes drive the interfaces below.

## Product boundary

An assessment collective's reviewers can accept funded technical-review assignments from multiple clients. The client specifies a **public, non-sensitive scope**, reward, acceptance window, submission deadline and review deadline. Confidential output is encrypted for the assigned reviewer and client. No private input repository access, secret-distribution capability or real assessor/customer adoption is implied. A public brief and a confidential report are different artifacts and must be labeled accurately.

The issuer signs qualifications. The holder retains its credential/secret and proves locally. A proof binds current issuer status, class, expiry, job and payout recipient; it does not certify work quality. Client approval, timeout and explicit dispute resolution determine payment. The existing tested circuit and escrow relation stay stable unless a specific finding requires change.

## Decisions from current evidence

1. **Payment:** canonical Circle Fuji test USDC,6decimals, for public Track A. The checked brief requires a stablecoin product, not issuing a currency. No unnecessary wrapped token or purported fiat reserves. Keep the freely minted local qUSD clearly local; configure a distinct public asset policy. Wait for Fuji finalized state before a confirmed settlement claim.
2. **Discovery:** Arkiv is the public opportunity read path. A listing is a renewable discovery lease, separate from the escrow's financial deadline. A natively expired listing disappears while its escrow remains independently enforceable. Use lowercase indexed names, typed compound filters, complete pagination and authoritative onchain checks. A real WSS stream drives listing changes and block-boundary rechecks; no polling or historical start block disguised as Live Wire.
3. **Documents:** Swarm stores public scope manifests, whole issuer snapshots and encrypted reports. Swarm ID is a browser-only optional public uploader; existing HPKE binds recipients/context, with ordinary references and native encrypt:false. Authentication/canUpload is checked explicitly; no public fixture fallback. Local Bee remains an explicitly local test path.
4. **Terms:** the funding transaction must commit the exact scope document's digest and reference. Reviewers verify the retrieved bytes and the economic fields before accepting. A client cannot silently edit an already funded task. Metadata availability is not work-quality verification.
5. **Privacy:** neither listings nor status requests include holder/credential identifiers. Public task scope, issuer/class, payment wallets and recipient metadata remain visible. Expiry and key revocation do not erase downloaded information. Swarm ID identity keys do not replace wallet-bound document encryption keys.
6. **Research artifacts:** repository Markdown reports, source inventories and minimal reproducible probes form the shareable comprehensive report. Conflicting sponsor pages remain explicitly conflicting; meet compatible deliverables without inventing sign-offs or migration history.

## Integration ownership

Root owns contracts, frontend/server, shared schemas/config/dependency pins, public deployment preparation, acceptance integration, browser evaluation and pushes. Arkiv researcher owns `docs/review-pass/arkiv/`; Avalanche researcher owns `docs/review-pass/avalanche/`; product/Swarm researcher owns `docs/review-pass/product-swarm/`. Research writers use separate worktrees at the shared base. Implementation ownership and its new shared base will be assigned after the report integration.

## Acceptance ledger

| ID | Outcome | Verified state (September12) |
|---|---|---|
| RP-01 | Current rules, contradictions, source/code versions and required evidence audited | Complete: three primary-source reports, versioned probes, form inspection and conflicts |
| RP-02 | Client specifies real task/reward/deadlines; exact public scope committed at funding and verified by reviewer | Implemented; real two-client local funding and canonical scope verification pass |
| RP-03 | Canonical Fuji test USDC policy and finalized transaction/state verification | Canonical asset policy + finalized wait tested; public preparation compiles; funded deployment unavailable |
| RP-04 | Queryable Arkiv opportunity board, authentic publisher/escrow validation, native lease expiry | Adapter/UI integrated,12deterministic tests pass; actual native public expiry awaits funds |
| RP-05 | True WSS updates and reconnect reconciliation without interval polling | Actual public WSS and forced reconnect observed; public two-client write/UI sequence unrun |
| RP-06 | Swarm ID capability-gated browser upload, independent retrieval and existing HPKE privacy | Adapter integrated;11tests including actual unauthenticated iframe pass; public upload session/postage unavailable |
| RP-07 | Full local reviewer/two-client lifecycle, adverse cases, independent review and actual browser inspection |16real Chromium checks,18contract tests,54default pilot tests +1opt-in network test; independent terms/UI/Swarm/deployer reviews |
| RP-08 | Deployable configuration, sponsor schema/feedback/evidence index, actual public receipts and hosted demo | Runbook, schema, feedback, evidence index and Fuji prepare implemented; hosted demo/public receipts/forms pending |

## Runtime and capability inventory

macOS local checkout; Node24.12.0, systemGo1.25.6 (module automatically selects1.25.7), Foundry1.5.1, pinned npm dependencies and Go modules available. GitHub project access configured; root is the only branch publisher. Native subagents and isolated worktrees available. Actual Chromium/Playwright, local Bee/Anvil and web/source retrieval are available. Current configured public funds/upload capability remain missing; only named project configuration is inspected, never unrelated wallets or identities. Existing runtime ports5173/8547/8787,18787/18547,18888 and Bee1633/1635 are preserved unless an owned service requires a documented restart.

## Integration review outcomes

Independent reviewers found and the integrator fixed Unicode request chunk decoding, duplicate upload reservation, wrong-network error suppression, escrow/config authority mismatch, stale snapshot serving, recipient-key changes during upload, stale wallet scope uploads and inconsistent gateway selection. Deployment preparation pins setup/circuit/source hashes, uses exclusive operation/journal creation and validates public issuer/snapshot structure before writes. Exact review scopes and residual risks remain in their reports; this was focused independent review, not a full production audit.

Browser rehearsal uses real local chain/Bee with injected public test accounts in isolated Chromium profiles. Reports and screenshots are archived in `docs/review-pass/evidence/` after final verification. Default55test suite has54pass/1networkskip; the opt-in11test Swarm suite separately ran with11pass. Do not add overlapping test counts or call these public funded integrations.

Remote qualification and EXIT CI both passed at final application revision `68fdf37`. The EXIT pinned-source fork job is dispatch-only and was skipped, not counted as newly passed. Public evidence hashes, receipts and exact run metadata are in [evidence](evidence/README.md).
