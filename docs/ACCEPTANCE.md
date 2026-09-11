# Acceptance ledger

Last integrated local verification: 2026-09-11. A passing local result does not discharge a public network requirement.

| ID | Outcome | Owner | State | Actual verification / blocker |
|---|---|---|---|---|
| P1 | Exact seller net, maker debit, fees and rollback | protocol + independent reviewer | verified local | `forge test`: exact/fuzz/fee/fee-alias/underfunded-fee/fee-token cases; browser checks exact seller balance |
| P2 | No prior-owner authority or arbitrary execution | protocol + reviewer | verified local/fork | Former-owner and outsider attacks; bounded account fork cancellation/recovery; no operators/delegatecall |
| P3 | Exact residual bundle and stale rejection | protocol + integrator | verified local | Cash collection preserves bundle; withdrawal depletes; browser partial4000 → stale → resale5985; dust harmless |
| P4 | Domain/party/source/price replay boundaries, seller consent | protocol + reviewer | verified local | All-field mutation, cross-market/chain, nonce consumption/cancel, ERC1271 execution-time checks; epoch request binding fixed independently |
| P5 | Independent maker funds, no implicit reservation | protocol + integrator | verified local | Distinct wallets/balances/allowances, insufficient balance fails, maker runner replenishes only its own valueless test currency |
| P6 | Callback safety across market/vault | protocol + reviewer | verified admitted boundary | Malicious token callback regression; immutable exact-transfer TestUSDC is the enabled payment token. Unsupported-token results are not universal admission |
| P7 | Current owner retains cash and recovery rights | protocol + reviewer | verified local/fork | Recovery before/after standard exhaustion, balance conservation, fork returned shares. Persistent ownership record |
| LIFE | Normal and adverse economics | integrator | verified local; Fuji blocked | `npm run scenario`, local-lifecycle.json; normal25/15, adverse25/-285. Actual browser residual lifecycle independently reads chain |
| PRIVATE | Client HPKE, wallet key binding, registry, request/epoch, reload/isolation | transport + reviewer + integrator | verified local | 9 privacy tests, custom browser price9987.123456 never in upload/index bytes, seller reload, outsider denial, accepted terms visible in chain event |
| RECOVERY | Replacement/cancellation/wrong-account and degraded reads | integrator + reviewer | verified local | 5 controller regression tests; UI preserves known confirmation if discovery fails; cancelled/altered replacements rejected |
| ARKIV | Real discovery and native expiry | transport | read verified; write/expiry blocked | SDK0.8.1 real Tiramisu compound query returned0; native expiry probe implemented but no funded signer supplied. Identical query/no cleanup required |
| SWARM | Actual upload and independent retrieval verification | transport | implemented; live upload blocked | Gateway HTTP200; byte transport+independent verifier and integrity tests; no supplied funded postage/upload endpoint |
| SOURCE | Pinned BENQI implementation, origination/collection/recovery | integrator + reviewer | fork verified | Three tests at95031281, implementation+codehash pin. Redemption explicitly simulates future operator publication with1wei; source prototype not an enabled market |
| UI | Original full market/trade/portfolio/detail | design + independent evaluator | verified local | Three rendered directions, receipt selected; browser widths390/1024/1440, public/private sale and collection, accounting/identity/mobile findings fixed |
| DEMO | Fresh visitor backed origination and funded makers | integrator | verified local; public Fuji blocked | `npm run start:local`, visible funding/create/request paths; timed blocks and a real one-minute browser wait verify idle payout maturity; standalone public funding/hosting requires missing network access |
| RELEASE | CI, runnable commands, licenses, evidence and submissions | integrator | CI passed; static preview published; human steps pending | GitHub run34627028500 passed on d7ed34c, clean local start verified, labelled Vercel preview browser-checked. Human forms/conversation/attendance/camera not done |

## Evidence interpretation

Solidity integrated report39 includes16 inherited reviewer-harness repetitions; meaningful newly authored reviewer cases5. Two invariant campaigns each128×64 successful calls, zero reverts. JS tests15 including exact large-amount ranking. Browser tests assert visible behavior and independent ownership/balance state; production screenshots are reviewed separately from fixture concept images. Latest command results and exact commit status belong in CONTINUATION.md.

Missing requirements are retained, not downgraded: Fuji deployment/public lifecycle, Arkiv publication/native expiry, live Swarm upload/independent round-trip, and human bounty steps. No fixture fallback is used for any failed live service.
