# Durable pilot issuer registry

This registry replaces caller-selected indices for the test/pilot issuance path. It signs holder commitments using the existing BN254-native EdDSA credential format and reserves unique slots in a private, persistent local directory. It does not establish issuer adoption, verify a person's real-world qualification, change the circuit or deploy a public root.

The integrator owns the `main.go` dispatch. Add this case in `run(args)`:

```go
case "registry":
    return issuerRegistry(args[1:])
```

The handler is `func issuerRegistry(args []string) error`. It writes output files and returns errors; it prints no private key, holder secret or registry contents. The original manual `issue --index ...` command remains a test convenience and is **not** the durable pilot allocator. Do not mix manual issuance into a key managed by this registry.

Once the dispatch is integrated, run inside the prover directory:

```sh
# Creates a fresh OS-random test/pilot issuer key. Existing registries cannot reset.
./qualification-prover registry init --dir .local/pilot-issuer

# Holder generated its secret locally and supplies ONLY holderCommitment.
# The output parent directory must exist; the credential output must not exist.
./qualification-prover registry issue --dir .local/pilot-issuer --commitment DECIMAL_COMMITMENT --class 7 --expiry 2000000000 --out .local/credential.json

# The index comes from the issued credential, not from a guessed holder identity.
./qualification-prover registry revoke --dir .local/pilot-issuer --index 0
./qualification-prover registry snapshot --dir .local/pilot-issuer --out .local/current-snapshot.json
```

`issue` accepts a canonical field commitment, uint32 class and nonzero uint64 expiry. It has no holder-secret or index argument. It returns the existing credential JSON format with its assigned index, issuer key coordinates and real signature. The issuer is responsible for qualification checks and expiry policy; the allocator does not decide whether someone deserves a credential. Existing holder-local `state --snapshot ...` and `prove --holder ...` commands remain unchanged.

## Files and authenticated state

The registry directory must be a real owner-only directory (0700). Private files must be regular owner-only files (0600); symlink roots, key/state files and lock files are rejected. New secret-bearing files are created with mode 0600. This is OS file protection, not encrypted key storage or a hardware key-management system.

| File | Purpose |
|---|---|
| `issuer-key.json` | Separate OS-random test issuer key, serialized with the existing `IssuerKey` type. Never publish or commit it. |
| `registry-state.json` | Authoritative allocation records, signatures, monotonic revoked indices and an HMAC. Contains holder commitments, never holder secrets. Keep private. |
| `issuer-public.json` | Public key coordinates and a test/pilot version label. Checked against the key and authenticated state on every load. Safe to publish after loading successfully. |
| `snapshot.json` | Derived issuer-wide public snapshot. Contains exactly version, depth, root and revoked indices; no target holder index/path or issuance records. |
| `.registry.lock` | Persistent lock inode. Never delete or replace it during use. |

The state MAC is HMAC-SHA256 over the Go JSON encoding of the typed state, using a domain-separated key derived from the issuer private-key serialization. This detects accidental edits, key swaps and unauthenticated state modifications; it is not a public attestation. Load validates the MAC, key/public-metadata association, version, sequential records, bounded counter, record fields and sorted unique allocated revocation indices before allowing any mutation. Unknown, malformed or missing state never becomes an empty registry. `init` refuses any nonempty registry directory beyond its lock inode, including partially initialized or corrupt directories.

## Concurrency, durability and crash behavior

All operations use exclusive POSIX `flock` on the same persistent lock inode, with a ten-second acquisition timeout. The OS releases the lock when a process exits or is killed. A busy error is retriable; deleting a lock file is not recovery. The implementation targets cooperating processes on a local POSIX filesystem; it makes no claim for shared network-filesystem locking or distributed multi-host consensus. It uses the already-pinned `golang.org/x/sys/unix` dependency, with no new module or global hook.

