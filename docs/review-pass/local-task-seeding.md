# Seed one local review task

This helper leaves an actual funded, open task available after the browser test consumes its own tasks. It operates only on the configured **local Anvil31338 and local Bee**. It does not issue or revoke credentials, register device keys, reset services, create Arkiv listings or establish a public integration.

Run from the repository root, with the existing local deployment and Bee nodes available:

```sh
# Read-only: validate local configuration, chain, token and any reusable scope.
node experiments/qualification/pilot/seed-local-task.mjs --check

# Explicit writes: reuse an existing open task, or create the first seed.
node experiments/qualification/pilot/seed-local-task.mjs --seed
```

`QUALIFICATION_PILOT_DIR` defaults to `.runtime/review-pass`. The helper reads only its `config.json`; it never reads a project signing key. The signer is public Anvil development account1 (`0x70997970C51812dc3A010C7d01b50e0d17dc79C8`). All RPC and Bee URLs must be literal loopback HTTP URLs without credentials; redirects are rejected. Both chain31338 and an Anvil client version are checked, including before each transaction. The configured escrow must identify the configured six-decimal `qUSD` token.

The helper first scans at most10000 jobs for an unexpired open task funded by account1 with a committed public document. It verifies retrieval, SHA256, canonical terms and the onchain economic fields before reusing it. A bad commitment or unavailable existing scope stops execution; it does not cause another funded task to appear. A reusable task produces `REUSED` with `writes: 0`.

If none exists, the first explicit seed uploads a nonsensitive review scope through local Bee and retrieves it through the configured download node. It mints only the shortfall for a250qUSD reward, approves only if needed and funds `createJobWithDocument`. The scope uses the shared `encodeTerms` projection and pins a public source revision. Acceptance, submission and review deadlines are24/48/72hours after the current local block timestamp. The receipt's funding event determines the job ID; the helper then checks the funded job and immutable content reference. qUSD has no monetary value.

A completed seed is recorded in ignored `local-task-seed.json` under the runtime directory. Normal reruns reuse an open task. If the recorded seed was consumed or expired and no other reusable task exists, normal reruns stop. Creating **one deliberate replacement** requires:

```sh
node experiments/qualification/pilot/seed-local-task.mjs --seed --new
```

`--new` still reuses an existing open task. It never creates extra work merely to fill a board. An incomplete journal blocks retries: inspect its transaction hashes and chain state before any deliberate recovery. A lock prevents two copies of this helper from funding concurrently. If a process is killed, verify it has stopped before manually removing its stale lock; never delete a journal just to make an error disappear.

The default invocation is read-only, equivalent to `--check`. Its `READY_TO_SEED` result means prerequisite reads succeeded, not that postage was tested with a write, a task was funded, a reviewer can prove eligibility or a judge completed the flow. The helper does not start or restart the UI. Refresh the existing local workspace after funding. Reviewer credentials/proofs and both participants' device-key registration remain separate prerequisites. This task appears in the explicitly local workspace, not the public Arkiv opportunity board.

## Verification scope

Implementation verification before integration: Node syntax check, read-only `--check` against the existing local configuration, and offline rejection checks for a public RPC, public Bee endpoint, Fuji configuration and invalid command-line options. No chain writes or runtime restarts were performed by the implementation worker. The integrator must execute `--seed`, verify the real local Bee/funding receipt, and run it again to confirm `REUSED` with zero writes before marking the seed itself rehearsed.
