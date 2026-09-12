# Review Pass: product and Swarm implementation research

## Decision

Proceed with a **paid, confidential second-review workspace for an existing reviewer collective and its client teams**. The useful unit is a bounded task: review an allowance change, reproduce a reported bug, or inspect one upgrade diff. A collective vets the reviewer once; each client checks current qualification without receiving its credential serial. The report remains available outside the commissioning platform, while an onchain escrow preserves the agreed payment lifecycle.

This is an application contribution, not new cryptography or an established market opportunity. Existing credential systems already support private eligibility; existing work protocols already support escrow. The differentiator must be a working combination with precise task terms, portable reports, current qualification and payment rights that survive later revocation. One issuer and two independent client flows establish portability mechanically; they do not establish demand.

## Bounty boundaries

The supplied sponsor brief is controlling evidence for this pass. Swarm offers two $500 prizes and prioritizes usefulness, genuine Swarm operation, an intelligible reason for decentralized storage, and optionally Swarm ID. It explicitly offers weekend gift codes. Team1 Track A asks for a stablecoin **product**, including payments or automated settlement, with one complete action-to-onchain-proof flow on Fuji. It does not say a team must issue its own stablecoin. Arkiv awards at most one prize to a team, with $1,000 Best Use or a $500 mission award. These are opportunities, not additive guaranteed winnings. [Supplied sponsor brief](sources.json)

Review Pass fits Swarm if a client can retrieve its actual encrypted review through a different gateway, authenticate it against the worker's onchain commitment and keep an export that works without the original server. “We put a hash on Swarm” is insufficient. Storage longevity depends on funded postage and network availability; a content address is stable, not a guarantee that the bytes will be retained forever.

The immediate demo should use public, explicitly nonsensitive source scope and an encrypted report. Confidential source intake is not implemented by the current pilot. Do not upload a private Git repository, disclose exploit material in public job attributes or imply that encryption of the result also conceals the input.

## Prior art and reusable implementations

