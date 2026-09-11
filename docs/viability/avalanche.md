# Avalanche viability: reject the broad retail claim-market thesis

Research completed 11 September 2026. This conclusion is independent of the existing implementation and sponsor targets. **Do not launch EXIT as a generally useful Avalanche withdrawal marketplace on the evidence collected.** BENQI retail holders have a cheap liquid-token exit and cannot import an existing ordinary-wallet request into the proposed account architecture. The three alternative assets examined do not rescue the thesis: Hypha is winding down, rsAVAX has a five-minute withdrawal delay, and the sampled USD vault currently has a one-hour delay with no outstanding withdrawals.

There is one unproven residual hypothesis: negotiated purchases of **large, previously wrapped BENQI requests with substantial elapsed cooldown** during periods when immediate liquidity is expensive. That is a distinct, narrower business requiring advance origination and real buyers. Current evidence does not justify building it further. A read-only exit comparison is a useful research tool; it is not evidence that a fee-bearing product has demand.

## What was actually observed

All contract reads and quote comparisons use Avalanche C-Chain **43114**, block **95,044,397**, timestamp **2026-09-11 20:25:28 UTC**, hash `0xad9e1b5b70140e6fdda33a4ace507b7933ab89ea816b3c13c36bf1f6d1e2912f`. Public RPC: `https://api.avax.network/ext/bc/C/rpc`. No credentials, transactions, approvals, state overrides, faucets or funded accounts were used.

The benchmark is a successful onchain quoter `eth_call`, not an executed swap. Six LFJ direct quotes and six YakRouter comparisons returned nonzero output and complete paths. The script also retained six poor USDC-intermediate LFJ quotes rather than silently excluding them from raw evidence. The normalized snapshot selects the better of the two direct/broader-router observations, not the best possible market-wide execution. [Normalized snapshot](probes/avalanche-snapshot.json), [raw LFJ and BENQI reads](probes/avalanche-quotes.json), [Yak and alternatives](probes/avalanche-alternatives.json)

### BENQI source identity and state

| Field | Pinned observation |
|---|---|
| sAVAX proxy | `0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE` |
| Implementation | `0xb791c7a42fd0d10f90deaa906a8735f79719fa53` |
| Implementation code hash | `0x94d7a09bfd88713ac90a6c961e4423bb96eaf9ec89bdd78e48eaa101e530a2b8` |
| AVAX per whole sAVAX | `1.283991691573712883` |
| Cooldown / redemption window | 15 days / 2 days |
| Total pooled AVAX | 23,165,580.6059 |
| sAVAX held by its own source contract | 320,007.6398 shares |
| Source native AVAX balance | 21,679.3410 |
| Paused / minting paused | false / false |

The custody balance is not the current active queue: it includes pending, redeemable and overdue shares, and potentially unsolicited transfers. Native balance is not proof that every future withdrawal can be serviced. The source depends on privileged liquidity movements and reward publication; the implementation is upgradeable. [Verified source and ABI](https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api?module=contract&action=getsourcecode&address=0xb791c7a42fd0d10f90deaa906a8735f79719fa53)

A complete bounded scan of **10,000 blocks**, from **17:28:04 to 20:25:28 UTC**, found **five UnlockRequested events from four addresses**. Three still had requests at the pin; their counts were 2, 1 and 14. All three addresses had no code at that block. Cancellation of index zero succeeded in read-only `eth_call` from each requester. Separate pinned reads still returned the same counts, as expected: nothing was actually cancelled. This is a small recent-flow sample, not customer demand, unique humans, total queue size or a TAM estimate. [Authority observations](probes/avalanche-authority.json)

### The existing holder's options

