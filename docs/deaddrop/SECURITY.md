# Deaddrop — security and trust model

[Docs](../README.md) · [Architecture](ARCHITECTURE.md) · [Evidence](EVIDENCE.md)

Deaddrop is an experimental testnet product. It has targeted security reviews and executable adversarial tests, not a production audit or a reviewed multiparty proving ceremony.

## What stays private

| Data | Visibility |
| --- | --- |
| Wallet addresses, rewards, deadlines and settlement | Public on Fuji |
| Task scope and recruiting metadata | Public on Swarm / Arkiv |
| Issuer signing public key and status snapshot/root | Public |
| Credential signature, index, holder commitment/secret, witness | Local private proof inputs |
| Qualification class and presentation inputs | Public in the proof/acceptance |
| Application wallet, ticket, signature and encrypted credential delivery | Public on Arkiv; plaintext readable by the designated issuer/reviewer |
| Report plaintext and content key | Available to intended recipients after decryption |
| Encrypted report and envelope recipient metadata | Publicly retrievable; metadata is not hidden |

This is credential and document privacy, not anonymous employment or private payments. A reused wallet links tasks. Traffic metadata is not hidden. Authorized recipients can copy or share plaintext. Possession of both a credential and its holder secret can be shared; there is no unique-human or nontransferability guarantee.

## What remains trusted

- **Issuer:** automatically signs participation credentials after validating enrollment requests and maintains revocation state. Enrollment is open; no human assessment or external accreditation occurs. A proof verifies a valid issuer-signed pass, not expertise.
- **Arbitrator:** the team-controlled address resolves disputes and can split escrow funds under the contract rules. The protocol does not judge work quality or automatically share private evidence with an arbitrator.
- **Proving setup:** Groth16 parameters were generated experimentally in a single process. No production multiparty ceremony or setup-integrity guarantee beyond recorded artifact hashes is claimed.
- **Frontend and device:** users trust the code delivered to their browser and their wallet prompts. Browser compromise can expose proof inputs or decrypted reports. Hosting is Vercel, not decentralized frontend governance.
- **Availability:** Fuji/Arkiv RPCs and the Swarm gateway can fail or censor access. Hash checking detects substituted bytes, not missing bytes. Gateway trial storage has unspecified retention; export important reports.

## Enforced boundaries

The onchain acceptance binds a proof to the task and wallet and checks the issuer's current root. An old root cannot authorize fresh acceptance after revocation. Revocation or credential expiry after acceptance does not erase earned settlement rights.

Discovery listings are checked against actual funded tasks and their creators. A forged listing cannot independently move escrow funds. Listing expiration changes discovery without deleting payment rights.

Only the assigned reviewer commits delivery. The onchain digest authenticates exact stored bytes. Recipient-key bindings are checked before encryption, and only corresponding browser keys unwrap the report key. The UI requires successful opening before approval, but a direct contract call cannot establish that a human read a report.

The hosted enrollment service can delay or refuse issuance. Its server-only secrets include issuer signing and channel-decryption keys; private Blob storage holds an AES-GCM-encrypted allocation ledger and committed ticket results. Compromising the server environment can authorize passes and expose issuer-readable enrollment data. It does not provide browser holder secrets or user wallet signing keys. Admission quotas are best-effort across serverless instances, backed by finite relay funds. Collecting a response checks its holder/issuer pairing, while actual proof acceptance verifies eligibility cryptographically. [Channel, vault and service boundaries](QUALIFICATION.md).

## Recovery limits

Keep the original browser profile and hostname. Report keys are origin-bound, nonextractable browser state. A wallet seed phrase does not restore them after browser storage loss. Credential holder backups are separate from report keys. The browser checks current recipient bindings before new encryption and rechecks before delivery. A rotation during pending wallet confirmation is not atomically prevented by the escrow. Rotation does not erase old ciphertext/plaintext or revoke somebody's existing ability to decrypt.

The server-side issuer commits the updated allocation registry and ticket credential together before releasing the credential. ETag conditional writes handle concurrent updates, and same-ticket retries return the committed result. This does not protect against a malicious issuer or an administrator restoring an older ledger. After migration, the old local allocator is frozen; never issue from a stale copy or reset the deployed registry to repair enrollment. See current release evidence for the tested concurrency and interruption scope.

## Reviews and checks

- [Escrow terms review](../review-pass/avalanche/terms-review.md)
- [Deployment review](../review-pass/avalanche/deployment-review.md)
- [Arkiv UI review](../review-pass/arkiv/ui-review.md)
- [Swarm integration review](../review-pass/product-swarm/integration-review.md)
- [Wallet-separated pilot security findings](../../experiments/qualification/pilot/SECURITY.md)
- [Current acceptance evidence](EVIDENCE.md), [verification commands](QUICKSTART.md#verification)

These are scoped engineering reviews, including agent-assisted work. Read their dates and findings rather than interpreting their existence as an audit certification.
