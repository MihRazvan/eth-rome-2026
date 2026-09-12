# Avalanche settlement and Team1 eligibility

Review Pass should target Team1 Track A with canonical Circle test USDC on Fuji, paying qualified reviewers through a funded escrow. A new stablecoin is not required by the supplied September 12 brief, the current official event prize page, or the pinned hacker manual. The actual requirement is a useful stablecoin workflow with verifiable onchain execution. The prototype's unrestricted qUSD faucet demonstrates contract mechanics, but a canonical test-USDC lifecycle is stronger sponsor evidence. This recommendation prioritizes the product's qualification and delivery mechanism over introducing a second monetary system.[1][2]

## Requirements and evidence

| Item | Published requirement | Review Pass acceptance evidence |
|---|---|---|
| Track | Choose one Team1 track | Track A consistently selected in both forms |
| Award | A: $400 first or $200 second; B: $300 first or $100 second | Never add both placements/tracks into an attainable total |
| Network | Fuji C-Chain with test assets; mainnet/custom L1/audit/real funds unnecessary | Chain 43113 deployment manifest, actual receipts and balances |
| Workflow | Complete useful stablecoin flow | Fund → qualified acceptance → encrypted delivery → approval/payment |
| Submission | Public source and run/deploy instructions; in-person working demo; explain problem, architecture and Avalanche role | Runnable README, public source, three-minute demonstration and exact addresses |
| Forms | ETHRome checkbox plus separate Team1 submission | Both completed by team; not claimed by code |
| Originality | Eligible hackathon work | Retain existing history and identify new work |

The current prize page still describes the separate form as forthcoming; no working Team1 form was verified. Its weights are usefulness 35%, complete demo 30%, Avalanche substance 20%, product/UX 15%. Native interoperability, token-transfer, privacy and policy primitives are optional tie-break considerations. The credential verifier is application cryptography on Avalanche, not an Avalanche-native private transaction facility.[1][2]

The often-repeated “deploy/mint/supply tracking/transfer/redeem/frontend” checklist is **not present in these inspected event sources**. Those can describe a stablecoin tutorial or an issuer product, but should not be promoted to a bounty requirement without a specific newer sponsor brief. The attached text and current published manual agree on Track A. A deployment requirement must also not be confused with creating the payment asset: deploying the escrow and verifier on Fuji is a meaningful deployment.[1][2]

## Canonical payment asset

Circle identifies Fuji USDC at `0x5425890298aed601595a70AB815c96711a31Bc65`; its test tokens have no monetary value and are not backed by real dollars. Avalanche's own ERC20TokenHome tutorial independently identifies that address and six decimals. A Circle faucet distribution supplies test inventory; it does not make Review Pass an issuer or establish fiat redemption.[3][4]

The included read-only probe observed chain 43113 at 2026-09-12 09:05 UTC. At finalized block 58330903 it read nonempty code, `USD Coin`, `USDC`, six decimals, an unpaused contract and total supply `90086374385788024` base units. The recorded proxy code hash identifies the observed code, not a completed proxy implementation audit. No faucet claim, signer use, approval, transfer or deployment was attempted. The script does not read environment keys. Reproduce with `node docs/review-pass/avalanche/probe.mjs`; the retained result is [probe.json](./probe.json).

Circle's public contract repository provides useful operational prior art: separate minting, pausing, blacklisting and upgrade authority. Its owner can replace several operating roles. These capabilities mean an exact-transfer token can still become temporarily nontransferable. Escrow must remain atomic when transfers fail, surface the failure accurately and avoid suggesting that its own deadlines override the token administrator. The repository is Apache-2.0; copying code entails preserving notices. It need not be vendored to interact through ERC20.[5]

## Recent network change that affects correctness

Helicon has been active on Fuji since July 28, 2026. The September 8 AvalancheGo v1.15.0 release separates C-Chain execution and settlement: `latest` is the last executed block; `safe` and `finalized` are the last settled block. `pending` defaults to last executed but is configurable. A default one-confirmation receipt wait therefore should not be treated as the complete durable settlement check.[6][7]

The live probe saw latest 58330905 and safe/finalized 58330903. These were sequential observations, not an atomic measurement of latency. The correct application policy is receipt success, then finalized height reaching the receipt block, then matching canonical block hash, and finally reading balances/state at the settled reference. A timeout means settlement is unconfirmed; it does not authorize resubmission or optimistic payment. Bound the wait and keep the transaction hash visible. This is a design inference from the documented semantics, with tests required before integration.

The release also removes several node RPC surfaces, including `eth_accounts` and `personal`. This does not remove the browser wallet's EIP1193 account methods: wallet account discovery and a public node's managed-account API are distinct. Existing viem JSON-RPC reads/writes are adequate; AvalancheJS and a custom L1 are unnecessary for C-Chain ERC20 escrow.[7]

## Recent product context and prior art

Three current primary announcements help position the product without proving its demand:

- **August 3, Ava Labs / Kenyan academic records:** the announcement describes credential verification on Avalanche and the delay of traditional verification. This establishes adjacent institutional interest. Its public certificate anchoring is not evidence of unlinkable presentations, and its scale claims were not independently audited here. Review Pass should keep the narrower claim that each job proves an issuer-approved qualification without publishing its reusable credential index.[8]
- **September 3, Ethena Pay:** its own launch article emphasizes ordinary saving, sending and spending behind a familiar mobile experience. The useful lesson is to show commissioning and receiving a review, with settlement evidence available when needed. Copying issuance, yield or a neobank would obscure the actual problem and introduce economic risks. The announcement is not proof that reviewers want this workflow.[9]
- **July 10, NEC/Ava Labs:** an MOU explores biometric credentials and stablecoin actions without putting biometric data onchain. This is two days outside a strict July 12–September 12 window, and explicitly a proposal rather than shipped integration. It is close prior art to “qualification plus payment”; do not claim that combination itself is new. Review Pass does not need biometric identifiers or unique-human claims.[10]

