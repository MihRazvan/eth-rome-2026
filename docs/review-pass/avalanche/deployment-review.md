# Fuji deployment and public configuration review

The reviewed deployment path has a clear prepare/broadcast boundary, pins canonical Fuji USDC and now records setup integrity, source provenance and a transaction journal. It is not yet evidence of a successful public deployment. Two integration corrections remained in the exact source captured below: the validator flag name and binding the validated metadata to the values subsequently deployed.

This review independently inspected root-written deployment/server code. The reviewer subsequently authored the requested public-metadata validator; its tests are implementation verification, not independent review of that validator. No source changes were made to the root checkout by this reviewer, and no prepare, deployment, faucet, upload or wallet operation was run.

## Reviewed source capture

September 12, 2026, root uncommitted source, after the integrator's first safety corrections:

| File | SHA-256 |
|---|---|
| pilot/deploy-fuji.mjs | `9d3c882151712e01d4443c43fa1d43e98fb9e6e635f093b80523db0bdf603822` |
| pilot/start.mjs | `254144d70927d15064c2f0536a02b997044e68625a347ad79a2fa9fbc5b94461` |

Later changes require rechecking; observations below should not be read as assertions about an uninspected later version.

## Findings and corrections

**D1 — Setup files were not pinned across preparation and broadcast.** The first inspected revision recomputed current setup hashes for its intent, but only compared the Solidity verifier source against preparation. Replacing a proving key, verifying key or constraint system could pass the guard and leave public proving artifacts incompatible with the deployed verifier. The captured revision now persists and checks all four setup artifact hashes and circuit/dependency hashes. An executable extraction of the exact guard rejected four separate setup-file hash changes and one circuit hash change. This verifies the comparison logic, not a complete corrupted-file deployment rehearsal.

**D2 — Public metadata lacked cryptographic and schema validation.** Initial guards allowed any positive field-sized issuer coordinates and snapshot root, including off-curve `(1,1)` and a snapshot containing only `{"root":"1"}`. Retrieving matching bytes from Swarm cannot establish that their root can be reconstructed. New validator commit `70fd9b3` checks strict public schemas, bounded input, canonical scalar encodings, a nonidentity prime-order issuer point, ordered unique depth-16 revocations and reconstructed MiMC root. It emits public hashes and values only. The validator proves neither control of the issuer signing key nor authorship/freshness of the snapshot; those remain explicit operator/issuer responsibilities.

**D3 — Validator invocation mismatch remains in captured revision.** Deployment passes `validate-public --issuer`, while the implemented command accepts `--issuer-public`. This fails closed before signing but prevents broadcast. Replace the flag and execute the actual public-only command as a preflight regression.

**D4 — Metadata can change between validation and use.** The script reads issuer JSON before invoking validation, then rereads the snapshot after validation. If either supplied file changes, the constructor or downloaded snapshot can differ from the validated bytes. This is an operator/concurrent-file race, not a remote wallet exploit. Parse validator stdout; use its validated issuer coordinates/root and compare its raw-file SHA-256 values to the exact in-memory input bytes used for download and deployment. Alternatively validate immutable copied public inputs. Any mismatch should stop before the first transaction.

**D5 — Concurrent broadcast journal creation was not exclusive.** The initial existence check followed by ordinary file creation allowed two processes to pass the check and overwrite the journal. The captured revision now creates an operation lock using exclusive `wx` and creates the broadcast journal using `wx`. Both are before the first send. It rejects an existing or partial deployment instead of automatically resending. Abrupt termination can leave a stale lock; manual diagnosis is preferable to silently assuming an unfinished broadcast never occurred. Journal updates are ordinary writes; a crash can leave incomplete JSON, so recovery may require inspecting the signer nonce and explorer rather than trusting an incomplete journal.

**D6 — Ambiguous modes and source attribution improved.** The captured script accepts exactly one of `--prepare` and `--broadcast`, records source hashes and an explicit dirty-source flag in addition to HEAD, and captures deployed runtime code hashes and authority readbacks. This prevents a clean commit identifier from being the only description of uncommitted compiled work. The root is responsible for its actual preparation/build result and for publishing coherent source before public release.

## Configuration and live-write safety

Prepare mode exits before required signer configuration, account construction and transaction sending. It performs public network reads and local build/setup writes; it is not an offline command. Broadcast requires explicit project key, issuer-public file, snapshot file/reference and arbitrator. The RPC must be HTTPS without username/password/query credentials, report chain 43113, and expose the canonical token with six decimals. There is no fallback to Anvil keys or DemoUSD.

