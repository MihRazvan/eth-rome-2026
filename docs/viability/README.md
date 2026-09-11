# EXIT viability assessment

The strongest direction is a small, protocol-integrated market for **already queued, noncancellable withdrawal claims**. The current evidence does not support launching a general Avalanche withdrawal marketplace or treating liquid-token holders as an underserved market. Existing liquidity providers already finance many redemption waits, and ordinary small BENQI exits are too cheap on the observed routes to provide a convincing starting advantage.

This is a conditional product decision, not a finding of product–market fit. Actual claims, transfer mechanics and professional redemption strategies establish feasibility. No independent holder has yet accepted an EXIT price, no external buyer has committed capital, and no protocol has agreed to distribute the service. Those are the next gates; more demonstration trades between project wallets would not resolve them.

## Decision and product

Keep the EXIT name and focus the proposed service on a specific job: **“My withdrawal is already in the queue. My need for liquidity changed. Can someone take over the wait?”** The first candidate customer is a holder of a material, pending Lido unstETH or standard ether.fi withdrawal NFT. The buyer is a professional ETH liquidity provider with a known funding cost, source exposure limits and a collection process. The intended acquisition channel is the protocol's pending-withdrawal screen or an existing portfolio/treasury workflow, subject to an actual partner agreement.

The proposed transaction sells the entire existing NFT for a bound WETH payment on Ethereum. No claim is moved across chains. Buying a claim in its natural payout currency avoids adding an unexplained AVAX/ETH-to-USDC exposure; a later stablecoin payout option would require an explicit conversion and hedge/execution policy. A buyer can resell an uncollected NFT, but these two sources ordinarily pay the whole request and burn the receipt. The controlled test vault's partial collection and residual resale remain demonstrations of that test source, not claimed Lido or ether.fi functionality.