The June Payments Collective announcement is older context, not recent research. Its existence reinforces that payments include custody, payout and operational components beyond an ERC20 transfer. Review Pass should sell a focused engagement workflow to existing crypto-native teams; it does not currently provide offramps, employment administration or globally compliant payroll.[11]

## Implementation comparisons

| Route | What it actually proves | Consequence |
|---|---|---|
| Existing permissionless DemoUSD | Local six-decimal ERC20 accounting | Keep for deterministic tests; no collateral, peg or redemption claim |
| Canonical Fuji USDC | Product works with the sponsor-relevant public test asset | Recommended baseline; obtain test AVAX and test USDC through authorized access |
| Treasury-minted test token | Role-controlled issuance and supply accounting | Mint limits do not establish backing; calling a burn “redemption” would mislead |
| 1:1 USDC wrapper | Deposits create claims redeemable for equal test USDC | Technically coherent if genuinely needed, but adds approval/custody/UI and contract risk |
| AVAX-backed or algorithmic coin | New monetary mechanism | Requires oracle/liquidation/peg analysis unrelated to the review problem; reject |

OpenZeppelin 5.6.1 is already pinned. ERC20Wrapper provides deposit/matching issuance and withdrawal/burn, but warns that unusual underlying balance behavior can break backing. It is a useful optional reference, not a reason to build a wrapper. Standard ERC20 supplies balances, allowances and supply; supply control alone does not create a stable value.[12][13]

The host has Node 24.12.0, Forge 1.5.1, viem 2.56.3 and OpenZeppelin 5.6.1. Foundry configuration requests Solidity 0.8.30, Cancun and optimization at 200 runs. Existing artifact size inspection completed successfully but compilation was cached; this was not a clean compiler probe. The global standalone `solc` is 0.6.11, so scripts must invoke Foundry's configured compiler rather than assuming the shell binary matches. No dependency upgrades are needed for the recommended path.

## Security and public verification boundary

QualificationEscrow already checks actual inbound token balance increase, uses SafeERC20 and a reentrancy guard around money movement, and binds acceptance to chain/contract/job/recipient. Before public use, test the actual configured token's calls on a pinned Fuji fork and confirm full public receipts. Maintain the exact-transfer token restriction; SafeERC20 alone does not detect fees or rebases. State changes must revert with a failed payout. Reviewer revocation blocks future admissions, not payment for an already submitted obligation.

Record token address and decimals next to user amounts, distinguish AVAX gas from USDC reward, reject wrong networks before signing, use bounded approvals, and show balance/allowance recovery after rejected or replaced transactions. Funding and payment should never rely on Arkiv entity presence or Swarm availability as an authorization oracle. A revoked credential, expired listing and overdue review are three different facts.

Required evidence: deployment receipt/source configuration, client balance decrease and escrow increase, actual onchain proof acceptance, assigned-reviewer document commitment, recipient-authorized retrieval/decryption, exactly-once release, reviewer USDC increase, and one failed stale/revoked acceptance. Include refund/dispute tests and disclosure of the arbitrator's ability to stall a dispute. Public-wallet and timing metadata remain linkable. A live positive balance is not proof of enough gas; local tests are not public activity.

## Sources

All sources accessed September 12, 2026. Dates below are publication/release dates where visible; otherwise undated current documentation.

1. ETHRome. [Prizes and Bounties](https://www.ethrome.org/hackermanual/prizes.html). Retrieved by direct HTTPS after research browser extraction failed.
2. urbeETH. [Hacker Manual, pinned commit 3ffd55d](https://github.com/urbeETH/ethrome-2026-hacker-manual/blob/3ffd55daec53c7ecb4ed3901ba034f328ea731c0/HACKER-MANUAL.md). Team1 section. Both user attachments contain consistent Team1 wording.
3. Circle. [USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).
4. Ava Labs. [Deploy ERC20 Token Home](https://build.avax.network/academy/avalanche-l1/native-token-bridge/01-erc20-to-native/04-deploy-erc20-token-home).
5. Circle. [stablecoin-evm](https://github.com/circlefin/stablecoin-evm/tree/fc85788bc7c23cefe3df1a757133048bfddadeaa). Apache-2.0; source HEAD pinned at observation.
6. Ava Labs. [Helicon upgrade](https://build.avax.network/docs/primary-network/helicon-upgrade).
7. Ava Labs. [AvalancheGo v1.15.0 release](https://github.com/ava-labs/avalanchego/releases/tag/v1.15.0), September 8, 2026.
8. Ava Labs. [Kenya academic credentials](https://www.avax.network/about/blog/securing-a-nations-credentials-kenya-anchors-academic-records-on-avalanche), August 3, 2026.
9. Ethena. [Introducing Ethena Pay](https://pay.ethena.fi/blog/introducing-ethena-pay), September 3, 2026.
10. Avalanche. [NEC MOU](https://www.avax.network/about/blog/nec-signs-mou-to-explore-biometric-verified-on-chain-services-on-avalanche), July 10, 2026.
11. Avalanche. [Payments Collective](https://www.avax.network/about/blog/avalanche-payments-collective), June 18, 2026.
12. OpenZeppelin. [ERC20 API](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20).
13. OpenZeppelin. [ERC20Wrapper v5.6.1](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.6.1/contracts/token/ERC20/extensions/ERC20Wrapper.sol), MIT.