Each state update writes a private temporary file, syncs it, atomically renames it over the canonical state, then syncs the containing directory. Credential output uses a synced temporary file plus an exclusive hard link into a previously absent output name, so a race cannot overwrite a preexisting credential. Protected registry output paths are rejected even through a symlinked parent alias. The relevant standard-library behavior is documented in [Go file synchronization](https://pkg.go.dev/os#File.Sync) and [rename semantics](https://pkg.go.dev/os#Rename). Durability ultimately depends on the filesystem/storage honoring synchronization; the tests use actual process death, not a simulated power failure.

Issuance ordering is deliberate:

1. Load and authenticate the registry while holding the lock.
2. Reserve `nextIndex`, append its immutable commitment/class/expiry record, advance the counter and durably save.
3. Sign the credential, store its signature in the reserved record and durably save again.
4. Publish the complete credential to a previously absent output file.

A crash after reservation may leave an unsigned gap. A failure after signing may leave an allocated signed record whose output was not delivered. Either way, a later issuance takes a **new** index. This is allocation safety, not idempotent delivery of the same credential: without a request identifier, retrying an interrupted issuance can consume another slot. An existing output is rejected before allocation where possible; an output race detected later still preserves the reserved slot. There is no automatic reclamation or reset.

Initialization commits the new key and its public metadata before committing the initial state. An interrupted partial initialization is refused on retry; do not copy that key into a fresh empty state. If a crash happened only after canonical state was committed, a later `snapshot` operation can regenerate its derived snapshot. The snapshot file is not authoritative: a failure to write it after revocation does not roll back the committed tombstone. Repeating `revoke` is idempotent and retries snapshot generation.

## Revocation, reissue and exhaustion

`revoke` accepts an allocated index, permanently adds it to a sorted set and emits a rebuilt snapshot. It cannot remove a revocation. Repeating it does not duplicate the entry. Reissue is a new `issue`, therefore a fresh slot; the old slot must be revoked separately according to issuer policy. The commands do not make those two operations an atomic public-chain transition.

There are 65,536 lifetime allocations per issuer key, including reserved gaps. After slot 65,535, issuance rejects. There is no same-key reset or reuse command. Plan a new issuer key and explicit trust transition when the registry is exhausted; reissue any continuing qualifications. The existing signed credential has no registry-generation field, so resetting statuses under the same key could revive old, unexpired credentials.

**Local rollback remains an explicit boundary.** A restored older state with a valid MAC can pass authentication, and an operator holding the key can forge a replacement state. Local files alone cannot distinguish that rollback from legitimate history. Do not restore stale allocator backups or copy one issuer key into independent registry directories. Protection against malicious operators, host compromise or whole-disk rollback requires an external monotonic ledger/anchor or stronger storage, which is not implemented here. Never repair failed JSON by clearing the counter or revoked set.

Publishing a snapshot to Swarm/Arkiv and configuring the consuming contract's trusted current root remain separate integration steps. The circuit checks membership against its public root input; the contract must compare that root against authenticated current issuer state. Issued records, keys and holder secrets must never be placed in the public snapshot.

## Executed checks

Executed on 12 September 2026 with Go 1.25.7, darwin/arm64, from explicit base `102a858860b25c81cac6f3c210f08276f6422c05` plus these three owned files:

```sh
go test -run '^TestRegistry' -count=1 -v ./...
go test -count=1 -v ./...
```

The final full prover suite passed in 3.658 seconds. The opt-in snapshot scalability measurement correctly skipped because its enabling environment variable was absent. The registry handler was exercised directly by actual child test processes; root CLI dispatch remains the integrator's check.

Observed registry checks included twelve concurrent processes issuing distinct signed slots 0–11, four concurrent initializers with exactly one success, and actual SIGKILL after reservation. After SIGKILL, the unsigned slot 0 remained durable, the OS released the lock, and a later issuance used slot 1. Monotonic revoke/reissue, output-race failure, protected-path aliases, public metadata tampering, corrupted JSON/counters, swapped keys, missing state, bounded CLI inputs, owner-only files and holder-secret exclusion passed. The exhaustion test used a clearly synthetic authenticated history of 65,535 reserved records, then executed the final valid issuance and rejected overflow; it did not claim 65,536 real issuance operations.

No network writes, issuer outreach, public deployment or production key handling were performed. These tests are acceptance evidence for a bounded pilot allocator, not an independent security audit.
