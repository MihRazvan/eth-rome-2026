# Deaddrop — public deployment

[Docs](../README.md) · [Quickstart](QUICKSTART.md) · [Evidence](EVIDENCE.md)

## Active application

- Public Deaddrop: **https://cutout-ethrome-2026.vercel.app**
- Preserved original origin: **https://review-pass-ethrome-2026.vercel.app**
- Active source branch: **`main`**
- Current application source at this documentation pass: **`8afc0e7`**. Later documentation-only commits do not change that deployed application.
- Deployment: **`dpl_61mGwgZyBDWUEbrfJF7bKUsjmuBw`**; [build/deployment records](../design/deaddrop/evidence/README.md).

Keep an existing participant on the hostname/profile where they registered their document key. The two aliases serve the same product, but browser key storage is origin-specific. A new hostname cannot recover another origin's private key.

## Networks and contracts

| Resource | Configuration |
| --- | --- |
| Settlement chain | Avalanche Fuji C-Chain, ID `43113` |
| Fuji public RPC | `https://api.avax-test.network/ext/bc/C/rpc` |
| Discovery chain | Arkiv Tiramisu, ID `7738577` |
| Arkiv HTTP | `https://rpc.tiramisu.db-chain.testnet.arkiv.network` |
| Arkiv WebSocket | `wss://rpc.tiramisu.db-chain.testnet.arkiv.network` |
| Document gateway | `https://api.gateway.ethswarm.org` |
| Active storage mode | `swarm-gateway`, gateway-funded postage, no customer Swarm ID |

| Contract | Fuji address |
| --- | --- |
| Escrow | `0xb431e570d506168711cc1f9f91e325b3114c62af` |
| Groth16 verifier | `0x9c1293e7e499d56fdc52186e7624dcfa04dfcbd1` |
| Document keys | `0x181db4e48a0e76fdc50101085ac3b831464792c1` |
| Canonical test USDC, 6 decimals | `0x5425890298aed601595a70AB815c96711a31Bc65` |
| Team root-update authority / test arbitrator | `0xB9080458DE79F614DB5d5208AB31bbF22A33DeAd` |

[Deployment manifest and finalized receipts](../review-pass/evidence/fuji-rollout/deployment.json) · [Source verification results](../review-pass/evidence/fuji-rollout/source-verification.json). The original rollout README is a dated record; its then-pending storage/funding gates do not describe today's active deployment.

