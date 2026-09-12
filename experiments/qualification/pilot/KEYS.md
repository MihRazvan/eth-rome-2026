# Browser recipient delivery

Implemented against `SCOPE.md` from base `102a858`. This module encrypts document bytes for wallet-bound recipient keys and keeps browser private keys across reloads. It does not choose a registry, authenticate directory responses, identify a credential holder, submit a transaction, or revoke previously delivered plaintext.

## Integration API

```ts
const namespace = `review-pass:${chainId}:${registry.toLowerCase()}:${wallet.toLowerCase()}`;
const device = await loadOrCreateDeviceKey(namespace);
const publicKey = await getDevicePublicKey(device); // 65-byte uncompressed P-256, 0x hex
// Wallet separately registers publicKey and expiry; wait for confirmation.
const envelope = await encryptForRecipients(bytes, context, currentBindings);
const plaintext = await decryptForRecipient(envelope, expectedContext, wallet, device);
```

`DocumentContext` is exactly `{chainId:number, escrow:Hex, jobId:string, purpose:'review-result', version:1}`. Job ID is canonical uint256 decimal. `RecipientBinding` is exactly `{owner:Hex, publicKey:Hex, version:string, expiresAt:number}`. Version is positive canonical uint64 decimal; expiry is **Unix seconds**. Addresses are nonzero 20-byte hex, case-normalized. Actual P-256 curve import validates every encryption recipient key. Duplicate owners are rejected. Input bytes and metadata are copied before asynchronous crypto.

The caller must obtain **current** bindings from its configured chain and key registry, verify the job's intended recipients, and reject missing/revoked/stale entries. Binding version is authenticated, but this module cannot know whether a supplied version is current. Recheck authoritative state before publication if registry changes during encryption matter to the application. An optional fourth argument, `encryptForRecipients(bytes, context, bindings, {now})` accepts a Unix-second test clock; production callers omit it. Encryption rejects expiry both before and after crypto. Historical decryption deliberately accepts an expired or superseded authenticated binding.

The JSON-safe `RecipientEnvelope` contains format/version/suite, the context, a random 12-byte IV, one content ciphertext, and an ordered recipient array. Each recipient carries its public binding, HPKE encapsulation, and wrapped content key. The client can use its normal JSON encoding and encrypted Swarm upload flow. Cap the network response **before JSON parsing** (5 MiB is sufficient for this format's maximum payload); module bounds run after a JavaScript object already exists.

## Rotation and historical selection

`rotateDeviceKey(namespace)` creates and persists a new local current key, retaining previous keys. It performs no registry write. Registration failure therefore leaves a locally selected key that is not yet the active registry binding; UI must show that state and retry registration or select history explicitly. `listDeviceKeys(namespace)` returns `{keyId, publicKey, createdAt, current}[]`. `loadDeviceKey(namespace,keyId)` selects a retained key. Match an envelope recipient's `publicKey` to a history item's `publicKey`, then load its `keyId`. **Device keyId is a public SHA-256 fingerprint, not an onchain version.** Registry versions may skip because revocation also increments them.

The store retains at most 32 keys per namespace and refuses further rotation without deleting history. It supplies no automatic pruning or export of private keys. Five concurrent first loads converge on one committed key through a serialized IndexedDB transaction recheck. Corrupt storage and unavailable IndexedDB fail explicitly; no transient key silently replaces an established identity. Key store is origin/profile scoped, database `review-pass-device-keys-v1`. Namespace is an application partition, not an authorization boundary. Use stable origin/namespace to reload; a new profile/device, cleared site data, or origin change has no old private keys. There is no cross-device backup/recovery in this pilot.

## Construction and limits

A fresh 32-byte content key encrypts at most 2 MiB using WebCrypto AES-256-GCM and a fresh 96-bit IV. Each of 1–8 recipients receives that key through HPKE base mode: DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM. Content AEAD authenticates the format, suite, normalized context, IV, and **complete ordered list of recipient bindings**. Each HPKE wrap authenticates that header, its recipient address, and SHA-256 of the content ciphertext. A fixed purpose-specific HPKE `info` separates this protocol from unrelated encryption. Tampering with recipient identities, versions, expiry, context, IV, or content fails; removing a recipient invalidates the remaining wraps.

The envelope is a versioned application format over standard cryptographic primitives, not a claimed interoperable credential format. Strict parsing rejects extra fields, malformed hex, oversized payloads, noncanonical integers, duplicate/unordered recipients, and unsupported versions. Content keys are never serialized in plaintext. Private keys are generated as nonextractable P-256 ECDH `CryptoKey`s and persisted through IndexedDB structured cloning. Public halves remain exportable. Temporary raw content key arrays are wiped on completion; JavaScript/crypto-runtime memory erasure is not guaranteed.

HPKE base mode provides recipient confidentiality and tamper detection, **not sender identity**. An outsider can encrypt a new document to public recipient keys; the integration must authenticate the document reference through the expected escrow job and its authorized submitter. Context does not independently provide replay prevention or proof of authorship. Envelope recipient addresses/keys, versions, timing and length remain observable. Recipients can disclose plaintext/content keys. Nonextractability prevents `exportKey` but does not defeat malicious same-origin script invoking decryption, browser-profile compromise, or endpoint screenshots. Rotation is future-delivery control; it cannot retract an earlier document. No forward-secrecy claim is made for retained long-lived recipient keys.

## Verification

Run from repository root with its installed dependencies:

```sh
node --import tsx --test experiments/qualification/pilot/keys.test.ts
node_modules/.bin/tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --strict --skipLibCheck --lib ES2022,DOM experiments/qualification/pilot/keys.ts experiments/qualification/pilot/keys.test.ts
```

Verified 2026-09-12: **10 tests passed, 0 failed, 0 skipped**, including native Chromium (full run 1.78 seconds). The strict TypeScript command above passed. An initial browser-harness run failed because its test-page middleware was installed after Vite’s 404 handler; registering the harness through `configureServer` fixed the test setup, then the complete suite passed.

Tests use Node WebCrypto plus explicit `fake-indexeddb` for adversarial store/crypto tests. The final test starts its own ephemeral-port Vite server and launches actual Chromium: two separate intended-recipient profiles decrypt one envelope; a third profile cannot; reload retains a nonextractable key; rotation plus another reload retains access through the selected historical key. It touches no existing app, chain, wallet, API or Bee service. A Chromium install provided by Playwright is required; lack of the browser fails the test instead of skipping it. Native Firefox/Safari and real wallet/registry/Bee integration are outside this module's verification.

## Primary references and dependency provenance

Accessed 2026-09-12; installed implementation and TypeScript declarations were checked in addition to online documentation. No dependency or license changes were made.

- [RFC 9180](https://www.rfc-editor.org/rfc/rfc9180.html), February 2022: HPKE base mode, authenticated application information, and explicit non-goals including replay protection, sender authentication in base mode, metadata hiding and forward secrecy limitations.
- [`hpke-js` official repository](https://github.com/dajiaji/hpke-js): `@hpke/core` **1.9.0**, MIT, existing installed dependency. API uses `CipherSuite`, `DhkemP256HkdfSha256`, `HkdfSha256`, `Aes256Gcm`, sender `seal` and recipient `open`. No dependency code vendored.
- [MDN `SubtleCrypto.generateKey`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey): asymmetric generation's extractability argument controls the private half; secure context required. [MDN `CryptoKey`](https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey): key handles can be persisted via IndexedDB's structured cloning.
- Existing repository `packages/transport/privacy.ts` was inspected for established WebCrypto/HPKE usage. It was not modified; this module uses its own purpose, envelope, bounds and namespace/history store.
