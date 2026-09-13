# Cutout — a saved reviewer pass

[Docs](../README.md) · [User flow](USER-FLOW.md) · [Security](SECURITY.md)

The normal flow is **Apply → issuer approval → collect pass → verify eligibility on a task**. The browser stores the pass and holder secret privately; proof generation reads them locally. No JSON download, private-message handoff or per-task file picker is required. Backup and legacy imports live in an optional disclosure.

## User experience

Connect a Fuji reviewer wallet, open **Your reviewer pass** and apply. Sign a message identifying the encrypted application and its destination. It requests manual approval and does not authorize a token transfer. The reviewer needs Fuji gas for later work; the application service checks at least 0.001 test AVAX. Cutout pays the separate Arkiv application-publication gas.

The pass survives page reloads in the same wallet/browser/origin. After the issuer approves, **Check approval** retrieves the encrypted response and saves the credential. On a task, **Verify my eligibility** uses that pass; acceptance still requires a separate Fuji wallet transaction.

A missing/expired application can be renewed while preserving the holder. An expired issued response is cleared from pending state so the user can reapply. No approval is simulated when the service fails. Approved test credentials last approximately one day from issuance; the actual credential expiry is displayed.

## Cryptographic and storage path

1. The browser generates a private holder using the existing Go WASM relation and a separate P-256 reply key. It saves both before requesting a wallet signature.
2. The application contains only the enrollment commitment, destination, applicant wallet and reply public key. HPKE encrypts it to the operator's public channel key. Holder secret and reply private key stay local.
3. The wallet signs the canonical encrypted-envelope digest, destination, opaque random ticket and short authorization expiry. The API verifies that signature, bounds inputs and queues the encrypted application on Arkiv.
4. The offline operator decrypts, checks the applicant against the signature and validates the reply key before issuing. The existing durable issuer registry allocates/signs the credential. That signing key is never uploaded to Vercel.
5. The issuer HPKE-encrypts the credential to the reply public key and updates the relay-owned Arkiv record. The browser decrypts and validates holder/issuer consistency before saving. The proof and contract remain the cryptographic authority for actual eligibility.

HPKE uses P-256, HKDF-SHA256 and AES-256-GCM. Context and direction bind the ciphertext to its chain, escrow, issuer and ticket. Arkiv payloads expose the applicant wallet, timestamps, signature and ciphertext; they do not expose a reusable credential commitment/index or holder secret. Wallet privacy is not claimed.

The browser vault uses IndexedDB, scoped by origin, chain, escrow, issuer key and wallet. It stores private application state and the credential atomically, rejects accidental replacement/mismatched pairs, and clears in-memory views on wallet changes. A downloaded backup is private, unencrypted key material: keep it protected. It is optional and separate from the report-key registry.

## Operator commands

The channel was initialized once. Do not rerun initialization or reset the existing issuer registry. From the repository root:

```sh
node --import tsx experiments/qualification/pilot/enrollment-operator.mjs list
node --import tsx experiments/qualification/pilot/enrollment-operator.mjs approve <opaque-application-ticket>
```

Approval is a deliberate operator action after reviewing the test applicant. The command keeps plaintext only in ignored mode-0600 private runtime files, reuses existing successful issuance on retries, serializes same-ticket approval locally and publishes only the encrypted response. An interrupted approval lock requires inspecting private state before recovery. No operator needs the reviewer's holder backup.

Vercel holds only a dedicated, finitely funded Arkiv relay key. `hosting/enrollment-public.json` contains public channel/issuer data. Requests are restricted to the two current app origins, require a wallet signature and funded Fuji account, and have per-wallet/total inbox admission checks. Publication is serialized within each function instance. Across serverless instances those quotas are best-effort, not a globally atomic anti-abuse guarantee; identical duplicate tickets are recoverable and approval lookup prefers a completed response. The relay has limited test funds and is not automatically replenished.

Inbox entities expire natively after two days. Collected passes remain in the browser until their credential expiry. Clearing browser storage or switching origins loses local secrets unless a private backup was saved. This is not cloud account recovery or a production identity wallet.

## Source and verification

- [Browser enrollment](../../experiments/qualification/pilot/web/enrollment.ts), [credential vault](../../experiments/qualification/pilot/credential-vault.ts)
- [HPKE channel](../../experiments/qualification/pilot/enrollment-channel.ts), [relay API](../../experiments/qualification/pilot/hosting/enrollment-api.ts), [Arkiv inbox](../../experiments/qualification/pilot/enrollment-inbox.ts)
- [Offline operator](../../experiments/qualification/pilot/enrollment-operator.mjs)

Focused tests cover vault namespace/race/rollback behavior, encryption tampering/outsiders/context binding, signed requests, admission failures and duplicate recovery. See the current acceptance record for actual hosted browser results; source support alone is not a public end-to-end completion claim.
