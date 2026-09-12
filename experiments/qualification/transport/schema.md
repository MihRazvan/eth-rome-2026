# REVIEW PASS public assignment discovery

Implemented in `assignment.ts`, based on repository `7348033`. This is an experimental public advertisement index. It does not store credential IDs, revocation indices, holder wallets, profiles, proof witnesses, private brief plaintext or encryption keys. Issuer-wide status snapshot pointers remain a separate entity kind in `arkiv.ts`; clients download the whole snapshot and verify its exact commitment against authoritative settlement state.

## Why use Arkiv here?

A worker can discover publicly advertised review tasks by generic task class, required qualification class, settlement chain and acceptance window without using this project's private application database. The same public records are available to another client. Native expiration retires discovery records after the useful application window without an application deletion job. Swarm stores the encrypted brief bytes; the settlement contract controls funding, qualification proof verification, acceptance and payment. This is a specific role split, not a claim that a Web2 database could never implement task search.

The current [Arkiv ETHRome hub](https://hub.arkiv.network/ethrome), read 12 September 2026, requires observable application behavior caused by native expiry for Built to Expire, and filtered WebSocket-driven UI updates for Live Wire. A new application has no historical indexer to decommission. This adapter does not establish either mission's complete funded end-to-end evidence. Sponsor evaluation and adoption remain unproven.

## Public schema version 1

| Field | Representation | Public purpose |
|---|---|---|
| `application`, `kind`, `schema` | `review-pass`, `assignment`, integer 1 | Separate namespace/version |
| `taskClass` | `document-review`, `technical-review`, `translation-review` | Controlled generic task family; no free-text title |
| `qualificationClass` | Canonical decimal uint32 string | Contract/circuit-compatible required class; no holder information |
| `settlementChain` | Positive integer | Execution chain, not Arkiv chain |
| `escrow` | Lowercase nonzero address | Exact configured settlement deployment |
| `jobId` | Canonical decimal uint256 string | Public contract job identifier |
| `acceptBefore` | Integer Unix seconds; indexed as typed `u64` | Strict discovery cutoff |
| `reward` | Positive canonical decimal uint256 string, payload only | Base units; read token decimals separately for display |
| `paymentToken` | Lowercase nonzero address, payload only | Reward currency on the settlement chain |
| `encryptedBrief.reference` | 64 hex ordinary Swarm reference, payload only | Application ciphertext bytes |
| `encryptedBrief.sha256` | `0x` plus 64 hex, payload only | Byte-integrity check, not publisher authentication |

The first nine fields are searchable attributes. The JSON payload contains exactly `taskClass`, `qualificationClass`, `reward`, `paymentToken`, `acceptBefore`, `settlementChain`, `escrow`, `jobId`, and the two-field `encryptedBrief` object. Namespace/version are attributes. `publicAssignment` reconstructs both levels explicitly. Extra caller properties disappear; no object spread serializes arbitrary fields. Key-bearing 128-hex native Swarm encrypted references are rejected. A plaintext upload can also have a 64-hex reference: the caller must use `encryptJobDocument` before uploading; reference syntax alone cannot prove confidentiality.

Public class, reward, deadline, storage reference and contract job correlation are observable. An onchain worker address may become public on acceptance. The allowlist prevents accidental payload overposting; it is not an anonymity guarantee or a defense against a malicious publisher deliberately encoding secrets into allowed numeric fields.

## Query and authority

`assignmentQuery` uses conjunctions for namespace, schema, task class, qualification class, settlement chain, exact escrow, and `acceptBefore > now`. Arkiv supplies currently discoverable entities. `assignmentIndex.discover` retrieves all 100-item pages, rejects malformed/oversized payloads, rechecks payload routing fields and the current local deadline, validates authoritative state through the required callback, and deduplicates only successfully validated jobs. A poisoned advertisement cannot claim a job's deduplication slot before a genuine record is checked. Duplicate valid advertisements do not create duplicate capacity.

The injected `VerifyAssignment` must read the configured chain and escrow, ensure the job exists and is Open, compare reward/token/class/deadline and confirm funded availability, authenticate the brief against the contract's committed terms, and compare the latest chain timestamp to `acceptBefore`. Never return `true` merely because Arkiv has the record or its owner looks familiar. The public task-family taxonomy also needs an application-approved mapping to qualification classes; it has no automatic onchain authority. Metadata/terms mismatch returns false. A provider/read error rejects discovery with a generic error; it does not become an empty successful result. UI callers should show blocked/unavailable and retain explicit observation times.

Contract checks are point-in-time observations. Another worker may accept immediately afterward; the contract must recheck acceptance/current time atomically. Publication also runs the validator before spending, but the public index cannot ensure ongoing availability. An accepted advertisement may remain indexed until expiry; subsequent discovery rejects it through authoritative state validation.

## Native expiration boundary

Publication uses `ExpirationTime.atDate(new Date(acceptBefore * 1000))` with no minimum-lifetime extension and `readonly: true`. The installed SDK 0.8.1 resolves a wall-clock deadline to Arkiv block height, rounding up to a block. It does not establish cross-chain time synchronization or exact second-level removal. Clients therefore filter the logical deadline immediately and the settlement contract enforces its own timestamp independently. Native pruning remains useful for storage/discovery cleanup. Expiry never revokes a credential, erases copied bytes, refunds escrow or invalidates an already accepted job.

Do not use client deadline hiding as evidence that Arkiv native expiry occurred. The funded acceptance check must separately preserve the create receipt, native `expiresAt` block, before query, after-expiry query and a second-client UI update, without issuing deletion. No funded assignment publication or expiry observation has run yet.

## Integrator API

```ts
import { assignmentIndex, arkivAssignmentDriver } from './assignment';
const index = assignmentIndex(
  arkivAssignmentDriver({ rpcUrl, account }),
  async ad => verifyAgainstConfiguredEscrow(ad),
);
const rows = await index.discover({
  taskClass: 'document-review', qualificationClass: '1',
  settlementChain: 43113, escrow,
});
await index.publish({
  taskClass: 'document-review', qualificationClass: '1',
  reward: '20000000', paymentToken, acceptBefore,
  settlementChain: 43113, escrow, jobId: '4', encryptedBrief,
});
```

`account` is omitted for public reads; writes fail explicitly without it. Keep account signing in an authorized wallet/backend, never a browser bundle containing a private key. `arkivAssignmentDriver` is the low-level transport and does not authenticate ads itself; product callers use `assignmentIndex` with the mandatory verifier. Tests inject a driver explicitly labeled `local-test`; there is no automatic local fallback.

The existing generic Arkiv status watcher demonstrates socket reachability only. This assignment adapter does not yet implement filtered task-event refresh, reconnect reconciliation or second-client UI behavior. Those remain separate Live Wire integration work; do not present an unrelated global event counter as assignment notifications.
