# Cutout — public deployment

[Docs](../README.md) · [Quickstart](QUICKSTART.md) · [Evidence](EVIDENCE.md)

## Active application

- Public Cutout: **https://cutout-ethrome-2026.vercel.app**
- Preserved original origin: **https://review-pass-ethrome-2026.vercel.app**
- Active source branch: **`review-pass/product`**
- Current application source at this documentation pass: **`57fff10`**. Later documentation-only commits do not change that deployed application.
- Deployment: **`dpl_GBXCpXne5U5ZopaUxCcDFQKyNHWy`**; [build/deployment records](evidence/saved-pass/README.md).

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

**Do not deploy the repository root to replace Cutout.** Root `vercel.json` belongs to the earlier EXIT application. Cutout uses a separate Build Output API directory, static frontend and Node function with read-only document routes plus the encrypted enrollment relay. Its Git auto-deployment is disconnected to avoid selecting the wrong app.

The public evidence manifest deliberately omits private/local paths and is not a standalone reproducible active-hosting config. A new operator must supply matching public setup artifacts or generate and deploy a separate verifier/setup; the old verifier cannot accept proofs from newly generated parameters. Never regenerate the existing issuer or setup to repair a missing file.

For a new project, contract preparation and explicit broadcasting steps remain in [the deployment runbook](../review-pass/RUNBOOK.md#public-fuji-preparation-and-deployment) and [hosting implementation guide](../../experiments/qualification/pilot/hosting/README.md). Those pages retain earlier setup history. The current active storage mode is the gateway adapter described here; their earlier requirement for every user to connect Swarm ID is superseded.

## Read-only deployment check

With Playwright Chromium installed:

```sh
node docs/design/cutout/verify-browser.mjs https://cutout-ethrome-2026.vercel.app .runtime/cutout-hosted-check
```

This checks public desktop/mobile UI and the explicitly simulated walkthrough. It does not sign, upload or establish paid completion. Use the [manual test](../CUTOUT-MANUAL-TEST.md) for the funded lifecycle and preserve its public receipts separately.
