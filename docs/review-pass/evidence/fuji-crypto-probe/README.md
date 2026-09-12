# Actual browser proof verified on Fuji — read-only cryptographic probe

**Passed on 12 September 2026.** Chromium generated a real qualification proof from the authorized, operator-issued private test credential and its holder secret. The deployed Fuji verifier accepted the resulting proof through `eth_call`; changing its recipient caused rejection. No wallet signature or transaction was used.

This is **not a funded escrow acceptance or end-to-end product demonstration**. The test deliberately uses an unfunded synthetic assignment ID (`nextJob + 1,000,000`) and synthetic recipient `0x000000000000000000000000000000000000cafe`. Its context comes from the actual deployed escrow's `contextFor` view, binding the proof to the real Fuji chain and escrow domain. The verifier validates cryptography; acceptance by the escrow would additionally require a funded open task and its state checks.

- Verifier: [`0x9c1293e7e499d56fdc52186e7624dcfa04dfcbd1`](https://testnet.snowtrace.io/address/0x9c1293e7e499d56fdc52186e7624dcfa04dfcbd1)
- Escrow domain: [`0xb431e570d506168711cc1f9f91e325b3114c62af`](https://testnet.snowtrace.io/address/0xb431e570d506168711cc1f9f91e325b3114c62af)
- Browser parameter initialization: **13.19 seconds** over localhost.
- Browser proof: **4.40 seconds**, 26,089 constraints, 256-byte Solidity encoding.
- Deployed verifier call: **146 ms** in this run; changed recipient rejected.
- The verifier runtime code hash and all three proving-parameter hashes matched the deployment manifest.
- The whole public snapshot root matched the escrow's root at the pinned finalized block. Issuer coordinates and public proof context also matched chain reads.

Exact block number/hash, build hashes, memory measurements, HTTP request log and scope are in [result.json](result.json). The public cryptographic presentation is in [public-proof.json](public-proof.json). These are safe public evidence: no holder secret, reusable holder commitment, credential index, private witness, credential document, issuer key or wallet key is included.

The operator files were loaded through the local Playwright control channel into an isolated Chromium worker. The HTTP server's allowlist contained only the page, worker/runtime/WASM and three public setup artifacts. All seven server requests were GETs without bodies. No private files were exposed as routes, logged, copied into this directory or sent to the Fuji RPC. Only the final public proof and public inputs were sent to the verifier. This harness is separate from the application's file-picker UX.

## Replay without any private inputs

From the repository root, with existing Node dependencies:

```sh
node docs/review-pass/evidence/fuji-crypto-probe/verify-public.mjs
```

This rechecks the pinned block hash and verifier runtime code, then repeats valid-proof acceptance and changed-recipient rejection. It only reads public chain state. Successful replay is not a new transaction or renewed credential validity claim; it reproduces cryptographic verification at the recorded block.

## Regenerate with authorized operator test inputs

```sh
node experiments/qualification/browser-probe/build.mjs
REVIEW_PASS_OPERATOR_ROOT=/absolute/path/to/operator/checkout node docs/review-pass/evidence/fuji-crypto-probe/probe.mjs
```

The operator checkout must contain the actual `.runtime/review-pass-fuji/deployment.json`, matching public setup, and the explicitly provisioned `rehearsal/holder.json`, `rehearsal/credential.json` and `public/snapshot.json`. The script never reads issuer or wallet keys. Missing/expired credentials, stale snapshots, setup mismatch, failed proving or rejected verification fail the run; there is no fixture or native/server-prover fallback. A new run changes proof randomness, the pinned block and measurements. The Groth16 setup and issuer remain explicitly test-only.

Source base: `a9d0181640148523b2b9ecbb160fbab76f2455a0`. No production code, shared configuration, deployed contracts or running product services were changed by this probe.