BENQI explicitly presents secondary-market swaps as the immediate alternative to its 15-day unstaking route. During cooldown the shares continue earning source rewards; the final redemption window has different exchange-rate treatment. [BENQI overview](https://docs.benqi.fi/benqi-liquid-staking/overview), [claim workflow](https://docs.benqi.fi/benqi-liquid-staking/getting-started)

The current source keys requests to `msg.sender`. Cancellation of an unexpired request removes it and returns its original share amount to that caller. Ordinary redemption pays the caller; there is no request transfer function. A token approval therefore cannot transfer an already-started ordinary-wallet request or its elapsed cooldown into EXIT. Expired requests have a separate share-recovery route. Existing fork evidence already exercises wrapper ownership changes, cancellation and overdue recovery, with explicit simulation caveats. [Existing pinned-fork evidence](../evidence/benqi-source.md)

A new bounded account can originate a request and later change its economic owner while preserving the request timestamp. That requires the seller to use the account **before requesting withdrawal**. Cancelling an ordinary-wallet request and requesting again through a wrapper resets the source clock, destroying the specific elapsed-time advantage EXIT would hope to sell. Signing a new EIP-712 quote cannot change that source behavior.

## Executable quote benchmark: cancellation plus sale is cheap at retail sizes

LFJ's published Avalanche v2.2 quoter is `0x9A550a522BBaDFB69019b0432800Ed17855A51C3`. Yak's published Avalanche router is `0xC4729E56b831d74bBc18797e0e17A295fA77488c`. Their actual verified ABIs were fetched, code hashes retained, and quotes requested at the same block. Yak searched at most two hops without splitting the order. [LFJ official deployments](https://developers.lfj.gg/deployment-addresses/avalanche), [pinned Yak repository](https://github.com/yieldyak/yak-aggregator/tree/50d8be725730b83f231b0a69ff4da62136a49692)

| sAVAX sold | Current conversion value, AVAX | LFJ output, WAVAX | Yak output, WAVAX | Better observed discount to NAV |
|---:|---:|---:|---:|---:|
| 1 | 1.283992 | 1.283817 | 1.283817 | 1.362 bps |
| 10 | 12.839917 | 12.838168 | 12.838168 | 1.362 bps |
| 100 | 128.399169 | 128.381680 | 128.381680 | 1.362 bps |
| 1,000 | 1,283.991692 | 1,283.267435 | 1,283.329124 | 5.160 bps |
| 10,000 | 12,839.916916 | 6,511.125441 | 6,511.125441 | 4,928.997 bps |
| 100,000 | 128,399.169157 | 12,035.797834 | 12,035.797834 | 9,062.627 bps |

This is **discount to current source conversion value**, not pure price impact. Quoted output incorporates the quoter's modeled pool fees; cancellation, approval, swapping gas and unwrapping are excluded. WAVAX is the output denomination; no USD conversion or stablecoin hedge was tested. Current NAV is not a promise of the request's eventual payout.

The small LFJ trades use pool `0x883eA72c2A46F7AcB3820855344C43666c6cc5c0`. The large trades fall back to `0x4b946c91C2B1a7d7C40FB3C130CdfBaf8389094d`. Those discontinuities make it especially wrong to interpolate one continuous liquidity curve or label the large figures “Avalanche slippage.” Router coverage, split liquidity and changing pools can improve results. Repeatedly quoting 1,000 shares does not prove ten sequential trades can sell 10,000 at the original price: the first trade changes reserves.

Even with those limitations, the retail comparison is decisive against an assumed 25–100 bps claim discount. A 25 bps haircut is economically worse than this observed 1.36–5.16 bps exit before comparing transaction costs. A different claim price could compete, but no funded buyer offering it was found or assumed. Cheap cancellation and liquid sale must be the baseline, not an artificial choice between EXIT and fifteen days of helpless waiting.

## Economics of the surviving narrow hypothesis

For a request of `q` shares, define `D(q)` as the best actually available cancellation-plus-sale net proceeds; `V(q,t)` as the uncertain future redeemable AVAX after remaining time `t`; and `P` as the seller's EXIT payment. The seller needs `P - sellerCosts > D(q)`. A buyer needs risk-adjusted `V(q,t) - P` to exceed funding cost, execution/servicing cost, source risk and any currency hedge. Both inequalities must hold simultaneously.

Elapsed cooldown may improve the buyer's capital turnover relative to buying fresh sAVAX and initiating a full fifteen-day request. That benefit is real in principle, but cannot be assumed to exceed costs. Source rewards continue during BENQI cooldown, so a valuation that subtracts financing cost while ignoring expected source carry is incomplete; treating future carry as guaranteed is equally wrong. Resale liquidity would introduce another unproven buyer requirement.

For scale only, a hypothetical 5% annual funding rate costs about 20.55 bps over fifteen days or 1.37 bps over one day before source carry, risk and fees. These are sensitivity calculations, not observed maker funding costs or recommended returns. Small retail NAV discounts leave little room for additional product fees unless other measurable advantages justify them. At larger sizes the observed router output suggests a question worth testing, not a validated large-block business.

BENQI also pays AVAX, while EXIT currently demonstrates test-USDC purchases. An unhedged stablecoin-funded buyer is taking AVAX price exposure alongside waiting risk. Paying in WAVAX could remove that currency mismatch, but would not solve source access, customer acquisition or maker liquidity. BENQI whole-request redemptions also do not validate the partial-installment demonstration; retaining residual recovery rights is useful, but cannot manufacture partial source payouts.

## Alternative Avalanche sources: three checks, no compelling pivot

### 1. Hypha stAVAX, formerly GoGoPool ggAVAX — reject as a new growth market

The official `hypha.sh` homepage redirects to an **End of Life** page. The publisher's sunset announcement says operations ended August 15, 2026 and recovery access remains through December 31. That is more relevant than 2024–25 onboarding discussions and old liquidity claims. The recovery site's body could not be fetched through this shell/browser (HTTP 403/empty extracted content); the redirect/title and publisher announcement were inspected. No recovery transaction was attempted. [Current official site](https://hypha.sh/), [publisher sunset announcement](https://www.linkedin.com/posts/hypha-sh_avalanche-avax-liquidstaking-activity-7493794593038073856-tFip)

Current token proxy `0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3` points to implementation `0xa14505f315143e16b999b3aca083d306b85b803e`, which differs from the repository manifest. Its verified redemption functions lack the queue-only restriction still present in the inspected repository version. The actual vault reported 395,844.6362 AVAX total assets and 393,238.1776 available for staking. This is consistent with substantial recoverable liquidity, not a reason to assume an urgent fifteen-day buyer market. [Current implementation](https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api?module=contract&action=getsourcecode&address=0xa14505f315143e16b999b3aca083d306b85b803e)

Queue `0x61f908D4992a790A2792D3C36850B4b9eB5849A3` reported 14 pending requests, zero fulfilled requests and zero allocated funds. Its requester-bound records, cancellation conversions and expiry recovery differ from BENQI. These few remaining requests could support recovery tooling, but not an inferred growing market. Do not count ggAVAX and stAVAX as separate opportunities. [Pinned queue source](https://github.com/multisig-labs/gogopool/blob/58126a48d068282d1185382c625ae560dd998594/contracts/contract/WithdrawQueue.sol)

### 2. Yield Yak rsAVAX — reject current waiting-time wedge

Vault `0xDf788AD40181894dA035B827cDF55C523bf52F67` and delayed withdrawer `0xfF464A521077bd233C4e429BeD76d1442015Eb62` are real deployed contracts identified in the publisher's repository. At the pin, sAVAX withdrawals were enabled, the contract unpaused, delay **300 seconds**, completion window **1,500 seconds**, fee zero and outstanding shares approximately **6.1285 rsAVAX**. This agrees with the publisher's five-minute manual/within-thirty-minute automatic workflow; it offers little ordinary urgency premium. [Primary withdrawal guide](https://docs.yieldyak.com/milk-vaults/suzaku-restaking-lrts), [pinned deployment record](https://github.com/yieldyak/boring-vault/blob/957b38cfe9f2339468d8fe00ef2a23b0eb651f32/deployments/AvalancheSAvaxDeployment.json)

Requests are stored by account and output asset. Third-party completion pays the recorded account; it does not transfer ownership. Cancellation returns vault shares. Completion uses a protected exchange-rate calculation and depends on asset availability and authorization. Existing ordinary-wallet requests therefore pose the same import problem. The returned asset is sAVAX, not native AVAX: downstream BENQI unstaking remains a separate decision.

### 3. Yield Yak USD Milk AI deployment, onchain symbol aiUSD — no current evidence to pursue

Vault `0xdC038cFf8E55416a5189e37F382879c19217a4CB`, withdrawer `0xa131e4ddA78Ed81aE5F467D2EA3Ef8b223c2aAFB`, and native USDC output are identifiable in the publisher's deployment files. The old file configures eight hours; **current getter output is one hour**, with a one-day completion window, zero withdrawal fee, zero outstanding shares and unpaused withdrawals. Source identity and units were retained in raw observations. A stale file would overstate the waiting problem eightfold. [Deployment record](https://github.com/yieldyak/boring-vault/blob/957b38cfe9f2339468d8fe00ef2a23b0eb651f32/deployments/AvalancheUSDMilkAIDeployment.json), [verified withdrawer](https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api?module=contract&action=getsourcecode&address=0xa131e4ddA78Ed81aE5F467D2EA3Ef8b223c2aAFB)

The stablecoin denomination removes one currency mismatch but leaves manager, accountant, rate-bound, liquidity and account-binding risks. No observed backlog or third-party willingness to finance these withdrawals establishes demand. The same repository documents an AtomicQueue/solver alternative, which is additional prior art rather than proof it is deployed for these vaults. [Withdrawal mechanism comparison](https://github.com/yieldyak/boring-vault/blob/957b38cfe9f2339468d8fe00ef2a23b0eb651f32/spec/Withdrawals.md)

## Falsifiable decision and kill criteria

**Reject the broad Avalanche retail marketplace now.** Reopen only if public observations plus voluntarily supplied customer evidence establish all of the following; no outside outreach was authorized or performed in this pass:

1. A real seller can transfer the exact existing entitlement, or demonstrably chooses advance wrapper origination despite its extra risk and effort. Existing EOA BENQI requests fail the current acquisition design.
2. Repeated, timestamped quotes over different market conditions show a material net improvement against cancellation-plus-swap or direct redemption, including costs and output denomination. A single shallow-route quote does not pass.
3. At least two independently controlled prospective makers supply executable quotes and identify sufficient authorized capital. Three keys operated by the builder do not validate commercial buyer demand.
4. Underwriting remains profitable under delayed collection, rate changes, servicing costs and supported adverse outcomes without emissions or assumed resale. Kill if the achievable spread is consumed by these costs.
5. The source remains supported and produces a meaningful continuing flow of eligible requests. A sunset recovery backlog, one-hour delay, or one tiny queue sample does not pass this criterion.

Avalanche's scheduled September 22 Helicon change reduces the validator minimum to 48 hours, while official technical documentation says delegator minimums remain unchanged. BENQI's measured contract cooldown is still fifteen days; do not automatically translate an underlying network change into a source timing change. It is nevertheless a reason to recheck duration assumptions, especially for validator-based alternatives. [Official upgrade guide](https://academy.avax.network/docs/primary-network/helicon-upgrade)

Avalanche/Team1, Arkiv and Swarm can constrain implementation or reward evidence. They do not create sellers, improve DEX spreads or establish a buyer risk budget. If continued work needs a commercial thesis rather than a technical demonstration, the honest next step is validation of a different problem—not adding more sources to preserve EXIT's current narrative.

## Reproduction and limits

From an installed repository checkout:

```sh
npx tsx docs/viability/probes/avalanche-quotes.ts 95044397
npx tsx docs/viability/probes/avalanche-alternatives.ts
npx tsx docs/viability/probes/avalanche-authority.ts
npx tsx docs/viability/probes/avalanche-snapshot.ts
```

Omit the block argument for a fresh first snapshot, then run the dependent probes. All scripts are public reads or deterministic transforms; generated JSON records actual failures rather than inventing replacement values. Source APIs may become unavailable and public RPC historical-state retention may change. The normalized snapshot explicitly sets `fundedExitOffer: null` and validates six positive same-block comparisons. No benchmark is a guaranteed transaction, current executable offer, source integration, independent audit or proof of customer demand.

Verification: all four public-data scripts executed successfully; the normalized artifact validated six positive same-block comparisons. A strict standalone TypeScript check of all four probe files passed (`tsc --ignoreConfig --noEmit --skipLibCheck --strict --types node --target ES2022 --module ESNext --moduleResolution Bundler ...`). All JSON artifacts parsed successfully and `git diff --check` passed. These checks validate the probes and records, not the commercial thesis.
