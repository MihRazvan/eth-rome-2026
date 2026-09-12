# Qualification prover — bounded local experiment

This is a real gnark BN254 Groth16 circuit, with a generated Solidity verifier and actual proof fixtures. It combines issuer EdDSA authentication, holder-secret knowledge, exact qualification class, credential expiry, a non-revoked status at the **same signed index**, and job/recipient-bound public outputs. It is an independently implemented prototype informed by [ShadowPath](https://arxiv.org/abs/2608.19937), **not a ShadowPath reproduction**: the earlier artifact-host request returned 403.

Pinned dependencies: gnark v0.15.0, gnark-crypto v0.20.1 and Go 1.25.7, isolated in this directory's `go.mod`/`go.sum`. Standard gnark gadgets implement the cryptography; no new primitive is claimed. Relevant primary sources are [gnark EdDSA](https://github.com/Consensys/gnark/blob/v0.15.0/std/signature/eddsa/eddsa.go), [BN254 MiMC](https://github.com/Consensys/gnark-crypto/blob/v0.20.1/ecc/bn254/fr/mimc/mimc.go), [Groth16 Solidity export and serialization](https://github.com/Consensys/gnark/blob/v0.15.0/backend/groth16/bn254/solidity.go), and [the pinned dependency manifest](https://github.com/Consensys/gnark/blob/v0.15.0/go.mod). Generated verifier attribution and license are preserved.

## Run

Run inside `experiments/qualification/prover`:

```sh
go build -o qualification-prover .
go test -count=1 -v ./...
./qualification-prover setup --dir .local/setup --verifier artifacts/QualificationVerifier.sol
./qualification-prover test-credential --out fixtures/credential.json --holder-out fixtures/public-test-holder.json --public-deterministic-test
./qualification-prover snapshot --revoke 1,99,65535 --out fixtures/snapshot.json
./qualification-prover state --snapshot fixtures/snapshot.json --credential fixtures/credential.json --out fixtures/private-test-state.json
./qualification-prover prove --setup .local/setup --credential fixtures/credential.json --holder fixtures/public-test-holder.json --state fixtures/private-test-state.json --context 12345 --recipient 0x000000000000000000000000000000000000cafe --deadline 1900000000 --class 7 --out fixtures/valid-proof.json
```

**Setup regeneration changes the verification key.** Regenerate verifier and all proof fixtures together, then update any deployed consumer. `.local/setup` is ignored and contains the compiled R1CS, public proving/verifying keys and setup metadata. The setup uses fresh randomness in a single process. There was no trusted-setup ceremony, no independently verified destruction of setup secrets and no production security claim. Do not use these fixtures, issuer seeds or holder secret for any real credential.

The checked-in fixture issuer seed and holder secret are deliberately public, deterministically derived from explicit test strings. Credential JSON itself never serializes the holder secret. `fixtures/public-test-holder.json` is a separate, deliberately disclosed dummy witness. `private-test-state.json` is also deliberately disclosed test witness data, not a public snapshot format. Do not copy that handling into a real enrollment or transport flow.

## Split enrollment

A holder can create its secret locally. The issuer needs only the commitment:

```sh
./qualification-prover holder-new --out .local/holder.json
./qualification-prover issuer-new --out .local/issuer-key.json
# Pass ONLY holderCommitment from the holder file to the issuer, not holderSecret.
./qualification-prover issue --issuer-key .local/issuer-key.json --commitment DECIMAL_COMMITMENT --index 42 --class 7 --expiry 2000000000 --out .local/credential.json
```

`issuer-new` and `holder-new` use OS randomness. Secret-bearing files are created with mode 0600; the issuer file is never committed or logged. `issue` has no holder-secret parameter. In a product the holder should keep the secret client-side; this CLI runs locally and is not a remote proving service. The issuer must allocate each index correctly, authenticate who receives a qualification, and publish authentic current roots. These operational checks are outside this circuit. It provides neither proof of unique humanity nor protection from a deliberately malicious issuer.

## Public snapshot and private path

`snapshot --revoke 1,99,65535 --out snapshot.json` emits exactly `version`, `depth`, `root`, and `revokedIndices`. It contains no requested credential index or authentication path. Any holder downloads the same issuer-wide snapshot, then uses `state --snapshot snapshot.json --credential local-credential.json --out local-state.json` to reconstruct its private path and verify the advertised root. Full snapshot publication is appropriate only for this depth-16 bounded experiment. Root equality is an integrity check against the supplied list, **not authentication of the publisher**. The contract must trust its configured issuer and root update authority.

The registry has 65,536 positions. Leaves encode status only: zero means not revoked, one means revoked. Initially unissued positions also have status zero; only an issuer signature makes a position a credential. Status witnesses cannot replace the signed index: the exact same 16 private bits select every Merkle branch and appear in the signed message. A revoked leaf at index 42 cannot be bypassed with an unrevoked path from index 43.

## Exact field encoding and relation

The scalar field is `21888242871839275222246405745257275088548364400416034343698204186575808495617`. Public decimal and `0x` inputs must be canonical nonnegative values below it; this CLI never silently reduces a job context. The integrator computes the interface's ABI-encoded Keccak job context and reduces it before calling the CLI.

`H(label, values...)` is gnark-crypto v0.20.1 BN254 MiMC (110 rounds), resetting the hash for each call. The first field element is the big-endian ASCII integer of `label`; subsequent field elements are serialized as exactly 32-byte big-endian canonical scalars. Input tuple lengths are fixed per domain:

| Value | Exact hash inputs after domain |
|---|---|
| Holder commitment | `QUAL_V1_HOLDER`, secret |
| Signed message | `QUAL_V1_CREDENTIAL`, holder commitment, index, class, credential expiry |
| Status leaf | `QUAL_V1_STATUS`, status bit |
| Parent | `QUAL_V1_NODE`, left child, right child |
| Nullifier | `QUAL_V1_NULLIFIER`, secret, job context |
| Presentation tag | `QUAL_V1_PRESENTATION`, secret, job context, recipient, proof deadline |

The issuer signs the 32-byte canonical signed-message hash with gnark's **BN254-native twisted-Edwards EdDSA and MiMC**. This is not Ed25519 or an Ethereum wallet signature. The circuit checks the issuer key and signature point are on curve, the issuer key is nonidentity and in the prime subgroup, and uses gnark's strict signature scalar verification. An explicit constant double-and-add subgroup check avoids the generic scalar gadget's prime-subgroup input assumption. The initial attempt to use generic multiplication by the subgroup order hit a half-GCD hint division-by-zero; it was replaced, not removed.

Holder secret is nonzero and at most 248 bits; index is 16 bits; class and required class are 32 bits; both expiries are unsigned 64-bit; recipient is nonzero uint160. The circuit requires signed class = required class and credential expiry >= proof deadline. It has no clock: the consuming contract checks current block time <= deadline.

## Solidity ABI and public ordering

The actual generated contract is named `Verifier`. Its integration entrypoint is:

```solidity
function verifyProof(bytes calldata proof, uint256[9] calldata input) public view;
```

It returns no value; invalid proofs or out-of-field public inputs revert. `artifacts/verifier-abi.json` is the minimal integration ABI. The exported contract also contains auxiliary compression functions; callers do not need them.

Public inputs are exactly: issuer X, issuer Y, root, required class, proof deadline, job context, recipient, job-scoped nullifier, presentation tag. The order follows the nine public struct fields and is checked at proof generation. A proof fixture contains `proof` (0x hex), `publicInputs` (nine decimal strings), names and measured statistics. Its uncompressed proof is 256 bytes: `Ar.X | Ar.Y | Bs.X1 | Bs.X0 | Bs.Y1 | Bs.Y0 | Krs.X | Krs.Y`, eight 32-byte big-endian limbs from gnark's `MarshalSolidity()`.

Nullifier deliberately excludes recipient/deadline. Changing either requires a new proof and presentation tag, but keeps the same per-secret/per-job nullifier. It is not a per-human nullifier. A byte-identical proof remains valid under a stateless verifier: the settlement contract must atomically consume its job/nullifier. It must independently compare issuer key, current root, class, context, recipient and deadline against its configured state. A stale root cannot be made acceptable merely by passing it as proof input.

## Evidence and limitations

The circuit has 26,089 constraints. The first passing real proof observed ~75 ms proving and ~0.77 ms verification after setup/load, with a 256-byte Solidity proof; the exported fixture observed ~84 ms/~0.82 ms. These are single-host observations, not browser or production benchmarks. JSON fields `goHeapAllocBytes` and `goSysBytes` are Go runtime accounting, not process peak RSS. `python3 capture.py` captured 714.164 ms wall including key/R1CS loading, 55,164,928 bytes peak process RSS, 76.493 ms internal proving and 0.792 ms internal verification. The recorded suite contains five top-level tests and 25 table subtests, all passing; see `evidence/measurements.json` and raw process outputs. These numbers are one local sample, not a throughput or scalability claim.

Tests reject forged signer signatures, wrong holder secrets with recomputed tags, class and expiry mismatches, revoked leaves, path/index substitutions, out-of-range values, identity issuer keys and public context/recipient/nullifier/tag changes. Real Groth16 verification rejects mutation of each of the nine public inputs. Two freshly generated valid proofs with different recipients/deadlines preserve the job nullifier. Both are retained as `fixtures/valid-proof.json` and `fixtures/valid-second-recipient-proof.json`, generated against the same exported verifier. Credential serialization is tested not to include the holder secret.

No live credential authority, Arkiv, Swarm, ENS, Fuji or browser proof-generation result is claimed here. The proof hides the witness, but public issuer/class/root/deadline/job/recipient still disclose metadata. Registry updates, network access patterns, distinctive classes/expiry choices, malicious issuers, shared holder secrets and public payouts can create links. Local credential paths should not be sent to an origin service merely to ask for a public snapshot. This implementation is a bounded feasibility experiment requiring independent review and a production setup strategy before any real use.
