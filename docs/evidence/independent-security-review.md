# Independent security review — EXIT

Review date: 11 September 2026. Reviewer: independent implementation-session agent, separate from contract and transport authors. This is a bounded code review with executable evidence, not a professional audit or a statement that the complete product is ready.

## Scope and reviewed identities

- Canonical requirements: `docs/handoff/PRODUCT.md`, P1–P7 and Private Offers, read before implementation explanations.
- Core: `contracts/ExitMarket.sol`, `TestWithdrawalVault.sol`, `TestUSDC.sol`, `OfferKeyRegistry.sol`, and their tests at `8e16737e8a6092dafa538d3f8434566cd9e4e82c`.
- Transport: `packages/transport/**` at `8900758`, followed by request-binding correction `9b456ecc27e778bf012a042a121447620b995d0b`; shared canonical quote schema inspected.
- BENQI account prototype and fork tests were not yet committed when reviewed. SHA-256: `BenqiClaimAccount.sol` = `0acaef47b85c8678917cca2c5725657beb3762835b6dc2dd90c0fc940a5b3170`; `BenqiFork.t.sol` = `4ae7f840b7623ac7621d6b7316f62874d756dddc9ce310e2e6ba58259ace7c40`.
- Reviewer changes live in isolated branch `review/security`, based explicitly on core commit above. Only this report and `test/review/IndependentReview.t.sol` are authored by this reviewer.

The solidity-auditor skill's concrete-trace and finding-validation standards were applied. Its prescribed 12-agent fanout was not run: this task used one independent reviewer within the actual available team. The author-defined mock/test exclusions were overridden by the explicit review scope requiring adversarial tests and the deployed demonstration token boundary.

## Outcome

No critical or high exploit was identified in the admitted immutable `TestUSDC` + `TestWithdrawalVault` market. One transport request-authentication gap was reported to the transport author and corrected during review. No remaining demonstrated fund-loss finding is reported for the reviewed scope. This does not certify deployment, live sponsor services, browser behavior, or future source adapters.

### R1 — Quote authentication did not enforce negotiation request identity (resolved; low severity)

**Location:** `packages/transport/quotes.ts`, `purchaseQuoteCodec().verify`.

**Original cause:** verification authenticated the maker's signature, settlement domain, seller, claim and source, but did not compare `context.requestId` to the request derived from the quote's signed ownership epoch. The canonical quote contains an epoch, not a separately signed arbitrary negotiation identifier.

**Trace:** a correctly signed epoch-1 quote for claim 1 could be presented under the same seller's epoch-2 request. A public quote could be republished by someone who knows its plaintext; a maker can re-encrypt its own old quote to a valid new recipient certificate. Original codec verification returned true because its checks were unchanged by the request substitution. The envelope alone cannot solve this: a sender can create a fresh correctly authenticated envelope carrying the old signed plaintext. A forged ciphertext mutation without re-encryption was already rejected.

**Impact and boundary:** request-level authentication and stale-offer presentation could be wrong. `ExitMarket.accept` still compares signed epoch and depletion against current state and rejects stale settlement, so this is not a demonstrated theft or confidentiality break. A final fresh settlement simulation remains necessary even with the fix.

**Correction:** `9b456ec` derives `offerRequestId(context.chainId, context.market, quote.claimId, quote.ownershipEpoch)` and requires exact equality with `context.requestId`, before signature acceptance. The regression uses a valid old quote, a valid seller-signed new request certificate, and separately an attacker-created fresh envelope that bypasses the encryptor's checks. Normal encryption rejects the old quote; normal decryption rejects the attacker envelope. Reviewer inspected this correction and independently executed the resulting tests successfully.

## Requirements and actual evidence

