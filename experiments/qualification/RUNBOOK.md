# Run and demonstrate Review Pass

Run from the repository root. This is an isolated local experiment with test issuer/holder files and public development transaction accounts. Do not put real credentials or assets into this helper, or bind it to a public interface.

## Prerequisites

- Root `npm ci` dependencies; Node24.12.0; Go1.25.7 (pinned by the prover); Foundry/Anvil with solc0.8.30.
- Docker and the experiment's local Bee stack. Existing nodes use upload1633, independent retrieval1635 and factory chain28545. All are loopback-bound. EXIT5173/8547/8787 and the pre-existing Anvil8545 are unrelated and must remain untouched.
- A usable **local** postage batch. The captured batch is in `transport/local-stack.json` and expires; it is not a public postage capability.

On a clean machine with no existing factory containers:

```sh
node experiments/qualification/transport/start-local-bee.mjs
curl -X POST http://127.0.0.1:1633/stamps/1000000000/17
```

Use the returned local mock `batchID` as `QUALIFICATION_LOCAL_POSTAGE` when starting. The wrapper intentionally refuses existing factory containers/occupied ports. It was syntax checked and mirrors the actual successful setup; the wrapper itself was not rerun destructively over the existing stack. Captured image digests and the prebuilt Bee's actual `dirty` version are recorded in `transport/local-stack.json`. Never describe these as public Swarm nodes.

## Start

```sh
node experiments/qualification/runtime/start.mjs
```

If using a newly purchased local batch, prefix that command with `QUALIFICATION_LOCAL_POSTAGE=<local batchID>`. Only this local public identifier is needed; it is not an issuer or holder key.

Startup compiles the prover, generates a fresh Groth16 test setup and matching Solidity verifier, creates separate random holder/issuer test files, signs the holder commitment, publishes a whole issuer snapshot to local Bee, deploys verifier/token/escrow on its Anvil31338/18547 and runs23 actual integration checks. It restores the deployment after tests and seeds one250qUSD assignment. It fails on missing Bee storage; there is no plaintext/fixture fallback. Root/.runtime/qualification contains keys, setup, PID record and runtime output and is Git-ignored.

Open **http://127.0.0.1:18787** using that exact host. The HTTP helper enforces loopback Host, same-origin POST and a serialized action queue. Stop using Ctrl-C in its terminal; it stops only its own Anvil. For an agent-started process, inspect `.runtime/qualification/pids.json` and confirm the process command before sending TERM to its runtime PID. Restart creates fresh test state; it does not migrate the previous local deployment or preserve browser document keys.

## Demo in one tab

1. **Reviewer:** inspect the250qUSD funded review, deadlines and disclosure receipt. Prove current qualification, inspect all nine public inputs, then accept. This is a real proof generated in a local Go process.
2. **Reviewer:** write a short test review, then encrypt/store/submit. WebCrypto creates ciphertext in the browser; the helper uploads only its envelope to local Bee. Keep the tab open: it holds the document key.
3. **Client:** retrieve/decrypt through the second Bee node. Read the review, but leave it unpaid briefly.
4. **Client:** fund a second assignment. **Reviewer:** generate a proof for that assignment.
5. **Issuer:** revoke the test credential. **Reviewer:** try accepting with the previously generated proof, then try generating a new proof. Both fail; the first uses a stale root, the second is revoked.
6. **Client:** approve and pay the first submitted review. The250qUSD balance and receipt update despite later revocation. qUSD has no real value.
7. Optional dispute route: restore the test credential, accept/submit a new job, dispute it as client, and explicitly simulate the trusted arbitrator's50/50 split. Restore is a reversible test control, not the intended permanent revocation policy for a real issuer.

The independent second-client funding/verification case is part of startup's integration scenario. `runtime/verify-presentation.mjs` can be run as a separate client process using only public inputs, RPC, escrow and job ID. It pins reads to one block and does not replace acceptance's onchain freshness check. Role buttons in the browser are test controls, not authentication.

## Repeat verification

```sh
cd experiments/qualification/prover
go test -count=1 ./...
```

From the root:

```sh
forge test --root experiments/qualification/contracts
sh experiments/qualification/security/run-probes.sh
node --import tsx --test experiments/qualification/transport/adapters.test.ts experiments/qualification/transport/assignment.test.ts
node experiments/qualification/security/concurrency-probe.mjs --fixed
node experiments/qualification/runtime/browser-test.mjs
```

The browser test requires a **fresh** running seeded workbench and installed Playwright Chromium. It uses real UI/chain/Bee with no request mocking and leaves local paid/revoked state. Its second-tab negative check intentionally demonstrates missing key delivery. Desktop/mobile screenshots and browser JSON go to `.runtime/qualification`. The separate qualification CI workflow runs crypto, real Solidity fixture, protocol and adapter checks; it does not claim the local Docker/browser integration or public sponsor operations ran on CI.

Use `node experiments/qualification/runtime/start.mjs --test-only` for the actual integration scenario without leaving the browser server/Anvil running. It still needs the local Bee stack and writes its test evidence before stopping.

## Public demonstration gate

Do not host this helper. The remaining public path needs authorized funded Fuji and Arkiv signers, usable public Swarm storage, wallet-separated transaction roles, holder-local proving and recipient key delivery. Then record actual deployment addresses/transactions, public storage retrieval, Arkiv publication→same query after native expiry and assignment-specific WSS UI reconciliation. The transport probes distinguish read access from funded write access. No ENS dependency is required for this gate.
