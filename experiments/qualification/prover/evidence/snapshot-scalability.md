# Public snapshot scalability — local measurement

Measured 12 September 2026 against prover source commit `5fabede97c79910ad2f9494afd06ed853003d353`. The benchmark calls the existing `buildState` implementation without changing the circuit, hash construction, prover, verifier or registry behavior. It is a native Go measurement on darwin/arm64 using Go 1.25.7, **not browser performance, network latency, proving time or an onchain benchmark**.

Reproduce inside the prover directory:

```sh
PROVER_SCALABILITY_EVIDENCE=evidence/snapshot-scalability.json go test -run '^TestSnapshotScalability$' -count=1 -v
```

The test skips unless explicitly enabled, so ordinary acceptance runs do not silently perform this workload. The JSON records the SHA-256 of `credential.go`, exact distribution, per-sample observations and memory accounting. Raw output is retained in `snapshot-scalability-output.txt`; generated full snapshots exist only in process memory and are not committed.

Each count uses three sequential reconstruction samples, with Go garbage collection before each. Revoked indices are unique and dispersed by the permutation `(i * 40503 + 17) mod 65536`, excluding holder index 42. This exercises shared and distinct branches; it is not a claim to represent every issuer distribution or the worst possible load. Every constructed private path was independently folded from a literal non-revoked leaf to the recorded root. Snapshot size includes the actual indented JSON layout and final newline used by the CLI. JSON decoding is measured separately.

| Revoked indices | Snapshot bytes | Reconstruction median | Sample range | JSON decode median | Cumulative Go allocations per reconstruction |
|---:|---:|---:|---:|---:|---:|
| 0 | 170 | 0.348 ms | 0.324–0.360 ms | 0.004 ms | 17,888–24,568 bytes |
| 100 | 1,253 | 19.899 ms | 19.586–20.002 ms | 0.023 ms | 850,328–850,352 bytes |
| 1,000 | 10,996 | 126.150 ms | 124.132–146.723 ms | 0.087 ms | 5,424,592–5,429,840 bytes |
| 10,000 | 108,468 | 794.670 ms | 786.282–868.398 ms | 0.737 ms | 34,389,144–34,431,472 bytes |

Allocations are the difference in `runtime.MemStats.TotalAlloc` before and after reconstruction. They represent cumulative allocation volume, **not peak resident memory or a retained 34 MB snapshot**. `goHeapAllocAfterBytes` is also recorded per sample, but garbage collection can occur during reconstruction; it is not a peak measurement. No per-case process RSS is claimed. Host contention was not isolated, and three observations do not establish a production latency percentile.

For this bounded desktop workload, hashing and tree reconstruction dominate JSON decoding. The authentication path remains sixteen elements; downloading and reconstructing the issuer-wide snapshot grows with revocation history. The implementation hashes each listed revoked leaf, walks sparse levels and can recompute a parent twice when both children are present. Caching default/leaf hashes or deduplicating parent work are plausible optimizations, but **none were applied in this measurement**. Do not extrapolate these observations to a million-slot registry, browser WebAssembly or remote proving.

## Allocation, reissue and registry lifetime

The CLI currently signs a supplied uint16 index; it does not maintain an issuer allocation database or reject a second issuance at an already-used slot. A successful qualification proof therefore assumes the issuer operates a correct registry. The following requirements remain outside the experiment:

- Allocate each new index atomically and durably under one issuer key. Two concurrent issuance processes must not give the same slot to different credentials. Persist the allocation before returning an issued credential, and define recovery after a signing-process crash.
- Treat revocation as a monotonic tombstone for that slot while any old credential could still be valid. Publishing a snapshot that omits a previously revoked index changes its status back to zero. That can revive an old unexpired credential; the circuit cannot infer the issuer meant a new credential.
- Reissue using a fresh slot and revoke the old slot. Issuing replacement terms or a new holder commitment at the old index makes both signatures share one revocation bit. It neither destroys the previous signature nor atomically invalidates it.
- Never reset this registry under the same issuer key while old credentials can remain valid. The signed message contains commitment, index, class and expiry, **but no separate registry-generation identifier**. A new all-clear root with the same key can make previous indices admissible again.
- A safe rollover with the current circuit requires a new issuer key and an explicit trusted-key transition, plus reissuance for holders who should remain eligible. Changing a key/root must not silently erase an already-earned payment obligation in the consuming product. Adding a signed registry generation instead would require a separately reviewed circuit/setup/integration change.

With permanent non-reuse, depth 16 bounds **lifetime issuance under a key to 65,536 slots**, not merely concurrent active credentials. Delayed reuse after all signatures at a slot have certainly expired is possible only with a durable, complete issuance/expiry ledger; the current CLI provides none. The clearest prototype policy is unique allocation, monotonic revocation, fresh-slot reissue and key rotation on exhaustion.

Root integrity is distinct from issuer honesty. `state --snapshot` verifies that the supplied revocation list computes to its stated root; the consuming contract must still authenticate the current root/key and reject stale state. Fetching a common public snapshot avoids transmitting a target path/index, but timing, issuer and network metadata remain observable. These benchmark results establish neither live sponsor integration nor privacy against a malicious issuer.