| Requirement | Independent code assessment and execution |
| --- | --- |
| P1 exact exchange | Both sides of each transfer are checked. Seller calls acceptance directly. Nonzero fee aliases to maker, seller or market are rejected. Fee failure reverts prior payment, ownership and nonce changes. Existing fee-on-transfer and atomic-failure tests passed. Seller net, gross debit and fee amounts are distinct signed fields; frontend disclosure is outside this review. |
| P2 no retained authority | Receipt ownership exists only in the market mapping. There is no ERC721 operator/approval surface, arbitrary execution, upgrade or seller-directed source payout. Source requester is the market. Old owner withdrawal and direct source collection attempts revert. BENQI prototype limits native cash/share withdrawals and cancellation to current owner. |
| P3 exact residuals | Cash collection changes pending/claimable representation while retaining the bundle. Withdrawal increments depletion by removed amount; every sale increments epoch. Time, recovery additions and unsolicited dust do not invalidate a quote. Reviewer tests verify dust remains outside recognized cash and a recovery added after signing remains with the purchased bundle. |
| P4 signatures and replay | EIP-712 domain binds chain and market; all economic fields are in the hash. Direct seller acceptance is mandatory. Maker-specific nonce is consumed before transfers and rolled back on failure. ERC1271 executes at acceptance. Reviewer tests mutate every quote field, replay onto a second market, and reuse a consumed nonce across a second claim. All reject as expected. |
| P5 independent capital | Only `q.maker` supplies funds, authenticated by its current signature. A maker's nonce namespace does not consume another maker's identical nonce. No reservation is represented; drained funding causes an atomic revert. Independent maker balances are checked by the stateful model. |
| P6 callbacks | All mutating market entry points share one reentrancy guard. Vault has a separate guard and immutable requester destinations. Receipt has no receiver callback or arbitrary transfer method. Existing hostile-token test attempts buyer cash withdrawal during payment and demonstrates a failed callback plus intact acquired cash. Final owner/epoch/depletion are checked. See supported-token limit below. |
| P7 continuing entitlement | Ownership remains after all ordinary cash is withdrawn. Anyone can fund later recovery; collection credits the same current position. Old owners cannot withdraw that cash. Separate adverse lifecycle accounts for the real 3% test-source loss without invented reimbursement. |
| Private Offers | Separate nonextractable P-256 key; purpose-specific seller signature; live registry version/hash/revocation check; RFC 9180 HPKE with application context as authenticated data; decoded maker quote signature checked. Ordinary Swarm byte references exclude native key-bearing references. Failed private operations do not fall back to plaintext. Tests exercise wrong private key, ciphertext/header tampering, substituted certificate, expiry/revocation, storage integrity, unavailable key, and immutable pagination. |

## Commands executed by the reviewer

1. Core checkout: `forge test -vv` — **18 passed, 0 failed, 0 skipped**. Includes 256 single-sale fuzz cases and two invariant campaigns, each 128 runs × 64 calls = 8,192 handler calls, zero reverts. One campaign called sale 1,584 times, collection 1,617, withdrawal 1,665, recovery 1,684 and cancellation 1,642. The second also exercised every handler. The constructor seeds successful transitions, so the nonzero-counter assertion alone would not prove random nonvacuity; actual handler execution and absence of catch-all revert swallowing provide additional evidence. These are one-position local-chain campaigns, not arbitrary multi-source verification.
2. Reviewer worktree: `forge test --match-test testReview -vv` — **5 passed, 0 failed, 0 skipped**:
   - `testReviewEveryEconomicFieldIsAuthenticated` (all 15 quote fields mutated independently; ownership/payment/nonce remain intact).
   - `testReviewQuoteCannotReplayOnAnotherMarket`.
   - `testReviewNonceConsumedAcrossClaimsAndMakerIsolation`.
   - `testReviewRecoveryAddedBetweenSigningAndSaleStaysInBundle`.
   - `testReviewDustDoesNotBecomeRecognizedCash`.
