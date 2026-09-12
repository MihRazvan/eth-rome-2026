# Run the wallet pilot

Commands run from the repository root unless specified. The local scripts use test assets and the publicly known Anvil mnemonic. They refuse public deployment; do not put real assets or credentials into this rehearsal.

## Start or resume

Install the root npm dependencies, Go and Foundry versions described in the [original runbook](../RUNBOOK.md). Start its local Bee stack and original qualification runtime if they are absent. The original runtime supplies the dedicated Anvil on18547, test token and matching prover setup/verifier. Do not restart it while using pilot contracts: doing so resets their underlying local chain. Never touch the unrelated EXIT services on5173/8547/8787 or the pre-existing8545Anvil.

With the original runtime and local Bee1633/1635 healthy:

```sh
node experiments/qualification/pilot/deploy-local.mjs
node experiments/qualification/pilot/start.mjs
```

Open **http://127.0.0.1:18888** using that exact host. The server binds loopback, enforces Host and same-origin POST, and rebuilds the frontend at startup. Its public configuration is `.runtime/qualification-pilot/config.json`; `QUALIFICATION_PILOT_CONFIG` can select another explicit file. Changing configuration or UI source requires restarting this server. Inspect `.runtime/qualification-pilot/pids.json` and confirm its process command before TERM; stopping this server does not stop the original Anvil or Bee.

Deployment creates a new escrow and key registry, allocates a fresh credential from the persistent pilot issuer, and uploads its whole status snapshot to actual local Bee. It reuses the original test setup/verifier/token. Issuer state lives under `.runtime/qualification-pilot/issuer`; holder files live under `.runtime/qualification-pilot/holder`. Keep all of these private/Git-ignored. The deploy script does not reset the issuer's allocation/revocation history. It is a local setup convenience controlling test roles on one host, not evidence of independent organizational custody.

If local postage expired, buy another **local mock** batch as described in the original runbook and pass `QUALIFICATION_LOCAL_POSTAGE` to `deploy-local.mjs`. A missing Bee write fails deployment; there is no fixture fallback.

## Manual flow with test wallets

Use separate browser profiles and EOA test wallets for client A, client B and reviewer. Configure the local network manually if needed: RPC `http://127.0.0.1:18547`, chain ID31338, symbolETH. The wallet must have local test gas. The automated rehearsal uses public Anvil accounts1/2/3/5 and issuer0, arbitrator4; these accounts must never hold real funds. Wallet extension behavior itself has not been exercised by the automated wallet bridge.

1. Connect and register a device key in every participant profile. A key is scoped to this wallet, registry and browser profile. The browser retains its private key; the registry receives only its public key and expiry.
2. Client A mints test qUSD and funds the fixed250qUSD assignment. Approval and funding are separate wallet confirmations. Repeat with client B when ready.
3. Reviewer opens the assignment's proof instructions and downloads the public whole-issuer snapshot. Generate state and proof using the holder-local CLI commands shown by the UI, substituting actual local setup/credential/holder file paths. Only the exported `presentation.json` is imported into the page. Never upload the credential, holder file or private state.
4. Reviewer imports the exact job-bound proof, accepts through its wallet, writes the test review, and submits. Submission encrypts for the current client/reviewer keys, asks for a wallet signature authorizing that ciphertext upload, uploads to Bee, then requests the onchain document commitment transaction.
5. Client A retrieves/decrypts from another profile, checks the review and approves payment. Client B can perform the same flow for its distinct assignment using another proof from the same credential; client A cannot decrypt B's document. Reusing the reviewer payment wallet publicly links these jobs even though their nullifiers differ.
6. Reload a recipient profile and retrieve again. After key rotation, explicitly choose the retained previous device key for an old document. Another device has no old private key automatically; no export/recovery service is implemented.

For locally deployed holder paths, `.runtime/qualification-pilot/holder/latest.json` is a **private local pointer**, never an HTTP resource. The runnable prover is `.runtime/qualification-pilot/prover`; setup is `.runtime/qualification/setup`. Supply only the holder commitment to an independently operated issuer in a real session. The current setup script handles both sides solely for test convenience.

## Revocation operations

Use the [durable registry CLI](../prover/ISSUER.md) to revoke the intended allocated index and emit the whole snapshot. The issuer then uploads the snapshot, signs escrow `setRoot(newRoot)`, and updates the configured snapshot locator/digest before restarting the pilot server. Publication and the chain root change are separate operations, not an atomic cross-network commit. The server currently serves the snapshot configured at startup: stale snapshot pointers can cause failed proving/acceptance, and must be updated. Settlement checks the current root and rejects stale proofs.

The automated browser test performs actual local registry revocation and an issuer-signed root update, then pays already submitted jobs. It intentionally leaves the configured snapshot stale and the credential revoked at the end; this is recorded test state, not a fresh demo. To rehearse again, run `deploy-local.mjs` and restart18888 to obtain a new credential slot and contracts. Do not clear the issuer directory or restore old allocator state to revive a credential.

## Verification

```sh
forge test --root experiments/qualification/contracts
node --import tsx --test experiments/qualification/pilot/keys.test.ts
node experiments/qualification/pilot/security-probe.mjs
node experiments/qualification/pilot/preflight.mjs --self-test
node experiments/qualification/pilot/browser-test.mjs
```

Run `go test -count=1 ./...` inside `experiments/qualification/prover` too. Browser commands require installed Playwright Chromium. The integrated browser test needs a **fresh pilot deployment**, the running18888server and actual local chain/Bee. It creates two jobs, revokes its durable credential and pays both jobs; it is not read-only and should not run during a user's session. Evidence goes under `.runtime/qualification-pilot/evidence`.

Public preflight and the unfilled participant worksheet are in [ACCESS.md](ACCESS.md) and [PILOT.md](PILOT.md). This runbook does not provide a completed public deployment or production hosting path.
