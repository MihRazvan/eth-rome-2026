# EXIT — product contract and acceptance evidence

Prepared 11 September 2026. This file carries the agreed product into a new coding session. It is a specification to implement, not evidence that EXIT already exists or is audited. Current sponsor instructions and actual source implementations must be rechecked during execution.

## 1. The product

**Sell your withdrawal. Get paid now. Let the buyer wait.**

EXIT is an onchain marketplace for supported withdrawal claims. A seller receives an explicit payment today in exchange for the right to collect a source's eventual payout. Makers compete through signed purchase offers and use separately authorized capital. Buyers can collect, manage and resell the remaining position. This is an outright sale: the buyer assumes the disclosed source, timing, currency and loss risks.

Build the complete seller and buyer workflows. The defining demonstration is a funded sale, partial collection, rejection of a now-stale offer, resale of residual rights, and final collection. Private Offers is a required feature that users may enable per negotiation. It conceals competing bids before disclosure; it does not conceal settlement.

Existing projects establish prior art. Intentional informs atomic factoring; TenderSwap/lpETH inform inventory and resale. EXIT's case is the quality of its combined market, ownership model, maker workflow and confidential negotiation. Do not claim the first-ever claim market, universal source compatibility, audited safety or proven commercial liquidity.

## 2. Decision rights

| Required outcome | Agent-owned decision |
|---|---|
| Atomic payment for exact remaining rights on Avalanche; independent maker authority. | Shared settlement kernel versus per-maker markets; account and receipt decomposition; appropriate Solidity libraries. |
| Meaningful Arkiv discovery and native expiry; Swarm upload, retrieval and independent verification. | SDK versions, record schema, pagination strategy, transport, caching and service layout after live probes. |
| Public offers and an optional confidential-offer mode with honest boundaries. | Reviewed cryptographic library, authenticated key lifecycle and browser persistence design. |
| A professional, distinctive market with complete trading and portfolio flows. | Frontend framework, accessible primitives, art direction, typography, layout and component organization. |
| Reproducible local execution, public Fuji lifecycle and validated real-source evidence. | Toolchain, repository organization, CI, deployment approach and source-adapter implementation. |
| Strong security properties and inspectable evidence. | Test architecture, invariant handlers, static analysis and selective additional tooling. |

Use a short decision record when a choice changes custody, signatures, privacy, source admission or sponsor evidence. Do not treat architecture freedom as permission to weaken these outcomes. Aave funding is optional. AI valuation, a custom L1, cross-chain settlement and ENS are not requirements. Keep the financial mechanism deterministic and explainable.

## 3. Ownership and economic requirements

Translate the following into individually identified requirements and meaningful tests before implementing sensitive transitions.

**P1 — Exact exchange.** Deliver the signed net payment and precisely defined acquired rights to the bound parties, or revert everything. Specify supported payment-token behavior; fee-on-transfer or rebasing tokens must not silently underpay. Show gross debit, seller net and every fee separately.

**P2 — No retained seller authority.** After a sale the previous owner cannot withdraw, redirect, approve away, cancel for their own benefit, or dispose of recovery assets. Inspect inherited entry points, signatures, operators, callbacks and account execution surfaces. A source account should have narrowly bounded actions rather than arbitrary execution or mutable delegatecall authority.

**P3 — Exact residuals and stale-offer rejection.** Distinguish pending entitlement, claimable entitlement, recognized collected cash and supported returned/recovery assets. An offer that includes removed value must become invalid. Ownership epochs and depletion counters are useful for EXIT-controlled receipts; alternative mechanisms must establish equivalent behavior. Unsolicited dust and harmless time progression should not make a valid position unsellable. EXIT cannot infer every external away-and-back transfer of a native NFT from its own events.

**P4 — Authentication and replay protection.** Bind chain, settlement contract, maker, seller, acquired claim, buyer/beneficiary, source/version, payment asset, amounts, fees, deadline and one-time order identity. Authenticate economically relevant state bounds. EIP-712 is a signing format, not replay protection by itself. Evaluate contract-wallet authorization at execution where supported. Copied calldata must not redirect either payment or claim rights. Support cancellation and reject consumed/expired orders. Authenticate the seller's acceptance of these exact terms through the seller's direct call or a separate signed acceptance with replay protection. A maker quote authorizes maker capital only; a general token/operator approval is not agreement to a price.

**P5 — Independent capital.** Maker A cannot spend B's funds. Several signed quotes do not reserve liquidity. A simulation proves executability at the checked state only. If reservations are introduced, total live encumbrances, release and consumption need enforceable accounting.

**P6 — Callback safety.** Cover the entire market/account/receipt/source interaction, including malicious recipients and token callbacks. Check final acquired rights and payment. For native claims, ordinary acquisition must not succeed after a callback has moved or consumed the acquired right unless a separate, explicitly specified mode accounts for the resulting assets.

**P7 — Continuing entitlement.** Current ownership governs supported cash, residual claims and later recoveries. Zero standard views do not prove final exhaustion. Preserve an ownership record until supported recovery is exhausted. Losses update actual proceeds; EXIT does not invent reimbursement. Permissionless servicing may collect to a fixed entitled destination, with any reward explicit and bounded.