Begin with a read-only [**Exit Check**](https://exit-ethrome-2026.vercel.app/?check=1) and a narrowly scoped buyer/holder pilot. Exit Check inspects an actual NFT, its current owner, pending/finalized state, current implementation and available alternatives. Finalization and a source amount getter do not certify successful execution; owner restrictions and callbacks may still matter. It directs a finalized holder toward the source collection workflow rather than encouraging an unnecessary discounted sale. An optional calculator makes buyer assumptions inspectable; it does not invent a quote or display an uncommitted buyer as liquidity.

Do not build a general swap router, pooled LP vault, new token, cross-chain settlement scheme or production native-NFT trading adapter before the demand gates below. Existing contracts, quote signatures, private envelopes and maker interfaces are reusable, but their existence is not evidence that a new source or market has been admitted.

## Evidence by direction

| Direction | Evidence | Decision |
|---|---|---|
| Retail BENQI claim marketplace | Current liquid-share exit quotes are very close to redemption value; cancellation is available; existing EOA requests cannot be imported into the account prototype | Stop treating this as the launch market |
| Large BENQI exits | Observed single routes deteriorate with size, but they are not a complete split-routing benchmark; acquisition limitation remains | No positive market claim from those large-order quotes |
| Liquid ETH staking-token exit service | Origin ARM and other existing routes already buy liquid tokens and manage redemption inventory | Do not duplicate their established route without measurable advantage |
| Existing Lido/standard ether.fi NFT purchase | Pending claims exist; current NFTs transfer on a fork while retaining their source request; inspected ARM routes originate their own claims | Conditional pilot candidate |
| General exit comparison website | Can expose cheaper or already-claimable alternatives; no evidence of a standalone paying customer base or defensibility | Useful validation instrument, not a validated business |
| Async stablecoin/RWA vaults | Genuine asynchronous exits, but request transfer, permissions, cancellation and payout authority vary by implementation | Future source-by-source investigation; no universal import promise |

Detailed reports: [Avalanche alternatives](avalanche.md), [claim-source mechanics and stock](claim-sources.md), and [demand, competitors and distribution](demand.md). Their source inventories and raw observations preserve dates, addresses, implementation revisions and retrieval limitations.

## Actual market observations

At Avalanche block **95,044,397**, LFJ and Yak observations priced exits of 1–100 sAVAX at approximately **1.362 basis points** below BENQI's contemporaneous share redemption value. The observed Yak route for 1,000 sAVAX lost approximately **5.160 basis points**. These are read-only route quotations, inclusive of the quoted route's fees but not a user's gas, not signed guarantees, and not proof of globally best execution. At a hypothetical 10% annual capital hurdle, waiting alone can cost more than those spreads. Cancellation and the need to originate through a special account further weaken the proposed retail marketplace. [Pinned Avalanche observations](probes/avalanche-snapshot.json)

At Ethereum block **25,956,536**, Lido had **290 unfinalized requests**, **20,789.2103 stETH of requested face**, and **241 current owner addresses**. The median NFT was only **0.773 ETH-equivalent face**, and 153 requests were below 1 ETH. The largest owner held 4,000 ETH-equivalent face and maps to Kelp's LRTConverter in its official deployment table. Protocol inventory is not automatically a willing seller; separate addresses are not necessarily independently controlled customers. The oldest request's age was about 4.09 days, which is not a remaining-wait estimate. [Claim-source observations](claim-sources.md)

The standard ether.fi queue held **29 valid unfinalized requests**, approximately **2,240.3261 ETH face**, and **17 current owners** at the same block. Thirteen NFTs were below 1 ETH; the top three owner addresses held approximately 71% of pending face. The current fast-redemption ETH route reported a 30-basis-point fee but zero immediately redeemable capacity at that snapshot. That state can change and applies to its liquid-token exit route, not a guaranteed way to redeem an already-issued NFT. [Claim-source observations](claim-sources.md)

A reconciled **10,000-block window**, about 1.3943 days, contained 97 Lido requests for 3,862.3602 stETH and 43 standard ether.fi requests for 3,052.0855 ETH face. It did not establish a secondary-sales market. Observed nonmint ether.fi transfers burned their NFT in the same transaction and were collection/servicing paths, not demonstrated purchases. A provider returned an apparently successful but incomplete wider log range; the analysis therefore uses the narrower reconciled interval. Neither pending stock nor this short flow sample should be annualized into revenue or called the addressable market. [Methods and limitations](claim-sources.md)

## Competitive implications

Origin's multi-asset WETH ARM uses shared WETH liquidity to buy liquid stETH/wstETH/eETH/weETH, then originates withdrawals and recycles redemption proceeds. Its operator reports substantial existing ARM volume and aggregator distribution. That is evidence that redemption financing can attract activity, and a strong reason not to position EXIT as if the mechanism were new. The inspected adapters do not expose a purchase-and-credit path for arbitrary existing withdrawal NFTs; accepting an unsolicited NFT through an ERC721 receiver is not an offer to buy it. [Origin product description](https://www.originprotocol.com/blog/weth-arm-introduction), [source inspection](claim-sources.md)

Intentional is closer prior art because its repository includes selling an existing Lido NFT. EXIT's possible contribution is competitive professional quoting, source-specific eligibility and servicing, and useful optional confidentiality within an embedded workflow. That is a product hypothesis, not an established moat. An incumbent could add an existing-claim route if meaningful demand appears. [Intentional](https://github.com/zkoranges/intentional)

The negative evidence matters equally. Origin's June 2026 Sonic wind-down proposal says the business, revenue, risk and maintenance thresholds no longer justify that deployment. The retrieved proposal does not establish that every proposed action was executed. It does establish that an experienced redemption-liquidity operator itself evaluates economic viability separately from working infrastructure. [Origin governance proposal](https://governance.originprotocol.com/t/proposal-wind-down-origin-sonic-and-os-arm/227)

## Pricing and capital

A credible buyer price starts with expected recovery in the same asset, a stated remaining-time scenario, funding cost, source-loss assumptions, collection/transaction costs, risk reserve and any protocol fee. Price need not be generated by an AMM. Independently funded makers can quote competitively, provided they have a real incentive to deploy capital. Expiring signatures and a recent simulation do not reserve that capital.

The [executable model](../../packages/viability/economics.ts) discounts a single assumed terminal recovery using an explicit simple annual hurdle, deducts collection and upfront costs, and calculates the largest seller payment consistent with the fee and capital budget. It uses integer base units and conservative rounding. It does not estimate default probability, remaining time, expected recovery or a customer's willingness to sell. Those quantities must come from disclosed underwriting or the actual counterparty. If a source accrues yield during the wait, include that carry in expected terminal recovery rather than treating today's face as the future payout; BENQI is such a source.

Consider a purely hypothetical 10,000-unit recovery and a 10% annual hurdle. With no other costs, a 15-day wait supports a maximum current payment of about 9,959.07; a one-day wait supports about 9,997.26. An immediate alternative returning 9,980 therefore beats the first and loses to the second. Adding 2 units of upfront cost, 2 of collection cost, 10 of additional risk reserve, a 5-basis-point protocol fee and 1 unit of seller transaction cost eliminates even the one-day advantage: effective proceeds fall to about 9,977.27. These assumptions are illustrative, not observed market rates. [Reproducible scenarios](economic-scenarios.json)

For an already queued, noncancellable NFT, the liquid-token DEX quote is not an available seller alternative. Its owner must compare waiting against an actual offered price. Without either an available immediate route or an elicited seller reservation price, the model returns **seller floor unknown**. It deliberately cannot announce a mutually beneficial trade from face value alone.

Working capital and platform revenue are different. In a hypothetical steady state buying 1 million units of face per day at 99.8% and holding for five days, about 4.99 million units are deployed. At 30 million units of monthly face and a retained 5-basis-point fee, gross platform revenue is only 15,000 units before infrastructure, personnel, legal, partner and incentive costs. Tail waits and idle liquidity require more capital. A modest fee cannot fund an unlimited integration/support burden, and the buyer's spread is not automatically EXIT's revenue. [Operating calculation](economic-scenarios.json)

Use the prepared [holder/maker worksheet](PILOT.md) to capture actual alternatives, prices and refusals without inventing customer interest.

## Pilot gates

The thresholds below are minimum gates for the first experiment, not results already achieved. The [demand report](demand.md) proposes a larger 20-user/30-collected-position evaluation before scaling; a single accepted trade would not discharge those later operating gates.

1. **Eligible source and assets.** Demonstrate transfer and current-owner collection authority against the actual implementation; identify pause, upgrade, invalidation and permission boundaries. Exclude already-finalized claims from a wait-financing pitch. An account prototype that requires advance opt-in cannot import ordinary existing requests.
2. **Holder demand.** Discuss at least five concrete recent withdrawal situations. Identify at least two holders whose liquidity need changed after requesting, record their actual alternatives and acceptable net payment, and distinguish genuine urgency from a preference for free speed. Public addresses and forum complaints do not count as consent or customer interest.
3. **Funded buyers.** Obtain independently controlled, capital-backed quotes from at least two prospective makers for an eligible claim. Record their funding asset, maximum duration, haircut, cost assumptions and capital cap. A maker's hypothetical interest or the team's seeded wallets cannot satisfy this gate.
4. **Mutually acceptable economics.** At least one holder accepts a price that a buyer will honor without project rebates or subsidized gas concealing the spread. Compare all available alternatives at the same time and asset denomination. Record actual seller net, buyer debit, collection costs and eventual proceeds.
5. **Distribution and operation.** Obtain one concrete protocol/portfolio integration commitment or a repeatable direct channel, with a named owner for failed quotes and delayed claims. Reconcile collection and loss on a bounded pilot before expanding sources or capital.

Stop or change direction if holders consistently prefer to wait at every sustainable quote, if acquisition cannot preserve rights, if the best available alternatives dominate after costs, or if prospective buyers require uneconomic subsidies. If demand exists only during exceptional stress, evaluate a specialist or embedded feature with correspondingly limited fixed costs rather than assuming a continuously active retail exchange.

## Current delivery and remaining limits

The native-source inspector and economics calculator are read-only validation tools. Source reads are pinned to one block; source implementation changes are visible. Missing RPC data, invalid requests and absent buyers remain explicit. A subsequent current read at block 25,956,640 found ether.fi #82510 already closed, illustrating why the historical snapshot cannot serve as a present sale listing. The default public endpoint also began rejecting the historical pin as an archive request; current reads remained available. The separate local/Fuji test-vault implementation retains public/private negotiation, exact settlement and its own partial-payment lifecycle. It must not be presented as live Lido or ether.fi trading.

The Avalanche/Team1 track should not determine source suitability. An Ethereum-native source would require Ethereum-native settlement; a Fuji test-vault demonstration does not prove that deployment or establish a cross-chain claim. Arkiv discovery and Swarm records can remain useful in a future RFQ workflow, but their integration does not establish demand or confer source ownership.

No external outreach, mainnet purchase, customer commitment or source partnership occurred during this assessment. The next progress should come from concrete holder and maker evidence using these tools. Until those gates pass, the accurate conclusion is **a narrower, technically credible pilot candidate with unverified commercial demand**.
