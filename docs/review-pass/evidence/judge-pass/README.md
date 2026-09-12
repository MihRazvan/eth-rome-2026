# Judge-readiness verification

Application source **`5ad9366aa2720bbab44b22d732e62b0162d50aba`**, tested 12 September 2026. Follow-up application revision `dea5ba2` only sanitizes missing-route errors and adds an explicit link from the empty public board to local tasks; [targeted actual HTTP/browser checks](final-readonly.json) pass. Later changes are documentation and evidence. These are local Anvil/Bee tests with public development wallet bridges, not live Fuji/public Swarm settlement or independent human-device testing.

| Check                        | Actual result                                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full real Chromium lifecycle | [20 checks passed](browser.json), zero page exceptions; four isolated wallet/browser profiles, two client scopes and both payments                             |
| Browser proof                | WASM proof generated locally and simulated, then accepted by the deployed real Groth16 verifier; cancellation and wallet-change abort checked                  |
| Privacy/recovery             | Request URLs/bodies excluded the holder secret; client-specific reports, outsider rejection, reload, rotation and export checked                               |
| Responsive UI                | 390px no horizontal overflow; [desktop](reviewer-desktop.png) and [mobile](reviewer-mobile.png) screenshots                                                    |
| Solidity                     | 18tests passed, including 256 fuzz runs and real-verifier fixtures                                                                                               |
| Go prover                    | `go test ./...` passed                                                                                                                                         |
| Application suite            | 57passed,1optional network case skipped; no skipped case counted as passed                                                                                     |
| TypeScript                   | Full pilot/web explicit compiler check passed                                                                                                                  |
| Independent review           | [Concrete prover integration findings and fixes](REVIEW.md); separate fresh-browser UX evaluation                                                              |
| Manual task preparation      | [Actual local funding](seed-funded.json); [repeat reused existing task with 0 writes](seed-reused.json)                                                          |
| Public access                | [Fresh read-only preflight](public-preflight.json): RPCs/retrieval health reachable; project signers, public deployment/upload/HTTPS configuration unavailable |

Reproduce commands are in the [runbook](../../RUNBOOK.md). The browser test intentionally revokes its credential and leaves its snapshot stale. The subsequently prepared manual runtime uses a fresh credential and separate escrow; it does not reset the chain, erase allocation/revocation history or change completed evidence. Manual task 1 is a real local 250 qUSD escrow with a 24-hour acceptance window from its funding block. The user still needs a local test wallet and browser device key; enrollment instructions are in [provisioning](../../QUALIFICATION-PROVISIONING.md).

An early run reached both payments but failed the final test assertion because it used `secret` instead of the actual `holderSecret` field. That assertion was corrected, and the entire lifecycle passed twice afterward, including the exact application source above. No failed run is reported as a pass.

No production trusted setup, external issuer/customer adoption, mobile-hardware proving, Firefox/WebKit compatibility, public funded lifecycle or sponsor submission is claimed.

Fresh manual-state screenshots: [desktop](fresh-desktop.png), [mobile](fresh-mobile.png). These show the subsequently seeded task, not the two paid lifecycle test jobs.

[Both GitHub CI workflows passed](ci.json) at final application revision `dea5ba2`. The dispatch-only pinned-source job was skipped, not newly verified. The subsequent handoff commit contains only documentation and evidence.
