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
4. A separate persistent issuer worker decrypts the request, validates the signed applicant and reply key, and uses the existing durable issuer registry to allocate and sign the credential automatically. No human approves the request. The credential signing key stays out of Vercel and browser bundles.
5. The worker HPKE-encrypts the credential to the reply public key and publishes the response through the Arkiv inbox. The browser decrypts and validates it before saving. The browser proof and Fuji verifier check actual task eligibility cryptographically.

HPKE uses P-256, HKDF-SHA256 and AES-256-GCM. Context and direction bind ciphertext to its chain, escrow, issuer and ticket. Arkiv exposes applicant wallets, timestamps, signatures and ciphertext, but not the holder secret or plaintext credential commitment/index. Wallet privacy is not claimed.

The vault uses IndexedDB, scoped by origin, chain, escrow, issuer key and wallet. It stores private request state and credentials atomically, rejects mismatched pairs, and clears in-memory views on wallet changes. Optional private backups contain unencrypted credential/holder material and are separate from report-decryption keys.

## Service boundary and recovery

Vercel holds only a dedicated, finitely funded Arkiv relay key. Public enrollment configuration contains the channel and issuer public keys. Requests require a wallet signature and funded Fuji account and are restricted to the configured application origins. Per-wallet/total inbox quotas are best-effort across serverless instances, not a globally atomic anti-abuse guarantee.

The issuer worker holds signing and channel-decryption keys plus durable allocation state. This service is an availability and trust dependency for new enrollment. A reviewer with a valid saved pass can prove without contacting it, provided the matching public snapshot remains available. Automatic issuance does not make the issuer decentralized or remove its authority to sign credentials.

Preserve the existing issuer registry and channel on deployment or recovery; never initialize a replacement to repair enrollment. Allocation and successful issuance must survive retries and restarts. Do not run competing issuers over independent copies of the registry. Existing operator commands remain recovery tools, not steps a user must wait for.

Inbox entities expire after two days. A collected pass remains in its browser until credential expiry. Clearing storage or changing origin loses local secrets unless a private backup was saved; wallet recovery alone does not restore them.

## Source and verification

- [Browser enrollment](../../experiments/qualification/pilot/web/enrollment.ts), [credential vault](../../experiments/qualification/pilot/credential-vault.ts)
- [HPKE channel](../../experiments/qualification/pilot/enrollment-channel.ts), [relay API](../../experiments/qualification/pilot/hosting/enrollment-api.ts), [Arkiv inbox](../../experiments/qualification/pilot/enrollment-inbox.ts)
- [Automatic issuer worker](../../experiments/qualification/pilot/enrollment-worker.mjs), [container definition](../../experiments/qualification/pilot/issuer-hosting/Dockerfile)
- [Issuer commands and durable issuance](../../experiments/qualification/pilot/enrollment-operator.mjs)

The existing tests cover vault races/rollback, encryption tampering, context binding, signed requests, admission failures and duplicate recovery. [Earlier public browser evidence](evidence/saved-pass/README.md) records application, manual issuance, saved-pass collection and paid task #4. Those dated receipts establish the previous flow; they do not verify unattended enrollment. Current release verification belongs in the [evidence index](EVIDENCE.md).