| Primary project | What exists | Reuse decision |
|---|---|---|
| [AnonCreds specification](https://anoncreds.github.io/anoncreds-spec/) and [anoncreds-rs](https://github.com/anoncreds/anoncreds-rs) | Selective disclosure, holder link secrets and non-revocation proofs without a correlatable credential identifier. Rust implementation with wrappers. | Apache-2.0. Strong reference for credential semantics and a future standards adapter; not a drop-in Solidity verifier for this custom proof. |
| [Privado onchain verifier](https://docs.privado.id/docs/verifier/on-chain-verification/overview/) and [iden3/contracts](https://github.com/iden3/contracts) | Credential checking, issuer-state validation and custom onchain business logic. Embedded verification versus shared verification state. | Contracts repository reports GPL-3.0; inspect individual SPDX and inherited dependencies before copying. Useful architectural comparison, not an unexamined dependency replacement. |
| [js-iden3-auth](https://github.com/iden3/js-iden3-auth) | Proof/query/auth response validation and identity-state freshness checks. | Dual Apache-2.0/MIT. Possible future verifier adapter if actual issuers require the iden3 protocol. |
| [Semaphore](https://github.com/semaphore-protocol/semaphore) | Anonymous group membership with scoped nullifiers and EVM tooling. | MIT. Prefer for a product that only needs membership in a current roster. Our credential class/expiry/signature composition requires an explicit reason to retain its extra complexity. |
| [TalentLayer contracts](https://github.com/TalentLayer/talentlayer-contracts) | Service proposals, payments, reputation and dispute workflows across marketplaces. | Apache-2.0. Reuse acceptance cases and interface lessons; avoid importing an entire public identity/reputation model into credential privacy. |
| [Kleros Escrow](https://docs.kleros.io/products/escrow) and [escrow-v2](https://github.com/kleros/escrow-v2) | Existing arbitrable service payments. | Compare timeout, evidence and appeal semantics. Repository metadata returned no root license; do not assume permission to copy arbitrary frontend files. |
| [Swarm ID](https://github.com/snaha/swarm-id/tree/59c376991b2c4c9962dfec72f6ac84115f393114) | Browser identity, app scoped secrets, postage management and upload/download/ACT APIs. | Apache-2.0; integrate pinned 0.4.1 through an isolated browser transport adapter. |
| [Bee-JS](https://github.com/ethersphere/bee-js) and [Core SDK](https://github.com/ethersphere/core-sdk) | Bee HTTP integration and client-side chunking, manifests, postage signing and cryptographic primitives. | BSD-3-Clause. Preserve SDK notices; do not mix Bee-JS 13 method names into Swarm ID's transitive Bee-JS 11 path. |

The TalentLayer documentation specifically describes partial release, milestone payments and configured arbitration. That is direct prior art against claiming novel freelance escrow. The current Review Pass fixed-price scope can remain smaller if its rules are clear; a milestone engine would be extra work rather than evidence of originality. [TalentLayer escrow](https://docs.talentlayer.org/readme/basics/escrow-and-dispute), [contract guide](https://docs.talentlayer.org/technical-guides/lower-level-guides/smart-contracts/escrow-and-dispute)

There is credible demand for paid expert review, but not yet evidence for the specific privacy product. Code4rena's certified researcher role combines performance criteria, accepted tax information and staff approval. Cantina describes security reviews and broader continuing security programs. These establish an existing assessment/workflow context, not willingness to export a qualification into Review Pass or relinquish a named reviewer's reputation. Neither organization is a partner. [Code4rena criteria](https://docs.code4rena.com/roles/sr-wardens), [Cantina product description](https://cantina.xyz/blog/cantina-for-newcomers)

## Recent material that changes implementation decisions

The relevant two-month window is 12 July–12 September 2026. Swarm's August update, published 5 September, reports Bee-JS 13's namespaced API and a separate Core SDK for work formerly performed inside the node. Browser postage signing is therefore a concrete current direction, not speculative positioning. Swarm ID 0.4.0 arrived 7 September and 0.4.1 on 11 September; its recent changelog includes partitioned-session, account-bus and sharing-key changes. Pin versions and test the actual deployed identity UI rather than assuming older examples remain compatible. [August update](https://blog.ethswarm.org/foundation/2026/monthly-development-update-august-2026/), [pinned Swarm ID changelog](https://github.com/snaha/swarm-id/blob/59c376991b2c4c9962dfec72f6ac84115f393114/lib/CHANGELOG.md)

Bee 2.8.2 is an August security-hardening release covering malformed network/storage/RPC input. The foundation recommends upgrading operators and calls it backward compatible with 2.8.1. Existing local Bee tests should record their actual image revision; public node operation should not deliberately target an older vulnerable version. No host services were reset in this research. [Release announcement](https://blog.ethswarm.org/foundation/2026/bee-2-8-2-release/)

The August ShadowPath preprint remains relevant to holder-local status lookup, authenticated shared roots and hidden status paths. It does not make private qualification a new primitive or make the current custom gnark circuit its artifact reproduction. Previously documented limits around synchronization metadata, malicious issuers and circuit composition still apply. [ShadowPath](https://arxiv.org/html/2608.19937v1)

A July Swarm ID issue is particularly useful: revocation must not pretend to erase access to immutable older objects. The current implementation returns the old content reference unchanged and updates future access. This reinforces the existing Review Pass warning that key revocation cannot take back previously delivered reviews. [Swarm ID issue 496](https://github.com/snaha/swarm-id/issues/496)

## Swarm ID compatibility and trust map

Pin `@snaha/swarm-id` **0.4.1**, source SHA `59c376991b2c4c9962dfec72f6ac84115f393114`. The npm package declares Apache-2.0, Node >=22 and a dependency on `@ethersphere/bee-js ^11.1.1`. It is a browser library: direct Node ESM import failed with `ReferenceError: window is not defined`. Import it only inside the browser boundary. The isolated actual Chromium probe imported successfully, found all 11 tested public methods and initialized against the canonical identity origin with no account. It returned `connected=false`, `canUpload=false`, `uploadMode=unavailable`. This is read-only integration evidence; no sign-in, gift redemption, upload or ACT operation was executed. [Package source](https://github.com/snaha/swarm-id/blob/59c376991b2c4c9962dfec72f6ac84115f393114/lib/package.json), [probe evidence](probe-result.json)

The default identity origin is `https://swarm-id.snaha.net`. Initialize the hidden iframe, invoke `connect()` from a user gesture, and observe `connectionInfo`. Authentication does not guarantee postage. Require both an identity and `canUpload`; present a useful missing-postage state. `destroy()` removes the client when the app unmounts. Chrome and Firefox partitioned-storage paths are documented; real Safari upload support remains unverified in the current README. [Quick start](https://swarm.snaha.net/docs/getting-started/), [repository limitations](https://github.com/snaha/swarm-id/tree/59c376991b2c4c9962dfec72f6ac84115f393114)

A usable personal stamp takes priority. A configured subsidized gateway can support an authenticated user without a personal stamp, but a custom Bee node setting disables the subsidized gateway; returning to the default node can require an app reload. Surface `uploadUnavailableReason` (`no-stamp` or `stamper-failed`) separately from authentication. The app must not call a public gateway “free uploads” solely because its health endpoint answers. [Subsidized gateway](https://swarm.snaha.net/docs/subsidised-gateway/)

The supplied bounty offers gift codes, but this inspection found no public gift-code redemption method in the SDK and no matching redemption implementation in the checked UI source. Sponsor-provided redemption may be a separate service or event-specific flow. Obtain the actual gift instructions; do not invent `redeemGiftCode()` or request private codes in Git. Existing paid postage and a funded gateway remain separate possible capabilities.

### Adapter boundary

Keep application encryption in Review Pass. Call `uploadData` with the already encrypted envelope and `encrypt:false`, then accept only a normal 32-byte/64-hex Swarm reference. The actual 0.4.1 signature is `uploadData(data, options, requestOptions)`; progress belongs to `options.onProgress`. A quick-start example that passes a callback as argument three is inconsistent with source/types. Returned references use the Bee reference wrapper; normalize `.toHex()` and validate rather than assuming a string. [Pinned client implementation](https://github.com/snaha/swarm-id/blob/59c376991b2c4c9962dfec72f6ac84115f393114/lib/src/swarm-id-client.ts)

```ts
const { SwarmIdClient } = await import('@snaha/swarm-id')
const client = new SwarmIdClient({
  iframeOrigin: 'https://swarm-id.snaha.net',
  metadata: { name: 'Review Pass' },
  onConnectionChange: renderStorageCapability,
})
await client.initialize()
// A user gesture calls client.connect().
if (!client.connectionInfo.identity || !client.connectionInfo.canUpload) {
  throw new Error('Connect storage and configure usable postage first')
}
const uploaded = await client.uploadData(encryptedEnvelopeBytes,
  { encrypt: false }, { timeout: 30_000 })
const reference = uploaded.reference.toHex()
if (!/^[0-9a-f]{64}$/i.test(reference)) throw new Error('Unexpected reference')
```

Then the worker commits the reference and SHA-256 envelope digest through its wallet. Retrieval uses another configured public gateway, checks exact bytes against the onchain digest, and only then decrypts in the intended recipient's browser. This keeps Swarm identity separate from wallet payment authority, qualification proof authority and document keys. Native Swarm encryption uses key-bearing longer references; publicly publishing such a complete reference defeats that layer's confidentiality. [Swarm encryption documentation](https://docs.ethswarm.org/docs/develop/tools-and-features/store-with-encryption/)

### ACT is a later, separately tested feature

The SDK exposes upload/download, add/revoke/get-grantee methods. ACT grantees are compressed keys; current Review Pass P-256 recipient keys are not interchangeable with that API. An `appKey.publicKey` grant is origin scoped. `identity.sharingPublicKey` is accessible across every app the user connects: that is a wider trust boundary. The identity publisher option likewise lets connected apps manage sharing. Keep the existing HPKE boundary unless a real cross-app use case justifies changing it. ACT history updates return new history references that callers must retain. [ACT API](https://swarm.snaha.net/docs/api/#act-methods)

Do not replace successful independent HPKE tests with a claim that ACT is automatically safer or more private. Any future ACT acceptance suite needs an authorized reader, outsider, app-origin distinction, old grantee, post-revocation new content and retained-old-content case. Also test wallet/identity changes during pending calls; clean UI state cannot erase captured plaintext or an already authorized upload.

## The actual user flow to build

**Client:** browse the workspace without connecting; create a named task with nonsensitive scope, public source link, acceptance rubric, reward, acceptance deadline, delivery deadline and dispute policy; choose a trusted issuer/class; register a document key; fund stablecoin escrow; publish its discoverable listing. Funding and publication failures are distinct states. A funded task must remain recoverable if Arkiv publication fails.

**Reviewer:** connect wallet and storage; see compatible open tasks from Arkiv compound queries; inspect exact terms and current issuer state; generate a proof locally using its credential; approve the acceptance transaction. Until browser-local proving is implemented and benchmarked, the local CLI remains an explicit step, not a hidden server prover. The worker sees the task become assigned and no longer available.

**Delivery:** write/upload the report, encrypt for the current client and reviewer bindings, upload through Swarm ID, and commit its locator and digest onchain. If the client key expired, ask for a current binding before encryption. Upload success without transaction success is “uploaded, not submitted” and must support retrying the same authenticated bytes.

**Client completion:** retrieve from an independent gateway, validate the onchain digest, decrypt, inspect the report, then approve payment or dispute under the agreed rules. Display balances, receipt links and deadline-based recovery actions. Export enough public context and encrypted bytes to retrieve the report without Review Pass's server, while explaining device-key loss.

**Issuer:** publish coarse qualification classes and whole authenticated status snapshots, issue only against holder-local commitments, revoke permanently when policy demands it, and publish updated roots promptly. A revoked reviewer cannot start another task; already submitted work follows its existing payment rules.

**Two-client demo:** the same credential accepts two separately funded tasks with different scoped nullifiers. Client A cannot decrypt client B's report. Revocation blocks a fresh third task; it does not claw back either submitted payment. One Arkiv opportunity expires naturally and disappears from the identical query, without a delete. The complete sequence should fit a short explanation, with evidence links available after the demonstration.

## Achievable next implementation decisions

1. Integrate the narrow Swarm ID browser adapter while preserving current Bee transport as an explicitly selected local/developer mode. No automatic substitution on failure.
2. Replace the generic fixed task digest with canonical, user-readable, hashed task terms. Add title, nonsensitive scope and immutable source/version context before increasing cryptographic complexity.
3. Make Arkiv the actual discovery path with compound typed queries and native short-lived opportunity leases. Accepted work lives in escrow even when discovery expires.
4. Deploy the financial flow to Fuji with an explicitly identified test stablecoin and public receipts. Issuing a custom token is optional and does not establish economic stability.
5. Deliver a reproducible independent report export/retrieval command. This makes data ownership tangible for Swarm judging.
6. Retain proof generation locally and build a clear issuance/prover setup flow. Browser-local proving is worth probing, but cannot be represented as solved by importing a CLI proof.

Commercial acceptance is separate: one issuer must want to issue its own qualification and two clients must value its limited disclosure. If clients need a named track record, the credible adjustment is portable verification with optional identified profiles, not an anonymity promise. If ordinary private account records solve the entire problem, the ZK portion has no demonstrated product advantage. No outreach or customer validation was performed in this pass.

## Evidence and source inventory

Research was performed against base `4f0cc87b405b8522f59e4c14d87ea546e77a4858` on 12 September 2026. Current software versions and primary source publication dates were inspected. Browser probing was limited to import and unauthenticated initialization; local source/npm reads do not prove public write access. No existing chain, Bee service or host configuration was reset. Full source titles, dates, URLs and access notes are in [sources.json](sources.json). The original product feasibility analysis remains at [qualification research](../../../experiments/qualification/research/product.md).
