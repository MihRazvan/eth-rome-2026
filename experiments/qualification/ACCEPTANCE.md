# Qualification feasibility acceptance — 12 September 2026

**Result: the combined proof and local application work. Do not equate that with a production credential service, issuer adoption or a completed sponsor submission.**

The full integration/browser evidence was captured against runtime source `7b699917c7af5acda34507afeb7a9063411dc8dc`; later `0f46801` adds CI and actual-proof fixture tests without changing runtime/circuit behavior. Exact timestamps, proof, matching generated verifier, deployed code hash and screenshots are in [evidence](evidence/sha256.json). The verifier exported during each runtime startup has a fresh test setup and differs from the separately committed fixed test verifier in `prover/artifacts/`. Each proof is valid only with its matching verifier.

Follow-up runtime `bb65172` resolves generated verifier artifacts by compiler source provenance because fixed test fixtures share the Solidity basename. Its [fresh 23-check integration rerun](evidence/runtime-followup.json) passed; use the matching `runtime-followup-proof.json`/`runtime-followup-verifier.sol` pair when inspecting that run. Browser/UI/circuit behavior is unchanged. The final workbench was left at a freshly funded open assignment.

## Executed evidence

| Scope | Actual result | Evidence |
|---|---|---|
| Combined issuer signature, holder knowledge, same signed status index, class, expiry, assignment and beneficiary | PASS; 26,089 constraints, nine public inputs, 256-byte BN254 Groth16 proof | [Prover tests/measurements](prover/evidence/measurements.json) |
| Standalone proof cost on this ARM64 host | About76ms internal proving;714ms full CLI including setup loading;55.2MB peak RSS in captured run | [Measured process](prover/evidence/prove-time.txt) |
| Whole snapshot reconstruction | PASS at0/100/1,000/10,000 revocations; largest108,468bytes, median795ms native reconstruction | [Scale report](prover/evidence/snapshot-scalability.md) |
| Actual-proof EVM + local Bee + settlement integration | **23 checks PASS**; captured proving70ms, proof CLI320ms, acceptance about338k gas. This is local Anvil, not Fuji gas/latency evidence | [Integration JSON](evidence/acceptance.json) |
| Independent second client | Another test address funds its job; separate read-only process validates public proof and pinned-block state without credential/key files. Different job produces different scoped nullifier; old job proof rejects | [Verifier client](runtime/verify-presentation.mjs), integration JSON |
| Browser reviewer/client/issuer flow | **6 checks PASS**: prove/accept; encrypt/store/retrieve/decrypt; revoke/stale-proof/fresh-proof failure; pay existing work;390px no horizontal overflow; another tab reports missing key | [Browser evidence](evidence/browser-evidence.json), [test](runtime/browser-test.mjs) |
| Solidity regression | **14 tests PASS**: ten escrow state tests including256 dispute-split fuzz cases; four tests against actual gnark-generated proof fixtures, including all nine public-input mutations | `forge test --root experiments/qualification/contracts` |
| Transport | **13 tests PASS** plus isolated TypeScript check; ciphertext authentication, limits, public-field projection, authoritative ad validation and expiry filters | [Transport tests](transport/adapters.test.ts), [assignment tests](transport/assignment.test.ts) |
| Independent targeted review | Eleven extra crypto boundary probes; fixed class-range and helper-concurrency defects independently verified. No concrete forgery/payout diversion found in bounded scope | [Review](security/REVIEW.md) |
| Existing EXIT application | Existing verification workflow passed at7b69991; no EXIT behavior changed | [CI run](https://github.com/MihRazvan/eth-rome-2026/actions/runs/34681520131) |

Remote CI at `0f46801` subsequently passed both [qualification proof/protocol checks](https://github.com/MihRazvan/eth-rome-2026/actions/runs/34681651818) and [existing EXIT checks](https://github.com/MihRazvan/eth-rome-2026/actions/runs/34681651824). The qualification workflow covers Go/independent probes, actual Solidity fixtures/state tests and transport/type checks. It does not claim browser/Bee or public sponsor integration was run on CI.

The state-machine tests clearly label their verifier double; they do not substitute for the four actual-proof Solidity fixture tests or23-check integration. Go test groups contain subtests; counts above are not added together as a marketing total. Browser evidence has zero page exceptions; expected rejected HTTP actions are part of the negative flow. Two roles in one browser are a local simulation, not independently authenticated people or a customer pilot.

Integration startup uses `evm_snapshot`/`evm_revert` to restore the deployment after its test scenario. Therefore its successful transaction receipts describe executed local tests; those transactions are deliberately absent from the subsequent seeded demo chain. They are not public explorer receipts. No public-network failure is replaced with local data under a public label.

## Sponsor status and remaining access

| Target | Why it belongs | Current gate |
|---|---|---|
| **Arkiv** | Public assignment discovery by class/chain/escrow/deadline; native expiry; public whole-issuer snapshot pointers. Contract state remains authority | Public queries and actual SDK WebSocket notifications PASS. Funded publication, native-expiry observation, assignment-specific WSS UI reconciliation and a genuine two-client published workflow remain **UNVERIFIED**. No project funded signing account; anonymous faucet returned401 and the official flow requires wallet/SIWE/CAPTCHA. |
| **Swarm** | Credential-independent issuer snapshots and client-encrypted review artifacts | Actual local Bee queen upload→worker retrieval PASS, including real snapshot root reconstruction. **Public storage BLOCKED** without usable authorized postage/gateway or redeemed event gift capability. Browser cross-device key delivery/recovery is **NOT IMPLEMENTED**. |
| **Avalanche / Team1 Track A** | Proof-bound admission, funded test-stablecoin obligation, approval/dispute/timeout settlement | Fuji RPC read PASS. **Deployment and public two-wallet settlement BLOCKED** without configured funded testnet signer. Local Anvil proof verification does not constitute Fuji delivery. |
| **ENS** | Optional issuer administration only if useful | Deliberately deprioritized. No new ENS integration or ENS prize claim. |

Current [Arkiv hub](https://hub.arkiv.network/ethrome) lists aEUR2,500 pool, one prize per team, with up toEUR1,000 overall. The [event sponsor brief](https://www.ethrome.org/hackermanual/prizes.html) lists Swarm$500 per winning team and Team1 Track A$400/$200. Conditional first-prize ceiling across these three is **EUR1,000 + USD900**, not an expected return or guaranteed eligibility. The main prize is an in-kind hub membership. Do not conflate pools with what one team may win. Follow the source conflict notes in [sponsor research](../../docs/deaddrop/BOUNTIES.md) before submission; no ENS feature should displace the missing higher-priority evidence.

No real funds spent, no third-party account/credential vault searched, no team member contacted, no sponsor submission made. The sponsor conversation/eligibility and public funding gates require actual access or human participation; their absence does not change the local PASS results.

## Security and product boundaries

- The proof hides the credential/index and holder secret in its public presentation. It exposes issuer, root, class, deadline, assignment, recipient and scoped values. Reused payment wallets, network metadata, small cohorts and malicious issuer behavior can correlate people. No anonymous-payment or broad collusion-resistance claim.
- One local helper controls all test roles and can read their separate files. This demonstrates local proving, not remote prover privacy, browser WASM proving, credential-wallet interoperability or independent role authentication.
- The Groth16 setup is single-process test setup. A production ceremony/security review remains necessary. The generated issuer is a test assessment, not a recognized certifying body.
- Issuance is currently caller-supplied index signing. A real issuer needs durable unique slot allocation, monotonic revocation, fresh slots on reissue, appeals/expiry policy and registry/key rotation. Reusing or unrevoking a slot can revive old unexpired credentials. The demo's **Restore test credential** intentionally does that; it is not a production revocation policy. Under nonreuse, depth16 allows65,536 lifetime issuances per issuer key.
- A private qualification proof does not judge work quality. Client approval or the agreed review timeout establishes payment under the experiment policy; a trusted arbitrator resolves disputes. A silent arbitrator can leave a dispute locked. Revocation does not erase submitted work or give the client a new refund right.
- Browser AES-GCM keys are nonextractable and held in the tab. Retrieval/decryption is real, but separate-device key delivery, recovery and durable encrypted-document access are not implemented. The UI reports this instead of fetching a server-held key.
- One human can have multiple holder secrets; the scoped nullifier is not proof of unique humanity. Secret sharing remains possible. Two test client accounts/processes demonstrate composition, not commercial demand.

**Recommendation:** continue as an issuer-led pilot for confidential paid reviews only if a real assessment collective and two clients want the minimized disclosure. Existing anonymous-credential systems already implement private eligibility and proof-gated actions. If clients require the same stable identity anyway, or ordinary platform pseudonyms meet the whole need, this custom product does not justify its complexity. The research verdict is conditional; the cryptographic feasibility result is positive.
