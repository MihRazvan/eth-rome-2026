# Wallet pilot acceptance — 12 September 2026

**Result: the local wallet-separated technical rehearsal passes.** Public deployment, actual issuer/client adoption and bounty completion remain open. Implementation snapshot: `9fb24a9` (including test/deployment/CI changes); independent security review inspected `d7b07c1`. The latter's reviewed application/key/contract source is unchanged by the deployment/test follow-up.

## Executed evidence

| Check | Actual result and scope |
|---|---|
| Integrated browser | **13 checks passed**, actual local Anvil31338 and two local Bee endpoints, real Chromium with four isolated profiles and explicitly injected public test EOA wallets. One issuer/credential, reviewer, two paying clients, outsider. No HTTP fixtures or server-signing substitute. |
| Contract suite | **17 passed**:11 escrow tests (including256 dispute fuzz cases),2 registry tests,4 actual generated-verifier fixture tests. Escrow state unit tests use a named verifier double; the browser flow uses actual local CLI proofs and a real deployed verifier. |
| Browser key module | **10 passed**, including actual Chromium IndexedDB persistence and isolated-profile crypto; malformed/context/recipient/expiry/tampering/rotation/concurrency/corruption cases. |
| Durable issuer | Full Go suite passed. Includes12 concurrent issuer processes with unique indices, actual SIGKILL after durable reservation, monotonic revocation and reissue, tamper/path checks. Opt-in scalability test skipped; earlier scalability evidence remains separate. |
| Upload authorization | Actual message/EOA verification accepts the worker and rejects modifications to each of5 bound fields and another worker. The offline stale-connect ordering model is separately labeled. |
| UI/session | Actual integrated browser disconnect clears plaintext; delayed connection cannot reinstall an old wallet after `accountsChanged`;390px screenshot has no horizontal overflow and no page exceptions. |
| Build and types | Pilot TypeScript and production Vite build passed. HPKE's optional Node `crypto` externalization warnings remain; actual browser encryption/decryption passed. |
| Public preflight |5 self-checks passed. Fresh endpoint reads passed; missing configured funding/deployments/public upload/API remain **BLOCKED**, not replaced by local services. |

The [browser record](evidence/browser.json), [public chain observations](evidence/chain.json) and [manifest](evidence/manifest.json) preserve this rehearsal. Screenshots show the paid end state. Only allowlisted public evidence was copied; issuer keys, issued credentials, holder secrets/private state and browser private keys are excluded. Later documentation commits do not alter the checked source. CI runs are recorded separately from local Docker integration; the workflow does not claim that the entire Bee/Anvil rehearsal runs in CI.

Both remote workflows passed at `9fb24a9`: [qualification including the new pilot checks](https://github.com/MihRazvan/eth-rome-2026/actions/runs/34683652846) and [existing EXIT regression checks](https://github.com/MihRazvan/eth-rome-2026/actions/runs/34683652872). Their exact job/step records are retained as `evidence/ci-qualification.json` and `evidence/ci-exit.json`.

The test checks different job-scoped nullifiers for the same credential, successful decryption by the intended client, failed decryption by the other client and outsider, retained-key access after rotation, and payment from both client wallets after durable issuer revocation and its onchain root update. Different nullifiers are not proof of complete unlinkability: the reused payout wallet is public.

## Remaining boundaries

- **Pilot authority:** test issuer/class and synthetic tasks only. No assessment collective or client has been recruited; no external outreach was sent. Cryptographic validity does not establish qualification quality, work quality, unique humanity or nontransferability of holder secrets.
- **Wallets/devices:** EIP-1193 transaction wiring is implemented; the executed integration used a test bridge, not wallet extensions or different physical machines. Upload signature recovery is EOA-only; ERC-1271 is unsupported. Browser private keys are protected by the origin/profile, not by wallet hardware; malicious same-origin JavaScript can use them.
- **Recipient availability:** keys must be current and valid when submitting. Client revocation/loss can prevent usable delivery; the current protocol does not lock a recipient key at acceptance or provide an alternate delivery/recovery negotiation. Revocation cannot recall historical plaintext. Losing all historical keys loses access to older documents.
- **Issuer state:** monotonic allocation/revocation holds for the cooperating persistent local registry, not malicious key holders or valid whole-disk rollback.65,536 lifetime slots include crash gaps; no reset under the same key. An external monotonic anchor and issuer rotation governance are future work.
- **Publication:** the server uses a configured snapshot pointer loaded at startup; operations must publish/update it alongside the current root. Stale roots fail acceptance. Arkiv assignment discovery/WSS reconciliation is not wired into this pilot UI; native public expiry and writes remain unverified.
- **Hosting/storage:** loopback server only. Upload authorization is job-bound and has in-memory per-job quotas/serialization, but no durable public-hosting quota/service operation design. Delivery is limited to50,000 characters in the UI and512KB HTTP envelopes. Upload success followed by declined chain submission can leave orphan ciphertext. Bee availability and public postage still matter.
- **Settlement/privacy:** trusted issuer and arbitrator, experimental single-process Groth16 setup, public wallets/cohorts/recipient metadata/timing. An unresponsive arbitrator can stall a dispute. The fixed test token and generic terms are not production financial or employment compliance support.

The next evidence should come from authorized public writes and the [real participant protocol](../../../docs/deaddrop/TESTING.md), not additional simulated customer endorsements. The existing EXIT and REPRISE implementations/history remain preserved.
