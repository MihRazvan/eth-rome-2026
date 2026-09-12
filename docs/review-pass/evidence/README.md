# Acceptance evidence

All evidence is scoped. Local Anvil/Bee operations, public read-only probes, deterministic test doubles and actual public writes are different categories. **No funded public lifecycle has been completed.**

| Artifact | What it establishes |
|---|---|
| `browser.json` and three screenshots |16actual Chromium lifecycle checks with public Anvil wallet bridges, two clients, reviewer and outsider. Scope/reward differences, actual proof import, separate encrypted reports, exports, key/session boundaries, revocation and payment. |
| `chain.json` | Ten actual local escrow transaction receipts/events and two paid job tuples. No Fuji claim. |
| `checks.json` | Test results and exact limitations, including overlapping suite counts and browser/code provenance. |
| `final-startup.json` | Final startup policy/read-only Chromium checks after the full lifecycle run. |
| `fuji-preparation.json` | Locally compiled deployment intent, pinned circuit/setup/source/bytecode hashes, canonical test-USDC configuration. It is **not a deployment manifest**. |
| `deployment-guards.json` | Four actual CLI guard/preparation probes, including rejection of changed setup bytes and an explicitly absent signer; zero broadcasts. |
| `public-access.json` | Legacy general read-only preflight with an explicit correction note for the new canonical-token/Swarm-ID model. No private configuration values retained. |
| `ci-qualification.json`, `ci-exit.json` | Both remote workflows passed at integrated implementation `f8e8f1a`. |
| `ci-final-qualification.json`, `ci-final-exit.json` | Both workflows passed at final publication-error correction `68fdf37`; the pinned-source job remains intentionally dispatch-only. |
| `manifest.json` | Allowlisted artifact hashes and exact source hashes; no issuer, holder, credential or device-private-key files. |

The public WSS/reconnect probe is [Arkiv probe evidence](../arkiv/probe-evidence.json); the actual UI subscription trace is [independent UI evidence](../arkiv/ui-review-evidence.json). Both concern public reads. Native public expiry and a two-client public write stream still need funded entity creation.

The opt-in Swarm test actually initializes the canonical remote identity iframe in Chromium, unauthenticated. It is not upload evidence. The [Swarm review](../product-swarm/integration-review.md) separately reproduces key/session races with extracted application control flow and records their fixes. The [deployment review](../avalanche/deployment-review.md) covers public metadata and artifact guards without broadcasting. The [UI review](../arkiv/ui-review.md) records three extracted publication scenarios after the last correction.

Independent ciphertext recovery also succeeded from local Bee1635 using `retrieve-report.mjs`, without the application API or a wallet. The export still needs an authorized retained device key for decryption; the private test plaintext and key files were not archived.

Latest runtime intentionally retains the completed local rehearsal: two paid jobs and a revoked credential. The old snapshot pointer returns409. Use the [runbook](../RUNBOOK.md) to allocate a fresh credential/deployment and restart only18889 for another full user test.
