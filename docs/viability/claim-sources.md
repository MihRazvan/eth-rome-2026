# Claim-source viability: a narrow Ethereum market, not universal withdrawals

Research base: `da5e55de3e09d8a6ce50a23e491e433e9d35b18c`. Observed 11 September 2026. This is independent source selection and an eligibility experiment, not production admission, a security audit, buyer demand validation, or a live EXIT integration.

**Recommendation:** validate a market for **already-pending Lido unstETH and standard ether.fi withdrawal NFTs on Ethereum**, with Lido first for current stock and clearer mechanics. Avoid a broad stablecoin-withdrawal or Avalanche-native claim-market assertion. The commercially interesting distinction is that the seller has *already surrendered the liquid token* and cannot simply use its DEX exit. Whether enough such owners will accept discounts remains unproven.

## Six candidates, including disqualifiers

| Source | Right after requesting | Existing claim transferable? | Easier alternative / economic constraint | Decision |
|---|---|---|---|---|
| Lido stETH → unstETH | ERC721 claim, redeemable for ETH after finalization | Yes; current owner controls it | DEX/ARM before requesting; afterward no cancellation. Current queue includes protocol inventory and many tiny NFTs | Best first validation source; Ethereum |
| ether.fi standard eETH/weETH withdrawal | ERC721 claim for ETH | Valid, nonblacklisted NFT can transfer | DEX/ARM or rate-limited instant redemption before requesting; standard NFT claim is indivisible | Second source; larger median ticket but much smaller present stock |
| Ethena sUSDe cooldown | USDe silo credit keyed to account | No native transfer of an already-started account credit identified | Sell sUSDe before cooldown; current onchain cooldown only one day | Reject direct import of existing EOA requests |
| Maple / Syrup queues | Escrowed LP shares, owner-keyed queue request | No transferable request interface in inspected queue manager | Reduce/cancel request and recover shares; Maple describes average processing under 24h, not a guarantee | Weak initial niche; pool-specific permissions and secondary share liquidity must be checked |
| Centrifuge asynchronous redemption | Controller-managed request, later claimable assets | ERC7540 does not itself transfer a request/controller | Product-specific membership, subscription/redemption restrictions; operator approval is not irrevocable sale | Reject generic admission; investigate only a named vault and explicit transfer standard |
| BENQI sAVAX | Request indexed under original requester | Existing EOA request cannot be imported | Sell sAVAX before request; account origination must happen beforehand | Avalanche fit, poor fit to “sell the withdrawal you already have” |

Lido documents the request/NFT lifecycle and payout risk. Ether.fi's ordinary NFT and new priority queue must not be conflated. Ethena code stores account cooldowns, and its official contract address matches the pinned reads. Maple's interfaces key requests by owner and permit cancellation. Centrifuge's guide distinguishes the controller from operators and explicitly asks integrations to check permissions. These are source-specific conclusions, not properties inferred from a token standard. [Lido interface](https://docs.lido.fi/contracts/withdrawal-queue-erc721/), [ether.fi NFT](https://github.com/etherfi-protocol/smart-contracts/blob/b4a0968087b178bc346cdf6bee6c0597bf4c42c7/src/withdrawals/WithdrawRequestNFT.sol), [Ethena code](https://github.com/ethena-labs/bbp-public-assets/blob/main/contracts/contracts/StakedUSDeV2.sol), [Ethena addresses](https://docs.ethena.fi/solution-design/key-addresses), [Maple queue](https://docs.maple.finance/technical-resources/interfaces/withdrawal-manager-queue), [Maple withdrawal process](https://docs.maple.finance/maple-for-lenders/withdrawal-process), [Centrifuge integration](https://docs.centrifuge.io/developer/protocol/guides/invest-into-a-vault/).

