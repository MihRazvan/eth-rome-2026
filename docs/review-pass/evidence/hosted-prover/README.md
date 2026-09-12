# Hosted browser prover — verified on the public product origin

**Passed on 12 September 2026 at [the production app](https://review-pass-ethrome-2026.vercel.app).** A fresh Chromium instance downloaded the real hosted worker, Go runtime, WASM and deployment-matched parameters, retrieved the current issuer snapshot through the real API, generated a proof locally using the authorized operator-issued test credential, and verified it against the deployed Fuji verifier with a read-only call.

This proves the **hosted proving path**, not funded escrow acceptance or the complete judge journey. The harness uses an explicitly unfunded synthetic job (`nextJob + 2,000,000`) and synthetic recipient `0x000000000000000000000000000000000000cafe`. It uses the actual escrow's context domain and issuer state. No wallet transactions, issuer administration or production deployment actions occurred.

## Actual results

| Check | Result |
|---|---|
| Browser / origin | Fresh Chromium 153.0.8010.12 on the real production HTTPS origin. |
| Public configuration | `status: active`; chain 43113; verifier and escrow match the deployed manifest. |
| Hosted artifact integrity | R1CS, proving key, verifying key, worker JS, Go runtime and WASM hashes/lengths matched the actual public build inventory. The three parameter hashes also matched the deployment manifest. |
| Worker CSP | Actual response: `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'`. Worker started and instantiated WASM successfully; the page retained its stricter script policy. |
| Snapshot | Actual `/api/snapshot` JSON content matched independently fetched Swarm bytes. Original 170-byte document SHA-256 matched the configured reference; root matched the finalized escrow root. |
| Hosted worker initialization | **13.50 seconds**, after initial asset-integrity downloads. This is not total first-page load time. |
| Browser proof | **4.40 seconds**, 26,089 constraints, 256-byte Solidity proof. Go allocated heap about 40.9 MB; not whole-browser memory. |
| Actual Fuji verifier | Accepted through `eth_call` at pinned finalized block **58,333,805**. Modified recipient rejected. Runtime code hash matched the deployment manifest. |
| Browser errors | **0** console errors, **0** page exceptions, **0** failed requests in the successful run. |
| Privacy check | **0** observed outgoing HTTP URLs/bodies contained the holder secret, reusable commitment or credential signature. None were written to evidence. |
| Transactions | **0**. |

The application also loaded its normal public RPC discovery and Swarm ID iframe resources. The 89 observed requests are recorded without body contents or query strings in [result.json](result.json); this is not a claim that the whole application makes only GET requests. Private test files entered the page through the local Playwright control channel and reached only the worker via `postMessage`. The final public proof was sent to the Fuji verifier. This probe did not read issuer or wallet keys.

[Public proof](public-proof.json) contains only the normal public presentation and public inputs. [Exact evidence](result.json) includes artifact hashes, response CSP/MIME headers, snapshot hashes, pinned block and browser/network results. The build inventory reported source revision `427018d8fe276042702c9f3614bbc6fff2ca2866`; that is the reported Git HEAD, not a claim that the build tree was clean. Served artifact hashes provide the exact byte identity checked here. The probe itself started from that same explicit base.

## Reproduce the public verification without private files

```sh
node docs/review-pass/evidence/hosted-prover/verify-public.mjs
```

This independently rechecks the pinned block and deployed verifier bytecode, then confirms public-proof acceptance and changed-recipient rejection. It requires no operator checkout, credential, secret, wallet or transaction. This public replay passed after the browser run.

To regenerate a proof using specifically authorized operator test inputs:

```sh
REVIEW_PASS_OPERATOR_ROOT=/absolute/path/to/operator/checkout node docs/review-pass/evidence/hosted-prover/probe.mjs
```

The operator checkout must contain the actual deployment manifest, public build inventory, and explicitly provisioned private test credential/holder files. The script refuses inactive hosting, mismatched artifacts, unavailable snapshots, expired credentials and rejected proofs. It uses no local fixture, replacement worker, network interception, CSP bypass or server prover. Successful output overwrites this directory's public result/proof files; failures preserve sanitized diagnostics.

## First probe correction and minor observation

The first run stopped before worker initialization because the harness incorrectly expected `/api/snapshot` to preserve Swarm's original JSON whitespace. The API intentionally returns verified parsed JSON: 152 serialized bytes, versus the original 170 bytes. [The original assertion failure](initial-snapshot-assertion.json) is preserved. The corrected probe independently hashes the original gateway bytes and compares parsed content against the API; both checks passed. No fixture or integration fallback was introduced.

Vercel served `.key` artifacts as `application/vnd.apple.keynote`. Fetching their raw bytes worked and hashes matched. Explicit `application/octet-stream` overrides would improve metadata correctness; this did not block proving.
