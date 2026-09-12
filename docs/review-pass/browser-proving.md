# Browser-local qualification proving: feasible and executed

A real Chromium browser generated and locally verified the existing 26,089-constraint Groth16 qualification proof, with all nine public inputs matching the native fixture. This removes the need for a judge to install Go or run a proving CLI. It does **not** remove issuer enrollment, wallet funding, public deployment or Swarm postage requirements.

**Integration update:** browser-local proving is now in the product at `5ad9366`. A real20-check Chromium lifecycle generated a proof, simulated acceptance and settled it against the configured local verifier. Cancellation and account changes were exercised. See [integrated evidence](evidence/judge-pass/README.md). The original probe details below remain a separate evidence scope.

The original isolated feasibility probe used base `aefe7a2452c07f5566dda7dcd58f6b206981dc56`, not, by itself, evidence for integrated product behavior. No public-chain transaction was sent. The probe used explicitly public deterministic credential/holder fixtures and a fresh single-process test setup; no genuine holder secrets were exposed or used.

## Executed results

| Check | Actual result |
|---|---|
| Original full CLI compiled for `GOOS=js GOARCH=wasm` | Failed only at our Unix issuer-registry file-lock calls (`unix.Open`, `unix.Flock`, flags). |
| Isolated unchanged circuit/credential/native proof implementation | Compiled with Go 1.25.7, gnark 0.15.0 and gnark-crypto 0.20.1. No dependency changes. |
| Browser binary | 14,532,836 bytes uncompressed. Public setup adds 1,961,557-byte R1CS, 4,416,879-byte proving key and 620-byte verifying key. |
| Actual browser | Chromium 153.0.8010.12, local macOS ARM64 host, dedicated Web Worker. |
| First measured public setup load | 13.2 seconds including localhost fetch; 13.0 seconds Go setup deserialization. This excludes real internet transfer latency. |
| First measured proof | 4.26 seconds; local proof verification 9.1 ms; 40.9 MB Go allocated heap / 52.4 MB Go system memory. These are not whole-browser memory figures. |
| Output compatibility | 256-byte Solidity-format proof and identical nine public inputs versus the native fixture. A fresh setup changes proof bytes/verifier but not the relation. |
| Second job | A second context produced a different job nullifier. |
| Rejection checks | Wrong class, tampered snapshot root and unknown holder fields rejected. |
| Network boundary | Seven static GET requests only: page, worker, Go runtime, WASM and three public setup artifacts. No POST, credential identifier, secret or witness upload. |
| Browser exceptions | None. |

Durable machine-readable results: [Chromium evidence](../../experiments/qualification/browser-probe/evidence/chromium.json) and [build provenance](../../experiments/qualification/browser-probe/evidence/build.json). Exact timings vary; later reruns may differ from the first measurements above.

## Implementation and integration contract

`experiments/qualification/browser-probe/build.mjs` copies the existing Go module into ignored `.runtime/browser-probe/source`, renames the native CLI entrypoint, and adds the browser bridge. Circuit and credential files are copied byte-for-byte. Native issuer administration is unavailable in this build. The copied CLI is unreachable from the browser entrypoint. Generated binaries/setup files are ignored, not committed.

The classic worker has two messages, correlated by a caller-provided `id`:

```js
worker.postMessage({ id, action: 'initialize', setup: [r1csArrayBuffer, provingKeyArrayBuffer, verifyingKeyArrayBuffer] });
worker.postMessage({ id, action: 'prove', request: {
  holder, credential, snapshot,
  context: 'canonical job field', recipient: 'Ethereum address or decimal',
  deadline: 'Unix timestamp', class: '7'
} });
// Response: { id, result }; result is existing ProofOutput, or { error }.
```

`worker.js`, `wasm_exec.js` and `prover.wasm` resolve relative to the same worker URL directory. The worker's proof operation performs no network access. `initialize` downloads only WASM; its setup byte arrays come from the caller. Go reconstructs the private revocation path from the entire public issuer snapshot before proving. No issuer secret is present. Use the matching Go toolchain's runtime file; the build script selects Go from the module directory and preserves its license.

The judge flow can therefore be: select a funded assignment → import the provisioned credential and holder files locally → initialize the public prover → generate the proof → inspect wallet-bound acceptance → sign the transaction. Importing these files must never be implemented as a server upload. A production enrollment flow should create the holder secret locally, export a recovery copy and send only its commitment to the authorized issuer. The current probe intentionally does not implement enrollment or browser issuer administration.

## Integration checklist from the original probe

- Serve a narrow allowlist of **public** setup artifacts only. Never serve a setup/issuer/holder directory recursively. The prover key and verifying key are public; issuer private keys and holder files are not.
- Bind artifact hashes to the deployment manifest and generated verifier. Do not mix the probe's fresh setup with an existing deployed verifier. The integrated UI should independently compare proof public inputs to current chain/job/recipient state before offering a transaction.
- Add CSP `worker-src 'self'` and the narrowly scoped `'wasm-unsafe-eval'` script source. This probe runs under that policy; do not add general `'unsafe-eval'` or inline script exemptions.
- Load once per reviewer session and show useful phases: downloading public parameters, preparing local prover, generating proof, ready to accept. Keep computation in a worker so the UI stays responsive.
- Set bounded setup sizes, file sizes and operation timeouts. Terminate the worker on cancellation, disconnect, account/network change or page exit. Ignore stale results after any of those transitions.
- Clear file/proof references and terminate the worker after use as appropriate; do not promise memory zeroization from JavaScript/Go garbage collection. This code does not persist private material, but its host app must also avoid telemetry/logging of request objects.
- Provide a cancel/retry path. Large revocation sets can take much longer than this tiny snapshot; the accepted bound of 65,536 indices is a format bound, not a browser responsiveness guarantee.
- Validate the final integrated flow against its actual deployed verifier and wallet transitions. Test Chromium plus available Firefox/WebKit and representative mobile hardware before claiming browser compatibility.
- State honestly that the single-process Groth16 setup remains test-only and issuer credentials are test-issued. Browser execution does not add issuer reputation or a production setup ceremony.

## Reproduce

From the repository root, with existing Node dependencies and Go installed:

```sh
node experiments/qualification/browser-probe/build.mjs
cd experiments/qualification/prover
go build -o ../../../.runtime/browser-probe/native .
../../../.runtime/browser-probe/native setup --dir ../../../.runtime/browser-probe/setup --verifier ../../../.runtime/browser-probe/Verifier.sol
cd ../../..
node experiments/qualification/browser-probe/probe.mjs
```

The probe starts its own ephemeral loopback server and fresh Chromium process and closes both. It does not touch existing Anvil, pilot, Bee or public network services. It reads only the committed **public test** fixtures. Its generated Solidity proof is written under ignored `.runtime/browser-probe/browser-proof.json`; the timing/network report goes to `.runtime/browser-probe/evidence.json`.
