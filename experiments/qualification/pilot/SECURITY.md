# Independent pilot security review

12 September 2026. Bounded independent review of wallet sessions, authenticated document delivery and the additive key/document contracts. This is **not an audit**, a production privacy certification, or evidence of live Fuji/Swarm deployment. The reviewer did not implement this pilot, key module or qualification cryptography.

## Scope and result

The starting contract revision was `8daebf6`. The pilot frontend/server/deployer/upload-message code and key-worker module were first reviewed while uncommitted, then checked at integrated revision `d7b07c1`. The review found a stale wallet-session restoration path and two related cleanup gaps. The integrator corrected them before the final pass. No document-authorship bypass, unauthorized registry update, server-side signing/proving path or ciphertext-recipient bypass was established in the reviewed configuration.

### Corrected session findings

**PILOT-01 — stale asynchronous connection restores the previous wallet.** The original `connect()` retained `eth_requestAccounts`' account A across awaited chain reads/switching. An `accountsChanged(B)` event cleared state, but the pending call subsequently reinstalled A and loaded A's local device key. This could make A's review decryption available while the provider was on B. The revised implementation captures a session generation, checks it after awaited operations, re-reads accounts and chain after key loading, and installs account/device/wallet together only after validation. A required network switch returns to an explicit reconnect flow. `refresh`, rotation and operation-result paths now reject stale generations too. The offline probe reproduces the original connection ordering; it is an interleaving model, not a substitute for the integrator's browser session regression.

**PILOT-02 — disconnect does not clear private views.** Originally only account and chain changes cleared state. Provider `disconnect` now uses the same invalidation path: clear device/account/wallet, proofs and rendered private document views.

**PILOT-03 — stale key-history callback crosses wallet sessions.** An unguarded `listDeviceKeys(...).then(...)` could append the previous wallet's historical key identifiers into a later wallet's controls. The correction checks the captured generation and owner before changing the DOM. This was a metadata/UI consistency issue; no cross-namespace key retrieval bypass was demonstrated.

## Checked boundaries

- **Signing and proving separation:** pilot server reads chain state and transports ordinary ciphertext bytes; it has no wallet client, private transaction key, proof-generation command or witness endpoint. The dedicated local deployment script uses the explicitly public Anvil development mnemonic and insists on loopback chain 31338. It is not the public server and must never deploy funded production roles. Holder proving remains an external local CLI; imported proof JSON sends only the proof and nine public inputs to settlement.
- **Document authorship:** `submitDocument` invokes the same assigned-worker/state/deadline checks as submission and records both nonzero storage reference and nonzero SHA-256 digest in the same transaction. A third party cannot set or replace them. The server obtains the digest from escrow, verifies downloaded bytes, and the browser independently checks the envelope digest against escrow before decrypting. HPKE base-mode encryption alone does not authenticate a sender; this worker-authorized onchain commitment supplies authorship.
- **Upload authorization:** a purpose-specific wallet message binds chain, escrow, job, exact envelope SHA-256 and expiry. The server verifies it against the assigned worker, checks Accepted state/submission deadline and a maximum five-minute authorization window, bounds request size/time, revalidates exact job context and the current onchain keys of both worker and client after wallet signature verification, then serializes and caps uploads per job. Cache keys include job and digest. The in-memory allowance is resource control, not a durable financial entitlement. A malicious assigned worker can authorize junk content; quality and availability remain review/dispute questions.
- **Registry authority:** `QualificationKeys` writes only `keys[msg.sender]`; both registration and revocation increment that owner's version. Registration bounds expiry and the uncompressed-point byte shape. The browser cryptographic import additionally rejects invalid P-256 points. Another wallet cannot revoke the recipient's entry. The registry does not prove private-key possession, identity or honest custody.
- **Encryption and lifecycle:** the key module validates recipient/context structure, integer ranges and size bounds. It copies plaintext and metadata before awaited crypto. A random AES-256-GCM content key is wrapped independently through HPKE for the recipients; context, all recipient bindings and ciphertext hash are authenticated. Keys are nonextractable P-256 CryptoKeys in IndexedDB, separated by wallet/chain/registry namespace. Concurrent initial loads converge; rotation retains bounded historical keys. New encryption uses recent chain time and rejects expired bindings; historical decryption deliberately survives expiry/revocation. Rooted onchain directory reads, not an untrusted upload response, supply current bindings.
- **Scope of privacy:** a browser origin can use its IndexedDB keys; the wallet is a UI/session authority, not cryptographic protection against arbitrary same-origin malicious JavaScript or an unlocked compromised profile. Nonextractability prevents export through normal WebCrypto APIs, not use by a compromised endpoint. Recipients can retain plaintext; public job/recipient/payment/key metadata remains visible. A fresh browser profile has no old private key. Key rotation cannot recall old ciphertext.

## Executed checks

```sh
forge test --root experiments/qualification/contracts \
  --remappings @openzeppelin/contracts/=/Users/razvan/Repos/real-eth-rome/node_modules/@openzeppelin/contracts/ -vv
node --import tsx --test experiments/qualification/pilot/keys.test.ts
node experiments/qualification/pilot/security-probe.mjs
```

Actual independent results:

- **17 contract tests passed**, including the worker-only document commitment, registry authority/versions/expiry, four generated-verifier fixture tests and 256 dispute-split fuzz inputs. Unit escrow state tests use their explicitly named verifier double; the separate generated-verifier fixture tests use real proofs. Neither is public-network execution.
- **10 key-module tests passed**, including an actual isolated Chromium run with native IndexedDB/WebCrypto: two recipient profiles decrypt, an outsider fails, reload preserves the nonextractable key, and rotation preserves old-document access through the historical key. Other tests cover metadata/ciphertext tampering, invalid points, expiry, malformed/oversized envelopes, concurrent first loads and refusal to replace corrupted storage.
- **Offline upload-message probes passed:** genuine worker authorization verifies; modifications to each of chain, escrow, job, digest and expiry fail; a different worker cannot use the signature. The original stale-connect interleaving reproduces and a generation guard rejects it. No running original or pilot service was mutated by these probes.

The server's `verifyMessage` call is an EOA signature-recovery path. ERC-1271 smart-account upload authorization is not validated by this review or those tests; support must not be claimed without a compatible verifier and actual test. The pilot's injected-wallet test harness must stay visibly distinct from a real user's wallet.

Final source snapshot reviewed: `d7b07c1`. The integrated browser session regressions are implemented in `browser-test.mjs`; their ongoing execution and final result belong to the integrator and are not represented here as independently rerun.
