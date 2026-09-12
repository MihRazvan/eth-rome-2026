> **Current Cutout entrypoint:** [Quickstart](../cutout/QUICKSTART.md) and [deployment](../cutout/DEPLOYMENT.md). The current hosted app uses account-free Swarm gateway storage. This earlier runbook retains historical Swarm ID/setup assumptions; the local pilot commands also require the underlying qualification runtime first.

# Run and verify Review Pass

Node24.12+, Go1.25.7 selected by the module, Foundry1.5.1 and pinned `npm ci` dependencies. The existing qualification runtime supplies local Anvil31338 on18547 and Bee1633/1635. Do not restart it during a pilot: that resets the shared local chain. The original port18888 pilot and EXIT services are separate.

## Local product rehearsal

```sh
npm ci
QUALIFICATION_PILOT_DIR=.runtime/review-pass-judge node experiments/qualification/pilot/deploy-local.mjs
QUALIFICATION_PILOT_DIR=.runtime/review-pass-judge QUALIFICATION_PILOT_PORT=18889 node experiments/qualification/pilot/start.mjs
```

Open `http://127.0.0.1:18889`. The deployer uses only public Anvil development accounts and refuses another chain. It allocates a fresh credential slot rather than undoing revocation. Inspect `.runtime/review-pass-judge/pids.json` and the actual command before stopping only this server. Restarting the server rebuilds its UI and reloads its configuration.

In another terminal:

```sh
QUALIFICATION_PILOT_DIR=.runtime/review-pass-judge QUALIFICATION_PILOT_PORT=18889 node experiments/qualification/pilot/browser-test.mjs
node --import tsx --test experiments/qualification/pilot/journey.test.ts experiments/qualification/pilot/keys.test.ts experiments/qualification/pilot/terms.test.ts experiments/qualification/pilot/listings.test.ts experiments/qualification/pilot/settlement.test.ts experiments/qualification/pilot/swarm-id.test.ts
forge test --root experiments/qualification/contracts
```

The full browser test uses four isolated real Chromium profiles with explicitly injected Anvil wallets. It leaves two paid jobs and a permanently revoked credential; the configured old snapshot then correctly returns409. For another fresh rehearsal, redeploy locally and restart only18889. Do not reset the issuer or call this independent physical-device/extension-wallet testing.

After the lifecycle test, prepare a **new** local deployment as above and restart the owned server, then leave a real funded task available:

```sh
QUALIFICATION_PILOT_DIR=.runtime/review-pass-judge node experiments/qualification/pilot/seed-local-task.mjs --seed
# Repeating this must say REUSED with writes: 0.
```

This is actual local-chain funding and Bee storage, not an Arkiv listing. See [guarded seeding](local-task-seeding.md). The browser's private report keys must still be registered by each wallet. Do not run the full lifecycle test against a manual session in progress: it deliberately revokes its test credential.

Browser proving is built from the unchanged Go relation at server startup. The deployment must pin `setupDir` and `setupHashes`; mismatches fail startup. About 21 MB of public WASM/parameters are downloaded; the measured desktop Chromium flow took about 18 seconds including initialization. Internet/mobile timings are unverified. Cancellation, wallet changes and page exit terminate the worker; no server-side prover exists.

An opt-in public read-only storage check is `REVIEW_PASS_SWARM_LIVE_PROBE=1 node --import tsx --test experiments/qualification/pilot/swarm-id.test.ts`. Default tests skip its network-dependent case. It initializes the canonical identity iframe without signing in; it does not upload.

## Public Fuji preparation and deployment

```sh
node experiments/qualification/pilot/deploy-fuji.mjs --prepare
```

Preparation performs live read-only Fuji checks, builds the prover, creates a separate experimental Groth16 setup and compiles the deployable contracts. Artifacts live in ignored `.runtime/review-pass-fuji/`. `intent.json` records source/setup/circuit/bytecode hashes; `prepared.json` pins setup integrity. Existing inconsistent artifacts are rejected, not silently regenerated. A single-process setup is not a production ceremony.

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

Serve the generated manifest explicitly:

```sh
QUALIFICATION_PILOT_CONFIG=.runtime/review-pass-fuji/deployment.json QUALIFICATION_PILOT_DIR=.runtime/review-pass-fuji QUALIFICATION_PILOT_PORT=18889 node experiments/qualification/pilot/start.mjs
```

Stop the owned local18889 server first. For hosting, set `QUALIFICATION_PUBLIC_ORIGIN=https://your-exact-host` and put a TLS reverse proxy in front of loopback18889, preserving that Host header. This mode requires Fuji plus browser Swarm ID and exposes no signer/prover/secret endpoint. It is prepared hosting support, not an already hosted deployment. Keep the configuration/issuer runtime private; only the server's explicit public projection is served.

Clients need test AVAX, canonical test USDC, wallet-owned document keys and usable Swarm ID upload capability. Arkiv publication also requires the same client's wallet on Tiramisu7738577 with test GLM. Configure that wallet network explicitly if absent. Network switches invalidate the active session; reconnect the settlement wallet after publishing.

## Demo evidence sequence

1. Issuer supplies a qualification to a holder-local commitment and publishes the whole public snapshot. Holder selects credential and holder JSON on an open task and generates the proof in the browser. The files are read locally, not uploaded; the advanced local CLI remains available. See [qualification provisioning](QUALIFICATION-PROVISIONING.md).
2. Two clients register keys and fund different public scopes. Save funding receipts and the immutable manifest references/digests.
3. Publish an opportunity from its funding client's Arkiv wallet with a30block discovery lease and a much later escrow acceptance deadline. Save its entity key, creation tx and actual expiresAt.
4. Observe the same filtered query before/after native expiry, without a delete. Show that escrow remains funded. Use another listing for the actual acceptance flow. Record two real browser clients, relevant/irrelevant events and a dropped/reconnected socket for Mission03.
5. The same credential accepts two jobs with different scoped nullifiers. Submit different encrypted reports through usable public Swarm postage. An independent gateway returns bytes matching each worker's onchain digest; the wrong client cannot decrypt.
6. Revoke the credential and publish the new root/snapshot. A fresh acceptance must fail; already submitted work remains payable. Collect actual canonical-USDC balance changes and finalized receipts.
7. Export ciphertext and explicitly save a decrypted report. Keep public evidence only. A retained encrypted export still needs an authorized retained private device key; key loss is not solved by storage.

Private input repositories, standards interoperability, arbitrary cross-device key recovery and real issuer/client adoption remain outside this verified pilot. Recipient bindings are rechecked before upload and submission, but rotation after the final check while a wallet confirmation/transaction is pending is not atomically prevented by the escrow. Swarm postage/availability limits retention; revocation cannot erase old plaintext.

## Recover ciphertext without the application server

```sh
node experiments/qualification/pilot/retrieve-report.mjs --config .runtime/review-pass-judge/config.json --job 1 --out recovered-review.json
```

For Fuji, use its public deployment manifest and optionally `--gateway https://another-compatible-gateway`. The command reads the onchain report commitment at a finalized block, retrieves exact bytes directly, verifies the digest and writes the same encrypted export format as the app. It has no wallet or application API dependency and refuses to overwrite an existing output. The actual local probe retrieved from the separate Bee node on1635. This does not decrypt: retained recipient keys or an explicitly saved plaintext copy are still necessary.
