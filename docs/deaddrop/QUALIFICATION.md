# Deaddrop — automatic enrollment and private proofs

[Docs](../README.md) · [User flow](USER-FLOW.md) · [Security](SECURITY.md)

A reviewer chooses **Accept this task**, signs a setup message on first use, and continues to the task proof. **Confirm acceptance** then opens the Fuji transaction prompt. Deaddrop obtains and saves the private reviewer pass automatically. No team approval, credential download or per-task file picker is part of this flow.

**Enrollment is open.** The pass confirms participation in Deaddrop, not assessed technical expertise. The circuit can verify credentials from an assessed issuer, but the current issuer does not perform that assessment. The client evaluates the delivered report.

## User experience

The reviewer connects a Fuji wallet. If no usable pass is saved, the app creates a private holder and requests a wallet signature for its encrypted enrollment request. Signing does not authorize a token transfer. The application service checks that the wallet holds at least 0.001 test AVAX; Deaddrop pays the Arkiv publication gas.

The issuer service processes the request and returns an encrypted pass. The browser collects it automatically, validates its holder/issuer pairing, and saves it locally before generating the task proof. Acceptance still requires the reviewer's Fuji transaction.

The pass survives reloads in the same wallet/browser/origin. Passes expire; the actual expiry is shown. Renewal preserves the holder where possible. If the service or a network is unavailable, setup must report the failure and allow retry, not pretend issuance succeeded. Workspace **Get started** runs setup independently; **Continue setup** resumes a pending request. A usable pass shows **Ready to review**. Backup and legacy imports remain optional recovery tools.

## Cryptographic and storage path

1. The browser generates the holder with the existing Go WASM relation and a separate P-256 reply key. It saves private state before requesting a wallet signature.
2. The request contains the enrollment commitment, destination, applicant wallet and reply public key. HPKE encrypts it to the issuer channel key. Holder secret and reply private key stay local.
3. The wallet signs the encrypted-envelope digest, destination, opaque random ticket and short authorization expiry. The Vercel relay verifies that signature, bounds inputs and queues the encrypted request on Arkiv.
4. When the browser checks its request, the server-side issuer decrypts the stored, wallet-authorized envelope, validates its applicant and reply key, and runs the existing Go registry to produce a candidate allocation and credential. It encrypts the updated registry and ticket result with AES-GCM and commits both atomically to private Vercel Blob using an ETag conditional write. A conflicting allocation is retried against the latest state; no credential is released before its durable commit.
5. The server HPKE-encrypts the committed credential to the reply public key and publishes the response through the Arkiv inbox. The browser decrypts and validates it before saving. The browser proof and Fuji verifier check actual task eligibility cryptographically.

HPKE uses P-256, HKDF-SHA256 and AES-256-GCM. Context and direction bind ciphertext to its chain, escrow, issuer and ticket. Arkiv exposes applicant wallets, timestamps, signatures and ciphertext, but not the holder secret or plaintext credential commitment/index. Wallet privacy is not claimed.

The vault uses IndexedDB, scoped by origin, chain, escrow, issuer key and wallet. It stores private request state and credentials atomically, rejects mismatched pairs, and clears in-memory views on wallet changes. Optional private backups contain unencrypted credential/holder material and are separate from report-decryption keys.

## Service boundary and recovery

Vercel server-only environment secrets contain the issuer signing key, channel-decryption key, Blob-encryption key and a dedicated, finitely funded Arkiv relay key. Public configuration contains only the channel and issuer public keys. Requests require a wallet signature and funded Fuji account and are restricted to configured application origins. Per-wallet/total inbox quotas are best-effort across serverless instances, not a globally atomic anti-abuse guarantee.

The private Blob object stores encrypted issuer allocation state and the credential result for each ticket. A retry returns that ticket’s existing credential, including after an interrupted response publication. Blob is issuer bookkeeping, not report storage: scopes, snapshots and encrypted reports still use Swarm. No laptop, background worker or Railway service is needed for enrollment.

The hosted issuer and Blob store are availability and trust dependencies for new enrollment. A reviewer with a valid saved pass can prove without contacting the issuer, provided the matching public snapshot remains available. Automatic issuance does not make the issuer decentralized or remove its authority to sign credentials.

Preserve the existing issuer and channel during migration; never initialize a replacement to repair enrollment. After migration, the encrypted Blob ledger is the sole allocation authority. Freeze the old local registry: issuing from that stale copy can reuse an allocated revocation index. Recovery must use the latest committed ledger, not an old local backup. The service refuses to create a new ledger when the existing one is missing.

Inbox entities expire after two days. A collected pass remains in its browser until credential expiry. Clearing storage or changing origin loses local secrets unless a private backup was saved; wallet recovery alone does not restore them.

## Source and verification

- [Browser enrollment](../../experiments/qualification/pilot/web/enrollment.ts), [credential vault](../../experiments/qualification/pilot/credential-vault.ts)
- [HPKE channel](../../experiments/qualification/pilot/enrollment-channel.ts), [relay API](../../experiments/qualification/pilot/hosting/enrollment-api.ts), [Arkiv inbox](../../experiments/qualification/pilot/enrollment-inbox.ts)
- [Server-side issuer and conditional durable allocation](../../experiments/qualification/pilot/hosting/automatic-issuer.ts), [Go issuer registry](../../experiments/qualification/prover/issuer_registry.go)

The existing tests cover vault races/rollback, encryption tampering, context binding, signed requests, admission failures and duplicate recovery. [Earlier public browser evidence](evidence/saved-pass/README.md) records application, manual issuance, saved-pass collection and paid task #4. Those dated receipts establish the previous flow; they do not verify unattended enrollment. Current release verification belongs in the [evidence index](EVIDENCE.md).
