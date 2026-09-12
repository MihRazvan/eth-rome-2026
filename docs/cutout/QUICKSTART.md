# Cutout — quickstart

[Docs](../README.md) · [Deployment](DEPLOYMENT.md) · [User flow](USER-FLOW.md)

Choose the level you need. The hosted walkthrough takes no setup. A complete local rehearsal needs a chain, prover and local Swarm stack. Public Fuji participation uses the hosted app and real testnet wallets.

## UI walkthrough

Requires Node **24.12+** and npm. From a fresh checkout:

```sh
git clone --branch review-pass/product https://github.com/MihRazvan/eth-rome-2026.git
cd eth-rome-2026
npm ci
npx vite experiments/qualification/pilot/web --host 127.0.0.1 --port 18904 --strictPort
```

Open **http://127.0.0.1:18904/?view=demo**. Follow the scope → qualification → seal → open → payment walkthrough. Encryption/decryption happen in the browser; qualification and settlement are simulated. No document upload or transaction is performed by the walkthrough.

This command serves only the UI. `/api/config` is absent, so the live workspace reports unavailable configuration/setup. That is expected here; use the hosted app or the complete stack below for actual task operations. Ctrl+C stops this Vite process.

For a static UI build:

```sh
npx vite build experiments/qualification/pilot/web --outDir ../../../../.runtime/cutout-ui-build
```

The output is not an active Fuji deployment and contains no configured read API. Root `npm run dev`, `build` and `start:local` are retained EXIT commands; they do not run Cutout.

## Complete local chain and storage rehearsal

Requires Node 24.12+, Go **1.25.7**, Foundry **1.5.1** (Forge/Anvil), Docker, Python 3 and curl. Install npm dependencies above. Chromium is needed for the automated browser test:

```sh
npx playwright install chromium
```

Run on a clean local development environment. These scripts use public Anvil development accounts and valueless local tokens. Keep the servers loopback-bound. Existing shared runtimes must not be reset during a teammate's manual test.

**1. Start local Bee and purchase mock postage.** Docker must be running; ports 1633–1642 and 28545 must be free. The wrapper refuses existing Bee-factory containers rather than deleting them.

```sh
node experiments/qualification/transport/start-local-bee.mjs
curl --fail -X POST http://127.0.0.1:1633/stamps/1000000000/17
```

Save the returned `batchID`. This identifier is for local mock postage, not a public Swarm credit or signer.

**2. Start the underlying local chain/prover runtime.** In a terminal, substitute that returned batch ID:

```sh
export QUALIFICATION_LOCAL_POSTAGE='REPLACE_WITH_LOCAL_BATCH_ID'
node experiments/qualification/runtime/start.mjs
```

Leave it running. It builds a local experimental proving setup and matching verifier, starts Anvil **31338 on port 18547**, uploads a local issuer snapshot and runs its integration scenario. It writes ignored artifacts under `.runtime/qualification/`. Port 18787 serves the earlier feasibility workbench; the current Cutout UI is started in the next step. Startup requires actual local Bee; storage failures stay failures.

**3. Deploy and serve Cutout on that local runtime.** In a second terminal, from the repository root, use the same batch ID:

```sh
export QUALIFICATION_LOCAL_POSTAGE='REPLACE_WITH_LOCAL_BATCH_ID'
export QUALIFICATION_PILOT_DIR=.runtime/cutout-local
export QUALIFICATION_PILOT_PORT=18889
node experiments/qualification/pilot/deploy-local.mjs
node experiments/qualification/pilot/start.mjs
```

Open **http://127.0.0.1:18889**. The deploy script requires the running runtime's `.runtime/qualification/deployment.json`, verifier, token and public setup. It creates a separate pilot escrow, key registry and issuer/holder records. Running it alone on a fresh checkout is insufficient.

**4. Run the actual local browser lifecycle.** In a third terminal:

```sh
QUALIFICATION_PILOT_DIR=.runtime/cutout-local QUALIFICATION_PILOT_PORT=18889 node experiments/qualification/pilot/browser-test.mjs
```

The test uses isolated Chromium profiles and injected public Anvil wallets. It funds, accepts, delivers, decrypts and pays through real local contracts and Bee. It also exercises adverse cases and permanently revokes a test credential. It changes local state and is not a read-only smoke test. It does not prove public Fuji/Arkiv/Swarm completion or an extension-wallet user test.

For a fresh local pilot after that test, redeploy the pilot and restart its server; preserve issuer allocation history. Stop only your own processes using their terminal's Ctrl+C. Stopping the underlying runtime stops its Anvil. Docker containers are separate; do not remove unrelated containers. [Detailed earlier local runbook](../review-pass/RUNBOOK.md).

## Verification

From the root after `npm ci` and `npx playwright install chromium`, these focused tests do not require wallet secrets or public writes:

```sh
node --import tsx --test experiments/qualification/pilot/*.test.ts experiments/qualification/pilot/hosting/read-api.test.ts experiments/qualification/pilot/web/publish-snapshot.test.ts
npx tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck --types node,vite/client --lib ES2022,DOM experiments/qualification/pilot/*.ts experiments/qualification/pilot/web/main.ts experiments/qualification/pilot/web/boot.ts experiments/qualification/pilot/hosting/*.ts
```

Crypto checks, from the prover directory:

```sh
cd experiments/qualification/prover
go test -count=1 ./...
```

From the repository root, run the independent boundary probes and contract tests. The contract tests use a committed verifier fixture and do not require the local runtime:

```sh
sh experiments/qualification/security/run-probes.sh
forge test --root experiments/qualification/contracts
```

The [qualification CI workflow](../../.github/workflows/qualification.yml) records its own scope. [Evidence](EVIDENCE.md) distinguishes previously executed tests from newly documented setup instructions. The fresh Docker bootstrap is documented from inspected scripts and prior stack setup; this documentation pass does not claim it was rerun over a clean machine.

## Real public testnet flow

Use [Cutout](https://cutout-ethrome-2026.vercel.app) and the [manual test tutorial](../CUTOUT-MANUAL-TEST.md). Client: Fuji test AVAX, canonical test USDC and Tiramisu test GLM. Reviewer: Fuji test AVAX, valid class-7 credential and matching holder backup. Both need their own registered browser report keys. Swarm storage is included without an account.

A public read-only source-verification manifest cannot replace the matching proving artifacts needed to build another active deployment. Use the [deployment guide](DEPLOYMENT.md) for that operator path. Never copy private issuer/holder files into static hosting output.