3. Core checkout: `forge test --root packages/source -vv` — **3 passed, 0 failed, 0 skipped**, pinned Avalanche block **95,031,281**. Tests assert the source implementation identity and 15-day/2-day timings; demonstrate owner change, cancellation return, overdue-share recovery and whole-request redemption. Redemption explicitly simulates a future privileged `accrueRewards` call with one wei because a fork cannot receive future operator transactions. This is a pinned-fork source-admission probe, not a live sale, proof of partial BENQI payouts, or a deployed BENQI market integration.
4. Transport worktree at `9b456ec`: `node ../../node_modules/vitest/vitest.mjs run packages/transport/privacy.test.ts packages/transport/key-store.test.ts` — **2 files, 9 tests passed**. Real cryptographic bytes are used; Swarm HTTP and Arkiv publication in these unit tests are explicitly test transports. IndexedDB persistence is tested through a fake IndexedDB implementation, not a browser reload by this reviewer. An initial `npm test` attempt failed because that worktree intentionally has no root `package.json`; the direct locked Vitest binary above succeeded.
5. Reviewer worktree: `slither . --filter-paths 'node_modules|test/' --exclude-dependencies --json /tmp/exit-review-slither.json` — analyzed **30 contracts, 101 detectors, 7 results**, exit status **255** because findings were emitted. This was not a clean analyzer pass. Triage is below; raw JSON is a temporary local artifact, and the durable detector disposition is this report.

## Static analysis triage

| Detector / location | Disposition |
| --- | --- |
| `reentrancy-balance`, `ExitMarket.collect` | Balance delta deliberately spans the trusted source transfer. A callback into any mutating market function hits `nonReentrant`. The admitted TestUSDC has no transfer callback. No demonstrated exploit. |
| `reentrancy-no-eth`, `ExitMarket.collect` | Position cash is updated after source payment. Public getters may observe an intermediate view only if a future callback-capable dependency is admitted; the current token/source have no attacker callback and market mutations are guarded. No current exploitable path identified. |
| `reentrancy-benign`, `ExitMarket.collect` | Same guarded path for `totalCash`; no separately reachable mutable transition. |
| `reentrancy-benign`, `ExitMarket.originate` | Guarded origination; fixed source has no authority over position ownership or arbitrary execution. |
| `timestamp`, `ExitMarket.accept` | Deadline intentionally uses chain time; valid through the exact signed timestamp and expired afterward. It is not randomness. |
| `timestamp`, `OfferKeyRegistry.register` | Future key expiration is intentional. Registry revocation is distinct from quote cancellation. |
| `timestamp`, `TestWithdrawalVault.status` | Disclosed deterministic test-vault installment maturity. Boundary manipulation does not mint unbacked entitlement. |

## Limits that must remain explicit

The immutable admitted payment token is exact-transfer, nonrebasing TestUSDC. Per-leg `_transferExact` checks do not establish safety for every arbitrary callback token. For example, a malicious token could alter a third party's balance during a later fee transfer, after an earlier seller-balance check. No such function exists in TestUSDC, and an unprivileged trader cannot swap the market's token. Generalizing admission requires a new review, whole-settlement net checks and relevant adversarial token models; this report must not be used as approval for that expansion.

The BENQI prototype supports one originated request and economic owner changes; it is explicitly separate from atomic stablecoin settlement. Its native-cash receiver callback is guarded against owner-changing/withdrawal reentrancy. Returning shares or cash to current owner is verified on the pinned fork, with the timing/operator qualifications above.

Registry RPC failures reject new encryption. Historical decryption intentionally remains possible after rotation or expiry: revocation does not erase old keys/plaintext, and quote cancellation/deadline remain separate. A certificate/domain proof does not itself prove endpoint integrity, safe telemetry or browser cross-device recovery. Only the transport implementation and its explicitly local tests were reviewed here; actual deployed upload bodies, server logs, full browser flows and independent live sponsor retrieval still need their own acceptance evidence.

Any source change after the reviewed identities requires affected regression checks and fresh targeted review. Required public Fuji lifecycle, real Arkiv expiry, real Swarm retrieval, browser transactions and deployment correctness must be recorded separately in the canonical acceptance ledger.

Technical references consulted: [OpenZeppelin ReentrancyGuard](https://docs.openzeppelin.com/contracts/5.x/api/utils#ReentrancyGuard), [RFC 9180 HPKE](https://www.rfc-editor.org/rfc/rfc9180.html). Runtime behavior and findings above are based on the inspected source and executed commands, not those references alone.