Before sending, it independently retrieves snapshot bytes and checks their SHA-256; this exercises retrieval, not creation or funded retention. A nonzero finalized AVAX balance is required, but the script does not establish that the balance funds all three deployments. A low balance or changing gas price can leave a partial deployment. The journal supports honest reporting of that state; aggregate gas estimation would improve readiness but is not itself a funding guarantee.

The generated manifest matches the server's Swarm ID retrieval mode and names escrow/token/verifier/issuer/arbitrator. Startup checks the chain, canonical Fuji token, six decimals and those escrow authority getters. Browser storage owns public-mode uploads; the server has no transaction signer. The server remains bound to loopback with an exact Host check, so this does not constitute a hosted public website.

Configuration hardening remains advisable: enforce Fuji 43113 with `environment: fuji-testnet` and `storageMode: swarm-id`, and local 31338 with `environment: local-pilot`. Current source accepts mixed environment/storage flags, although its generated Fuji manifest does not produce them. Such manual mixtures can label a local storage route as a public integration or select inappropriate upload behavior.

Setup files are public proving artifacts, not private credentials, but distributing them remains necessary for a fresh reviewer to use the Fuji verifier. The manifest's local `setupDir` is not a download mechanism. Keep the single-process experimental setup disclosure visible; publishing a hash does not turn it into a production ceremony.

## Actual checks

- `node --check` passed for deploy-fuji.mjs and start.mjs. This does not execute imports, build contracts or verify runtime service compatibility.
- Exact extracted setup-integrity guard: four changed setup hashes and one changed circuit hash rejected; matching hashes accepted.
- Validator full Go suite passed after implementation (3.57 seconds). Four new tests cover valid/native keys, empty and populated trees, invalid/off-curve/identity/small-order keys, malformed roots/indices/schema, duplicate/case-alias/unknown fields, input size, public-only output and read-only inputs.
- Actual `go run . validate-public --issuer-public ... --snapshot ...` accepted the existing public test issuer and snapshot, returning depth 16 and one revoked index. Only public files were read; this was not an issuer-signing or deployment operation.

The initial attempt to write the Go files used the wrong workdir-relative paths and wrote nothing; its passing Go run was therefore only the old baseline. Corrected writes were followed by a fresh full Go run and the actual validator command above. No failed or unrun public check is represented as passed.

## Closure check on the revised deployment path

The reviewer rechecked root source after the integrator's remaining corrections. Capture at root HEAD `04ac2599f540fb97b6d4140604eef98e6d9b0149` (working-tree hashes remain the precise scope):

| File | SHA-256 |
|---|---|
| pilot/deploy-fuji.mjs | `4bfa5e92dfb5250665f935511f704347f3f7912b8dfb69da265c87fc8d65034b` |
| pilot/start.mjs | `35b54167d0fb9663c8ee149a2c048307f8f5852c65de3f51758d1b4a003548de` |

**D3 is closed in source:** deployment invokes the implemented `--issuer-public` flag and checks the validator's explicit success status. **D4 is closed in source and its byte check was exercised:** constructor issuer coordinates and root now come only from validator stdout; the reread snapshot's SHA-256 must equal the validator's hash before retrieval or signing. An executable extraction of the exact hash guard accepted identical bytes and rejected an altered root document. The former independently read issuer JSON is absent.

The server now enforces Fuji/public-environment/Swarm-ID consistency and local-chain/local-environment consistency. Exact extracted configuration guards accepted the two intended configurations and rejected four mismatches, including a wrong network. Fuji token identity remains independently restricted. The source additionally supports an explicitly configured HTTPS reverse-proxy origin while retaining a loopback listener; this is hosting capability, not evidence of a hosted deployment. Earlier statements about an exclusively local application URL describe the earlier capture only.

`node --check` passed again for both files. The reviewer read the integrator-produced preparation intent and independently recomputed all four setup file hashes; they matched the recorded values. The integrator reports its actual `--prepare` and integrated Go suite passed. This reviewer did not rerun preparation or broadcast and does not infer public deployment from those artifacts.

Residual operational limits remain explicit. A nonzero finalized AVAX balance does not establish enough gas for all three deployments, so the sequence can stop after partially spending test funds. Gas estimation or an upfront budget would improve this experience but cannot guarantee future fee conditions. The existing journal and exclusive lock intentionally prevent blind automatic replay; partial or interrupted deployment requires manual receipt/nonce inspection. Journal updates are not a crash-consistent recovery protocol. Public Swarm write access, setup distribution to reviewers and an actual funded Fuji lifecycle still require their own evidence.