BENQI's limitation was already executed in the repository's pinned Avalanche fork evidence; it is not a new live observation in this research. That test has a 15-day cooldown, a two-day redemption window and whole-request recovery. A wrapper created **before** requesting is a different acquisition funnel. [Existing evidence](../evidence/benqi-source.md), [BENQI source](https://github.com/Benqi-fi/BENQI-Smart-Contracts/blob/e0cfd244726719dfe027c9740878d64d1cad98f2/sAVAX/StakedAvax.sol).

## Actual pending stock, separately from new flow

All state reads below pin Ethereum block **25,956,536**, hash `0x218b943eac80f99821c617459b4a145248cd0841929e1acd6f76a8f2e16af175`, timestamp **2026-09-11 20:25:23 UTC**. Full pending arrays, integer amounts, ownership concentration and raw logs are preserved in [claims-observations.json](probes/claims-observations.json). These are public-chain reads, not fixtures.

| Observation at the pinned block | Lido | ether.fi standard NFT |
|---|---:|---:|
| Latest / latest finalized request ID | 135407 / 135117 | 82548 / 82519 |
| Unfinalized requests | 290 | 29, all valid |
| Unfinalized requested face | 20,789.210284 stETH | 2,240.326059 ETH |
| Distinct current owner addresses | 241 | 17 |
| Median NFT face | 0.773046 ETH equivalent | 20.000554 ETH |
| Requests below 1 ETH | 153 | 13 |
| Largest owner share of pending face | 19.24% | 37.78% |
| Largest three owners' share | 40.29% | 70.95% |
| Youngest / oldest pending age | 0.0368 / 4.0865 days | 0.0115 / 1.0286 days |
| ETH already locked for finalized claims | 29,925.057829 | 732.253884 |

**Stock is not TAM, committed supply, or a list of people to contact.** NFT caps can split one position into several requests; many addresses may have one controller. Conversely, an owner contract may represent many depositors whose withdrawal decisions cannot authorize that contract to sell its underlying NFT. The largest Lido owner, `0x598d…9dfa`, holds 4,000 ETH face and is Kelp's **LRTConverter**, verified against the project's own deployment table. Its contract inventory alone is 19.24% of pending face. Ether.fi's second and third largest owners have contract code; this research does not identify their controllers. [Kelp deployment table](https://github.com/Kelp-DAO/LRT-rsETH).

Ages are elapsed time since creation, **not remaining wait estimates**. Lido stores timestamps in its request state. Ether.fi does not; this probe joins NFT mint blocks to block timestamps. Lido #135117 is already finalized and unclaimed, despite having the same creation timestamp as pending #135118. Ether.fi #82510 is already claimable for 369.547734 ETH, while #82521 remains pending. An inspector must surface these distinctions: asking someone to discount a claim they can collect now is usually the wrong product action.

The explicit event window is blocks **25,946,536–25,956,536**, lasting **120,468 seconds (1.3943 days)**:

| Flow in that bounded window | Lido | ether.fi |
|---|---:|---:|
| New request / mint events | 97 | 43 |
| Requested face | 3,862.360170 stETH | 3,052.085474 ETH |
| Burn events | 75 | 40 |
| Non-mint/non-burn transfers | 0 | 10 |
| Those transfers also burned in the same transaction | 0 | 10 |

Request events match mint counts and contiguous minted IDs through each pinned latest ID. This short window is not representative annual volume. No secondary NFT sale was validated. All ten ether.fi transfers share one from/to pair and immediately burn; they evidence a servicing route, not demand for discounted pending NFTs. For example [transaction 0x326e…9b6e](https://etherscan.io/tx/0x326ed69e2a3d2fd93bbc95c1db6823ff0f13cb5e92fb7bcbf8de0921c89b9b6e) moves #82519 to a claiming contract and burns it.

The initial 50,000-block Flashbots log request silently returned the same logs as an explicit 10,000-block query. Treating that as seven-day volume would be wrong. Publicnode refused archive logs/state; other free endpoints failed or capped ranges. Both scripts and the limitations are recorded. We deliberately make no historical-sales absence claim beyond the inspected window.

## Source mechanics that change the product

Lido is the simpler acquisition target: transfers move the existing queue entitlement without resetting its timestamp. Requests stop earning staking rewards and can finalize below requested face following losses. The NFT burns on whole collection; there is no native installment/residual NFT. Finalization risk and ETH/stablecoin currency risk remain with a buyer. A meaningful waiting price needs source state and a funding horizon, not a fabricated fixed APR. [Lido mechanics](https://docs.lido.fi/contracts/withdrawal-queue-erc721/).

Ether.fi's deployed NFT implementation matches the June 26 deployment address. Valid NFTs are transferable; blacklisting and pending invalidation remain material controls. Invalid requests can be seized. Finalized invalidation is forbidden, new finalization rates are frozen, and anyone can service a claim to its current NFT owner. Full claim burns the NFT. [Pinned source](https://github.com/etherfi-protocol/smart-contracts/blob/b4a0968087b178bc346cdf6bee6c0597bf4c42c7/src/withdrawals/WithdrawRequestNFT.sol), [deployment record](https://github.com/etherfi-protocol/smart-contracts/blob/b4a0968087b178bc346cdf6bee6c0597bf4c42c7/deployment/WithdrawRequestNFT/2026-06-26-22-16-11.json).

The newer **PriorityWithdrawalQueue** is whitelisted and binds a hash request to its user. It permits cancellation but exposes no native claim-transfer interface. This research excludes it. Instant redemption also takes liquid eETH/weETH, not an existing withdrawal NFT. The current token-specific ETH route has a **30bp exit fee**, but at the pinned block its redeemable amount is **zero** and `canRedeem(1 ETH, ETH)` is false. Old no-argument fee and one-argument availability getters now revert. This is a concrete capacity constraint, not proof of a persistent shortage. [Priority code](https://github.com/etherfi-protocol/smart-contracts/blob/b4a0968087b178bc346cdf6bee6c0597bf4c42c7/src/withdrawals/PriorityWithdrawalQueue.sol), [redemption code](https://github.com/etherfi-protocol/smart-contracts/blob/b4a0968087b178bc346cdf6bee6c0597bf4c42c7/src/withdrawals/EtherFiRedemptionManager.sol).

Ether.fi reports 1,977 withdrawals totalling 542,792 ETH between April 18 and May 21, with median finalization wait 4.9 days and maximum 16.7. Those are **operator-reported stress-period statistics**, not independently reproduced here or current ETA. Its newer stale-oracle fallback is liquidity-bounded: code skips invalid requests and finalizes only fundable ones. The observed stale window is 100,800 blocks (roughly 14 days at 12 seconds), so it is not an unconditional fourteen-day redemption guarantee. [Stress-period report](https://www.ether.fi/blog/how-ether-fi-redeemed-20-percent-of-tvl-without-adding-to-exit-queue), [admin fallback](https://github.com/etherfi-protocol/smart-contracts/blob/b4a0968087b178bc346cdf6bee6c0597bf4c42c7/src/oracle/EtherFiAdmin.sol).

## Competition and a falsifiable validation step

Origin ARM is a serious substitute **before** a user enters a queue. Inspected Lido and EtherFi adapters pull the liquid asset from ARM and originate their own requests, recording their IDs internally. No existing-NFT purchase/credit route was identified. Accepting an NFT callback is not equivalent to buying someone else's NFT. Fluid's StETHQueue similarly takes liquid stETH, creates requests, and borrows against them; its audit description alone should not be read as proof of importing any existing unstETH. Neither inspection proves the market has no other NFT lender or bidder. [Origin adapters](https://github.com/OriginProtocol/arm-oeth/tree/098b387f2c53be8f6864e0d0bddfd72832e5ab8d/src/contracts/adapters), [Fluid queue](https://github.com/Instadapp/fluid-contracts-public/blob/a9949b48ba1247d4f478cd0acb40896b5c8bf3f8/contracts/protocols/steth/main.sol).

The indexed official Makina strategy page identifies the observed `0xD1A557…6e09` owner as the Ethereum Caliber of **Dialectic Queue Arbitrage eEth**, a strategy buying weETH and redeeming through ether.fi. This is useful evidence of an operating queue-arbitrage strategy, not willingness to buy EXIT claims. Direct page extraction returned only its shell; the mapping comes from a targeted search-index extraction and is labeled accordingly in the source inventory. Do not treat indexed TVL/APY as current onchain measurements. [Makina strategy](https://makina.finance/strategy/0x165afd0b156355D9D51e9E6Ab317a96787Fb6271).

The next product validation should inspect a real owned native NFT, show pending versus already claimable and current transfer restrictions, then obtain independently funded bids on the **same Ethereum chain**. Prefer ETH/WETH accounting for the first experiment. Measure net discount after gas, time to executable bid, failed/stale quotes and successful collection. Stop if sellers prefer waiting or existing routes systematically beat net offers. Persistent two-sided demand cannot be inferred from queue stock or one stress episode.

Neither preferred native claim exists on Avalanche merely because a representation of its liquid token bridges there. Keeping Avalanche settlement would require a separate trusted custody/bridge mechanism, changing the product and its risks. Arkiv/Swarm discovery may span chains; it cannot atomically deliver Ethereum claim rights on Avalanche. Likewise, the existing controlled-vault partial-collection/resale demo must not be marketed as actual Lido/ether.fi behavior. Native claims support resale **before** whole collection, not a surviving source NFT after partial collection.

## Verification and restart

[NativeClaimAdmission.t.sol](../../packages/source/test/NativeClaimAdmission.t.sol) now passes **4/4** pinned local-fork tests with **RPC storage caching disabled**. Two impersonate the existing owners of pending Lido #135118 and ether.fi #82521, transfer to a buyer, check unchanged request economics, reject former-owner transfers and exact source-specific premature-claim errors, then transfer again. Lido's stored original timestamp remains unchanged.

Two positive controls acquire **already-finalized** Lido #135117 and ether.fi #82510 and collect actual fork ETH to the new owner. Lido pays exactly **1,000 ETH** and rejects the previous owner's collection with `NotOwner(previousOwner, buyer)`. Ether.fi intentionally allows the previous owner to *service* the request, while paying its full 369.547734083722800740 ETH to the current owner. Both controls check exact recipient balance changes, full consumption, burned NFT ownership queries, zero subsequent claimable value and rejected repeat collection. No time, source liquidity, balances, rates or operators are overridden. These controls prove native whole-collection behavior for the examples, not funded sale, callback-safe settlement, every owner's contract authority, or public onchain EXIT settlement. [Collection traces](probes/claims-collection-trace.txt), [four-test results](probes/claims-fork-results.json).

**ABI verification:** the official Lido single-claim method is `claimWithdrawal(uint256)`, which finds its checkpoint internally; its batch methods take hint arrays. The existing selector was valid. The strengthened pending test requires `RequestNotFoundOrNotFinalized(135118)`, and ether.fi requires `RequestNotFinalized()`, eliminating a generic-revert false positive. [Lido implementation source](https://github.com/lidofinance/core/blob/2da0f48f1a2a103a394dcf8760810fe9165697fb/contracts/0.8.9/WithdrawalQueue.sol), [Lido errors and claim checks](https://github.com/lidofinance/core/blob/2da0f48f1a2a103a394dcf8760810fe9165697fb/contracts/0.8.9/WithdrawalQueueBase.sol).

The initial Publicnode rerun passed the two cached pending controls but failed the new collection controls with archive-access HTTP403; that run is **not** collection evidence. The completed four-test run uses public `https://eth.drpc.org`, `--no-storage-caching`, and the exact original block. `EXIT_NATIVE_FORK_RPC` can explicitly override the endpoint; failures must remain visible. Original state observations retain their original Publicnode/Flashbots attribution.

Reproduce from this repository with Python 3 and Foundry installed:

```sh
python3 docs/viability/probes/claims-probe.py 25956536 > docs/viability/probes/claims-observations.json
python3 docs/viability/probes/claims-enrich.py
FOUNDRY_TEST=packages/source/test forge test --contracts packages/source --match-path packages/source/test/NativeClaimAdmission.t.sol --no-storage-caching -vv
```

Dependencies use the project's existing installation. RPC historical access may change; preserve failures and never replace them with fixture results. The source inventory records inspection depth, immutable repository references where available, unresolved deployment/code equivalence and the exact observations needed for a restart.
