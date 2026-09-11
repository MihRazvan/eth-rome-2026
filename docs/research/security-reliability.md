# Private RFQ security and reliability: evidence-led next changes

Research date: 11 September 2026. Reviewed EXIT base: `b36fbf15e3f367caf225a1f8badc96c1449ea35b`. This pass combines current primary documentation, upstream repository identities and independent executable boundary probes. It does not replace the earlier contract review, claim an audit, or establish live sponsor availability. Research and tests ran in an isolated worktree; no shared chain, browser service or public signer was mutated.

## What to preserve

EXIT's settlement design already puts the decisive checks in the right place: the seller directly accepts a maker-signed quote; chain/market domains, ownership epoch, depleted value, nonce and deadline are checked onchain. Collection changes the form of owned value, while withdrawal invalidates a quote for the former bundle. The immutable test token/source boundary makes this much easier to reason about than admitting arbitrary withdrawal NFTs or mutable token behavior.

The useful RFQ precedent is short-lived signed offers with explicit participants, amounts, expiry and unique identity. 0x's current protocol documentation describes RFQ orders as just-in-time maker orders, with explicit expiry and salt. Its `txOrigin` restriction is a system-specific choice, not a pattern EXIT should copy: EXIT already authenticates the seller through a direct call and binds the beneficiary separately. Read the upstream contracts as comparative implementation evidence, not proof of EXIT's correctness. [0x orders](https://docs.0xprotocol.org/en/latest/basics/orders.html), [pinned NativeOrdersFeature](https://github.com/0xProject/protocol/blob/2c8e51e36ccbafa39f7c9003f4087710665acb02/contracts/zero-ex/contracts/src/features/NativeOrdersFeature.sol).

ERC1271 verification must remain an execution-time decision. Contract-wallet validity may depend on changing state, time or authorization. OpenZeppelin explicitly notes that contract signatures can become invalid later. An earlier successful UI check therefore cannot reserve capital or guarantee fillability; cancellation, allowance, balance and residual state must still be checked at settlement. EXIT does this, and the browser's final simulation should remain a convenience check rather than the authority. [ERC1271](https://eips.ethereum.org/EIPS/eip-1271), [SignatureChecker](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography#SignatureChecker).

## Five highest-value implementation packages

### 1. Stop disclosing private prices through ERC20 approvals

This is the most consequential new finding. `makeOffer(id, net, 'private')` calls `approve(market, amount)` where `amount` is the exact private net price, before encrypting the offer. Approval calldata is public, and ERC20 requires an `Approval(owner, spender, value)` event. An outsider need not break HPKE to learn a losing bid. [ERC20 approval/event specification](https://eips.ethereum.org/EIPS/eip-20).

The independent controller probe entered **9,960.123456 test USDC** and captured a public approval of **9,960,123,456 base units**. It then deliberately supplied no recipient certificate; approval had already happened before the private operation failed. This also means the current sequence can disclose an intended bid that was never published.

Separate maker funding authority from quoting. Reuse sufficient existing allowance. If authorization is insufficient, show an explicit capital-capacity step whose amount is chosen independently of the private quote; do not silently substitute unlimited approval. The test-token demo can offer a clearly labelled fixed funding capacity. After authorization, read the claim/request again, confirm the active wallet session, then sign. Acceptance remains limited by the signed quote even with a larger standing allowance.

Acceptance tests must inspect every transaction emitted during two differently priced private quotes. Neither approval arguments nor events should equal or deterministically encode the confidential prices. Include insufficient allowance, existing adequate allowance, missing recipient key, cancellation and a wallet change between authorization and signing. The cryptographic test suite alone cannot catch this channel.

### 2. Make refreshes and private data belong to one wallet session

`refresh()` reads mutable `this.address` throughout a long asynchronous crawl, clears shared maps at entry, and publishes its result without checking whether a newer refresh or wallet switch superseded it. This is a reproduced privacy/UI consistency issue, not just a theoretical race.

The probe uses real HPKE ciphertext and a real maker signature. It pauses seller A's refresh after ownership is evaluated, changes to maker B and completes B's newer refresh, which correctly shows ciphertext. Resuming A's older refresh then produces a state with **wallet B**, **isOwner=true for A's claim**, and **A's decrypted 9,960.123456 bid**. No compromised cryptography or public-chain mutation is needed; the stale asynchronous task writes private data into the new account's screen.

Capture immutable session context and a refresh generation at entry. Build claim arrays, quote maps and authored-order lists locally; commit them atomically only if both generations still match. Clear private display state immediately on account change/disconnect, and invalidate in-flight work. Subscribe to `accountsChanged`, `chainChanged` and `disconnect`, with deterministic cleanup on disposal. EIP1193 requires account/chain change notifications; MetaMask also documents removing listeners when finished. [EIP1193](https://eips.ethereum.org/EIPS/eip-1193), [MetaMask provider events](https://docs.metamask.io/metamask-connect/evm/reference/provider-api/).

Recheck the captured account/chain immediately before every signing or transaction step, including after approval. Persist a minimal pending-transaction journal when a hash is returned, scoped by account/chain/market. Reload should resume receipt/replacement reconciliation, not repeat the original action. Existing cancellation/repricing fixes should be retained. This journal can record action identity and transaction hash without storing private quote plaintext.

### 3. Keep servicing available when discovery fails

On a fresh page, a valid chain claim is read successfully, but an `/api/offers` failure aborts the entire refresh before claims are published. The independent probe records zero displayed claims despite successful authoritative reads. `start()` then presents the deployment as unavailable. An Arkiv outage can therefore hide backed positions and collection controls even though the market remains usable.

Split the refresh into authoritative chain state and optional offer enrichment. Publish reconciled claims independently; show discovery/storage failure as a scoped error with a retry. Existing offers must be explicitly stale when they cannot be revalidated, and no fixture fallback may replace failed reads. Collect/withdraw should use current onchain ownership and amounts even while offers are unavailable.

Use one explicit block snapshot for related owner/residual reads, or document and detect a state change between reads. A fresh final settlement simulation remains mandatory. Bound per-record work and read sizes, use cancellation for obsolete fetches, and avoid downloading every historical claim and log forever. Tests should cover an unavailable index, a missing object, invalid ciphertext, partial pagination failure and account switch while a degraded refresh is active. Sponsor evidence should report successful discovery/retrieval operations separately from mere configuration.

### 4. Remove request bodies from the global mutation lock

The runtime acquires `mutationTail` for every POST before reading its body. A client can send valid headers and an incomplete body, thereby holding the queue while complete requests wait behind it. The isolated HTTP probe demonstrates exactly that ordering: a complete second request remains blocked until the first body's final byte arrives. Node's documented default whole-request timeout is five minutes; a byte limit alone does not impose an acceptable latency boundary. [Node HTTP requestTimeout](https://nodejs.org/api/http.html#serverrequesttimeout).

Parse only recognized mutation routes, enforce JSON media type, byte size and an absolute body deadline, and reject malformed input before queue admission. Bound the number of queued mutations and return clear overload responses. Keep signer operations serialized until independent nonce coordination is established; parallelizing funding calls casually would trade an availability defect for transaction races.

The existing process-local publication budget limits nominal upload volume but is not comprehensive abuse protection. Invalid requests can consume it, repeated anonymous clients can exhaust it, and restart resets it. Validate cheaply before reserving spend, use bounded queueing and provider budgets, and add idempotent offer publication/reuse where appropriate. OWASP specifically recommends limits on execution time, payload size, client frequency and downstream service spend. These are complementary controls. [OWASP API4](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/).

### 5. Make key registration recoverable without pretending to recover lost keys

`ensureKey()` returns an existing locally persisted certificate when its key is active onchain, but that return skips `/api/binding`. If registration succeeded and certificate publication failed, or the runtime later lost its certificate file, pressing setup again does not repair discovery. The independent probe starts with a valid local key/certificate and no server certificate; it observes **zero publication attempts**.

Treat certificate publication as an idempotent, retryable step for both new and existing keys. Persist certificate metadata alongside the nonextractable key before attempting remote publication; report registration and publication separately. If old records are present, decrypt them using retained historical certificate/key material even after rotation. A server's missing public certificate must not erase a still-available local private key.

Browser persistence is not recovery. WebCrypto permits key persistence through IndexedDB but warns about origin boundaries, script injection and users clearing storage. Nonextractability prevents ordinary key export; it does not stop hostile same-origin code from invoking decryption. Requesting persistent storage may reduce eviction, but browser permission is not guaranteed and users can still clear data. Show actual persistence/key availability status and preserve the honest cross-device limitation. [WebCrypto security considerations](https://www.w3.org/TR/webcrypto/#security-considerations), [Storage persistence](https://storage.spec.whatwg.org/#persistence).

## Cryptographic and frontend conclusions

The current HPKE P-256/HKDF-SHA256/AES-256-GCM construction should remain. RFC9180 supports authenticated application context, but HPKE itself does not supply application replay protection, recipient-compromise forward secrecy, or plaintext-length hiding. EXIT correctly binds request/domain/key version as authenticated data and validates the maker's signed quote after decryption. Keep onchain quote nonce/deadline enforcement independent from envelope/key expiry. Padding is a possible future mitigation for payload-length leakage; the exact-price approval leak is the urgent issue. [RFC9180, sections 8–9](https://www.rfc-editor.org/rfc/rfc9180.html#section-9.7).

The currently inspected hpke-js upstream HEAD is recorded in the source manifest, while EXIT's package lock remains the dependency authority. Do not upgrade cryptographic dependencies just because upstream changed; review the release delta and test browser persistence/interoperability first. [hpke-js upstream](https://github.com/dajiaji/hpke-js/tree/833f78d7abd37ba21764ed37ec228c3af477cbd6).

Keep secret backend RPC URLs, maker keys and postage credentials outside browser configuration. Vite documents that exposed `VITE_` variables become client code. The prior safe-error/public-RPC corrections matter: provider failures must not echo full secret URLs, payloads or signatures. For deployment, verify a restrictive production Content Security Policy and omit third-party analytics from private workflows unless inspected. These are endpoint protections, not stronger encryption. [Vite environment exposure](https://vite.dev/guide/env-and-mode).

## Reproduction and handoff

Run `node --import tsx docs/research/repros/boundaries.ts` at the reviewed base. The characterization assertions deliberately demonstrate existing defects; after fixes, convert them to regression expectations instead of retaining unsafe outcomes as desired behavior. Results are preserved in `repros/boundary-results.json`. Controller probes use real encryption/signatures with stubbed chain/discovery responses; the HTTP ordering probe uses an ephemeral loopback port. None is live Fuji/Arkiv/Swarm evidence.

Ownership is bounded: the integrator owns controller/session/funding/model changes; the research reviewer is assigned the runtime body/queue correction in a separate implementation commit. Financial market and interface research remain separate workstreams. After integration, rerun affected tests and real browser account-switch/private-offer/collection workflows, then record unresolved sponsor-resource blockers honestly.