## 4. Source admission and environments

For each source record: chain, address, pinned block, proxy implementation if applicable, source revision/license, administrator/operator powers, acquisition mode, ownership rules, units, timing, partial collection, cancellation, missed windows and recovery. Execute those behaviors against the identified implementation before labeling it integrated.

**Public Fuji demonstration:** deploy a clearly labeled EXIT Test Withdrawal Vault with actual backing in test USDC and actual onchain withdrawal rights. It supports controlled installments and an explicit adverse payout scenario. Use this to prove the full public lifecycle. Never label it BENQI, real-world collateral or a third-party production vault. Test loss controls must be disclosed and scoped to that test source. The profitable and adverse examples are separate reproducible scenarios.

**Real-source target:** validate BENQI sAVAX on a pinned Avalanche mainnet fork. The inspected published implementation keys requests to the caller. Originate through an EXIT-controlled account and transfer its economic ownership; ERC20 approval cannot import a withdrawal already requested by an EOA. Verify the current implementation, cooldown, redemption window and returned-share recovery. Its whole-request behavior does not establish partial payouts. No official BENQI Fuji deployment was verified. If current implementation evidence disproves the approach, document the specific result and select another verifiable Avalanche source using the same admission requirements; do not silently count the controlled vault as real-source evidence. [Inspected BENQI source](https://github.com/Benqi-fi/BENQI-Smart-Contracts/blob/e0cfd244726719dfe027c9740878d64d1cad98f2/sAVAX/StakedAvax.sol)

Native withdrawal NFTs such as Lido's illustrate direct acquisition, but Lido is not thereby deployed on Avalanche. ERC-7540 does not guarantee transferable requests; ERC-8161 pending transfers need not transfer existing claimable credit. Keep source and settlement on the same execution chain. Shared discovery is not a bridge.

Aave can later supply a maker funding strategy if deposits, available withdrawals and execution are tested. The inspected Fuji registry was only a starting point, not proof of adequate funding. Direct, separate ERC20 funding is sufficient for the core product.

## 5. Private Offers

Provide a public mode and an optional private negotiation mode. Define the visibility matrix before creating the index schema.

| Actor or layer | Private-mode visibility |
|---|---|
| Seller | Decrypts received offers locally, verifies maker signatures and compares valid terms. |
| Maker | Knows its own offer and deliberately public request information. Cannot decrypt competitors' offers. |
| Arkiv, Swarm and public visitor | Only the specified routing metadata and application ciphertext; no private price, signature payload or decryption key. |
| Onchain observer | Sees submitted settlement terms, claim/payment transfers and addresses. Submission can reveal a quote even if the transaction fails. |

Generate a separate encryption key pair. Authenticate the recipient public key with a purpose-specific wallet-signed binding to seller, request, application/chain, key version and validity. Makers must reject substituted keys. Never export a wallet private key or derive confidentiality from a publicly recoverable wallet signature. Specify refresh, rotation, revocation, loss and cross-device limitations before promising recovery.

Sign the canonical purchase quote, then encrypt its payload and signature with an established authenticated-encryption construction. Bind the envelope to its request, key, chain and version. A quote may bind a separate underwriting-document reference; it cannot contain the hash of its own later encrypted envelope. Encrypt sensitive supporting documents too, or omit those details from public documents.

**Encrypt in the client before gateway upload.** Some native Swarm encrypted references include the decryption key. Publishing a complete such reference defeats confidentiality. Application ciphertext uploaded as ordinary bytes is a practical default; use native encryption or ACT only after proving the chosen trust boundary and client support. [Swarm encryption documentation](https://docs.ethswarm.org/docs/develop/tools-and-features/store-with-encryption/)

Arkiv stores minimal public routing fields and ciphertext references. Retrieve all relevant result pages before locally comparing offers. Do not leak prices in attributes, sortable public columns, logs, telemetry, filenames, unsalted guessable commitments or error reports. Do not silently fall back to plaintext when decryption fails.

This provides offer confidentiality from other makers and storage/indexing operators under uncompromised endpoints and correct key binding. Sellers can disclose bids. Metadata remains observable. It does not provide anonymous trading, a fair sealed auction, guaranteed best execution or hidden settlement. Expiry is not deletion of previously copied data. “Best valid offer received” is more accurate than “best market price.”

## 6. Sponsor targets and required proof

The event manual and supplied sponsor brief govern eligibility; refresh live endpoints, SDK guidance and submission links. The main judging weights are code 50%, innovation/significance 25%, feasibility 15%, creativity 10%. These are requirements to satisfy, not a promise of awards. [Official manual snapshot with bounty briefs](https://github.com/urbeETH/ethrome-2026-hacker-manual/blob/494d2c401de9efe4c8e97e5070c52d1786b94731/HACKER-MANUAL.md)

| Target | Required integration and evidence |
|---|---|
| **Avalanche / Team1 Track A** — $400 first, $200 second | Complete stablecoin purchase, resale and collection on Fuji, with real balances, ownership, addresses and transaction links. Meaningful onchain financial behavior. Choose one Team1 track; A is the current choice. Submit both ETHRome and Team1 forms. |
| **Arkiv Mission 02 / Best Use** — $500 / $1,000; one Arkiv prize per team | Arkiv is the real offer-discovery path. Demonstrate native entity expiry with the identical fresh query before and after, with no delete/cleanup job. Include /arkiv/schema.md and root friction.md with genuine reproducible findings and workarounds. Complete the required ten-minute conversation and provide the repo by Saturday 12 September, 20:00 Europe/Rome. |
| **Swarm** — two $500 awards | Actual upload and independent retrieval/verification of useful signed records and encrypted offers. Explain user ownership and portability. Swarm ID is recommended, not compulsory. Document credentials/postage requirements and the next development direction. |

For Arkiv, verify the event network and compatible version of @arkiv-network/sdk. Earlier manual and SDK documentation differed. Distinguish Arkiv block-based entity lifetime from the Avalanche quote deadline; settlement checks its own deadline. Expiry does not cancel a still-valid signature automatically. Use query filters and complete pagination appropriately; do not find the “best” quote by checking only the first page. Mission 03 is optional only with a real supported WebSocket endpoint and qualifying subscription; HTTP polling is not that mission. Mission 01 needs a genuinely replaced indexer, not invented legacy history.

Swarm ID identity, wallet signing and quote encryption are distinct. Check upload capability and funded postage; gateway access is not a perpetual free-storage promise. A separate verification client should retrieve a record, authenticate its contents and reconcile it with chain state. Storage and discovery never authorize settlement.

Do not add ENS to inflate the sponsor list. Its brief requires substantive ENSv2 beta use; this is outside the agreed focus.

## 7. Product surfaces and visual proof

Build usable Markets, Exit/trade, Portfolio and Claim detail flows; the agent may organize them differently if all tasks remain clear. A visitor can browse before connecting a wallet. Lead with the real financial activity, not an architecture diagram. Show expected amounts and collection ranges as estimates where appropriate, exact payment separately, and source/chain/demo context near decisions.

The seller should immediately understand what is being sold and the net proceeds. The buyer should see cost, collected cash, residual exposure, assumptions, available actions and realized results. Ownership progression and reconciled cash flows are promising EXIT-specific visual elements; the design process chooses the final expression.

Handle empty markets, expired/stale/unfunded offers, partial collection, pending/reverted/replaced transactions, uncertain timing, missing records, wrong network, unavailable encryption keys and competing private bids intentionally. Read-only browsing, real test transactions and explicit fixture previews must remain distinguishable. A public demo should offer a documented path to test funds and a fully backed demo claim without relying on a developer impersonating the visitor.

A fresh visitor must be able to complete the demonstrated lifecycle after the presentation, including after a reload or quote expiry. Provide a repeatable test-funding and claim-origination path, genuinely funded demo makers and a clear way to request fresh offers. Label team-operated makers and demonstration activity explicitly; do not imply outside participation or fabricate trades. Explain temporary funding/quote unavailability and the available recovery path in the interface.

### Reference lifecycle

Illustrative test USDC amounts; zero fees and gas/operating costs excluded. Scale the amounts if actual test-token supply requires it, preserving the economics and evidence.

1. Seller owns a claim with 10,000 expected proceeds. Makers offer 9,900, 9,940 and 9,960.
2. A pays 9,960; seller receives exactly that amount; A acquires the agreed rights.
3. A collects and withdraws 4,000. A quote pricing the former full bundle fails.
4. B pays A 5,985 for the residual expected 6,000.
5. B receives 6,000. A's gross realized result is 25; B's is 15. In a separate loss scenario B receives 5,700 and loses 285.

Show actual chain state, not animations pretending to settle. Add a private-offer view from seller, competing maker and outsider contexts; demonstrate actual ciphertext retrieval and access separation. Show Arkiv expiry and independent Swarm verification as part of the financial workflow. Fork time advancement is a test technique; never imply that it accelerates a live protocol.

## 8. Completion and submission

Completion evidence must cover P1–P7, the full lifecycle, multiple makers, public/private offers, source admission, real sponsor integrations, original usable frontend, reproducible setup and actual deployment status. The workflow file defines how to collect it. Unverified integrations remain explicitly unverified.

Prepare public source with an appropriate license and preserved notices, configuration examples without secrets, deployment manifests, maker runner, deterministic scenarios, verification client, source profiles, test/review evidence, concise README, a 15-second hook, and a landscape demo of at most three minutes with a team member on camera. Prepare form answers and bounty-specific evidence links; humans complete required conversations, attendance and submissions unless separately authorized.

Hack window: Friday 11 September 18:00 to Sunday 13 September 10:00, Europe/Rome. Preserve real timestamps and history; declare pre-existing project material and identify weekend functionality. Do not flatten old code into a fresh commit. The code must remain open for the required period (the supplied manual specifies at least four weeks). All team members must satisfy the on-site rule. Form links were still TBD in the inspected snapshot; refresh them.

Primary references and source pins are in RESEARCH.md. This brief deliberately supersedes older prescribed contract classes and plaintext-only quote storage; it retains the product's financial guarantees.