Public configuration is available at [/api/config](https://cutout-ethrome-2026.vercel.app/api/config). The [whole public status snapshot](https://cutout-ethrome-2026.vercel.app/api/snapshot) is checked against the current finalized issuer root. Task scope and report reads are derived from their actual escrow commitments. These document/config endpoints do not issue credentials or receive holder secrets. The separate `/api/enrollment` endpoint queues signed, encrypted applications on Arkiv using a dedicated gas relay key. The issuer approves offline and the browser collects the encrypted response. [Qualification service](QUALIFICATION.md).

## Build and deploy the existing project

This is the authorized operator route, not required for a judge to try the app. It requires the existing verified Fuji manifest and matching **public** proving artifacts on disk. The credential signing key remains offline and must never enter Vercel output. The separate Arkiv gas relay key is a production Secret named `CUTOUT_ENROLLMENT_RELAY_KEY`, never a frontend environment variable.

```sh
forge build --root experiments/qualification/contracts
node experiments/qualification/pilot/hosting/build.mjs --config .runtime/review-pass-fuji/deployment.json
vercel deploy --prebuilt --prod --cwd .runtime/review-pass-vercel --scope mihrazvans-projects
```

Run from the repository root after installing pinned dependencies, Go and Foundry. Compiling contracts supplies the ABIs consumed by the hosting builder. Use the configured, already linked Vercel project. The builder checks chain identity, deployed code, authorities, snapshot integrity and setup hashes before writing `.runtime/review-pass-vercel/.vercel/output`. It copies only allowed public artifacts. A stale/missing live dependency is a build error.

**Deploy the prepared Build Output API directory.** A plain static UI build does not contain the configured API or matching proof artifacts. The prepared output contains the frontend and Node function with read-only document routes plus the encrypted enrollment relay. Git auto-deployment is disconnected; use the explicit build and deployment commands above.

The public evidence manifest deliberately omits private/local paths and is not a standalone reproducible active-hosting config. A new operator must supply matching public setup artifacts or generate and deploy a separate verifier/setup; the old verifier cannot accept proofs from newly generated parameters. Never regenerate the existing issuer or setup to repair a missing file.

The [hosting implementation guide](../../experiments/qualification/pilot/hosting/README.md) documents the build inputs and public output boundary. The current active storage mode is the account-free gateway adapter.

## Read-only deployment check

With Playwright Chromium installed:

```sh
node docs/design/deaddrop/verify-browser.mjs https://cutout-ethrome-2026.vercel.app .runtime/deaddrop-hosted-check
```

This checks public desktop/mobile UI and the explicitly simulated walkthrough. It does not sign, upload or establish paid completion. Use the [manual test](TESTING.md) for the funded lifecycle and preserve its public receipts separately.

## Reproduce the existing hosted build

With Node24.12+, Go1.25.7 and Foundry1.5.1 installed, run `npm ci` and `npm run build:hosting`. The wrapper retrieves the existing **public** proving artifacts from the hosted app, checks their pinned hashes from the [public deployment manifest](../../deployments/fuji.json), compiles contracts and runs the verified active build. It does not create a new setup or require credential/holder secrets. The exact deployed verifier remains authoritative.

This produces `.runtime/review-pass-vercel/.vercel/output` and `.vercel/output`. Use the prebuilt deploy command above with the configured project. Automatic source builds additionally need Go/Foundry available; the project remains disconnected from automatic Git builds. An unavailable or mismatched public artifact fails the build rather than substituting fixtures.

## Deploy a separate Fuji instance

```sh
node experiments/qualification/pilot/deploy-fuji.mjs --prepare
```

For a separate instance, use a fresh checkout: the script deliberately uses `.runtime/review-pass-fuji/` relative to the checkout. Never overwrite the existing deployed setup. Preparation performs live read-only Fuji checks, builds the prover, creates a separate experimental Groth16 setup and compiles the deployable contracts. Artifacts live in ignored `.runtime/review-pass-fuji/`. `intent.json` records source/setup/circuit/bytecode hashes; `prepared.json` pins setup integrity. Existing inconsistent artifacts are rejected, not silently regenerated. A single-process setup is not a production ceremony.

Before broadcasting, configure these existing project resources privately in the process environment:

| Variable | Required value |
|---|---|
| `FUJI_PRIVATE_KEY` | Authorized project deployment signer with enough test AVAX for all three deployments; do not put it in shell history, Git or chat |
| `QUALIFICATION_ISSUER_PUBLIC` | Path to the issuer's **public** registry JSON, never issuer-private.json |
| `QUALIFICATION_SNAPSHOT_FILE` | Path to its whole public snapshot JSON |
| `QUALIFICATION_SNAPSHOT_REFERENCE` | Actual64hex reference for those exact snapshot bytes on public Swarm |
| `QUALIFICATION_ARBITRATOR` | Intended nonzero arbitration wallet |
| `FUJI_RPC_URL` | Optional HTTPS public Fuji endpoint without embedded credentials |
| `SWARM_RETRIEVAL_URL` | Optional independent HTTPS public retrieval gateway |

The deployment signer becomes the escrow's root-update issuer authority. The credential signing key is separate. The deployer validates issuer curve/subgroup membership and reconstructs the snapshot root without a holder credential. This validates the public data structure, not issuer identity, key possession or commercial authorization.

```sh
node experiments/qualification/pilot/deploy-fuji.mjs --broadcast
```

This is the write command. It uses canonical Circle Fuji test USDC `0x5425890298aed601595a70AB815c96711a31Bc65`, waits for finalized receipts and checks deployed authorities. Its exclusive operation lock and transaction journal prevent blind concurrent/resumed sends. A partial deployment needs receipt inspection and deliberate recovery; the script does not automatically resume or discard the journal. A nonzero gas balance is only a prerequisite, not a guarantee that all deployments can finish. Test USDC has no monetary value or fiat backing.


After deployment, build and host using its generated manifest and matching public artifacts. Configure the separate encrypted enrollment relay for the exact deployed origins. The [qualification guide](QUALIFICATION.md) describes manual approval and private operator custody.
