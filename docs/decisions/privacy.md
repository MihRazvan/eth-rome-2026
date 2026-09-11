# Private Offers decision — 2026-09-11

Use RFC 9180 HPKE base mode with DHKEM(P-256, HKDF-SHA256), HKDF-SHA256 and AES-256-GCM through `@hpke/core@1.9.0`. HPKE is an established construction; its JS package is not represented as formally audited. Base-mode sender authentication comes from the enclosed canonical EIP-712 maker signature. We do not invent an ECDH composition, use experimental wallet-curve encryption, or derive secret material from public signatures. [RFC 9180](https://www.rfc-editor.org/rfc/rfc9180.html), [hpke-js](https://github.com/dajiaji/hpke-js).

The browser generates a separate random P-256 recipient pair. Its private CryptoKey is non-extractable and persisted with IndexedDB structured cloning. Losing browser storage loses historical offer access. There is no automatic cross-device recovery or wallet-signature recovery. The public half is wallet authenticated under a separate `EXIT Private Offers` EIP-712 domain, chain and market. Its purpose text, seller, request, public-key hash, version and validity are bound. Makers verify this signature and read the current onchain `OfferKeyRegistry` before encrypting. Wrong-chain, substituted, expired, revoked and rotated bindings fail closed; network failure does not reuse a cached active certificate.

The registry is the authority for active key version/hash. A registry write is seller-authorized and versions increase. Arkiv discovery cannot revive an old recipient certificate. The signed certificate may be transported publicly; its signature authorizes encryption only and cannot authorize purchase.

HPKE info fixes application/protocol/suite; AEAD associated data binds request ID, seller, chain, market, key hash/version, envelope format/version. Sign the canonical purchase quote first, verify it, then encrypt quote plus signature. The request codec validates seller, claim, source revision and quote EIP-712 domain. Current onchain validity, exact depletion bounds, funds and cancellation are settlement checks, so a decrypted signature is not displayed as guaranteed executable.

Upload ordinary application-ciphertext bytes to Swarm with `swarm-encrypt:false`. Reject 128-character native encrypted references. The 64-character reference and SHA-256 integrity digest reveal no decryption key. Arkiv gets only the routing allowlist and storage pointer. Public mode is a separate explicit API; private failures never call it. The independent read path downloads from its configured retrieval gateway, checks digest, decrypts and reauthenticates the maker before returning a quote. [Swarm native-reference warning](https://docs.ethswarm.org/docs/develop/tools-and-features/store-with-encryption/), [Bee bytes API](https://docs.ethswarm.org/api/).

## Lifecycle

1. Generate and persist a non-extractable key. If persistence fails, show unavailable and do not advertise a working reload promise.
2. Seller signs a purpose-bound certificate and registers its hash/version/expiry onchain. Advertise only after transaction confirmation.
3. Makers validate certificate and latest registry state. Seller decrypts locally; competing makers and public readers see ciphertext.
4. Rotate by generating a new pair and registering a strictly newer version. Keep old local keys to read old offers. New makers reject the old binding.
5. Revoke onchain to stop honest clients encrypting new bids. Neither revocation nor rotation erases copies, prevents retained keys decrypting old bytes, or cancels signed quotes. Cancel a purchase quote separately.
6. After reload, load the key by chain/market/seller/request/version. If missing, show “Seller encryption key unavailable on this device”; let the seller rotate and request fresh offers. Never claim existing offers recoverable.

Sellers can disclose bids. Gateway/indexing observers still learn timing, addresses, request relationships and ciphertext length. Onchain submission reveals purchase terms including failed submissions. This is not anonymous settlement, a fair sealed auction or guaranteed best execution. Site compromise can use an accessible key even if it cannot export it. Browser persistence is not hardware custody.

## Compatibility probe that changed implementation

Passing only a non-extractable P-256 private key to the HPKE recipient context caused intermittent round-trip failures. Installed `@hpke/common` reconstructs a public key after JWK export fails and canonicalizes Y parity; this can differ from the original recipient's public encoding. EXIT now supplies the full `{privateKey, publicKey}` pair, reconstructing the public CryptoKey from the authenticated public bytes. Tests then passed. No private key is exported. This is recorded as a local finding, not an upstream accepted issue.
