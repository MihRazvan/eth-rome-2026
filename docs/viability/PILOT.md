# First existing-claim pilot

This is a prepared interview and evidence worksheet, not a record of recruited users or authorized transactions. The current [Exit Check](https://exit-ethrome-2026.vercel.app/?check=1) is read-only. A native-NFT purchase needs a separately implemented and reviewed settlement path plus participants' actual authorization.

## Holder session

Ask about a concrete withdrawal before describing a fast-exit price. Record answers voluntarily; a public wallet or support post does not establish interest.

- What source and withdrawal NFT is involved? Has the owner entered the queue already?
- Why did they enter the queue instead of selling the liquid token? What changed afterward?
- What payment deadline now matters? What happens if they wait?
- What alternatives can they actually execute now, and what would each return after costs?
- What minimum net amount in ETH/WETH would make selling preferable to waiting? Do not supply a suggested discount first.
- If nothing changed and waiting is acceptable, record that as negative demand evidence.

Use Exit Check together: confirm the source, current owner, block and state. A public example belongs to its displayed owner, not the participant. Do not ask for a seed phrase or private key. Finalized requests go to the source's collection workflow; closed, invalid or changed implementations are excluded from the pricing exercise. A pending result alone does not prove seller authority or that a transfer/collection will execute.

## Buyer session

Give each prospective maker the same eligible source/claim and observation time. Ask for their expected recovery, remaining-time scenarios, funding hurdle, source-loss assumption, execution/collection costs, risk reserve and capital cap. Use the calculator to expose these assumptions; its output is an illustrative ceiling, not their bid.

Request a specific payment amount and expiry, identify who controls the proposed funds, and distinguish an indicative price from an executable, independently funded offer. Ask what changes would make them withdraw the quote. Repeat under doubled delay and reduced recovery. Never count the project's seeded makers as external market demand.

## Evidence record for each attempt

| Field | Record |
|---|---|
| Voluntary participant reference / date | Unfilled |
| Source contract, NFT ID, Ethereum block | Unfilled |
| Current request state and authority limitations | Unfilled |
| Concrete new liquidity need and deadline | Unfilled |
| Available alternatives, timestamp and all costs | Unfilled |
| Seller's stated minimum net payment | Unfilled |
| Buyer identity/control independence and funding evidence | Unfilled |
| Buyer price, denomination, assumptions, expiry | Unfilled |
| Seller decision, including refusal and reason | Unfilled |
| Execution / collection | Not enabled in Exit Check |
| Actual net, debit, costs, recovered amount | Unfilled; never replace with model values |

Keep unsuccessful attempts in the denominator. Two signatures from makers relying on the same project funds do not establish independent liquidity. Do not place interview notes or nonpublic participant information on Arkiv, Swarm or a public repository without consent.

## Decision after the first sessions

The [assessment](README.md#pilot-gates) defines the minimum experiment gates. First establish two concrete holder needs, two independent funded counterparties and overlap between a seller's minimum and a sustainable buyer price. Then prepare a bounded, separately authorized execution experiment. Do not infer commercial viability from wallet self-trades.

The [demand report](demand.md#discovery-and-falsifiable-gates) proposes larger operating tests before scaling. If quotes never meet seller needs, stop or change the customer/source. If demand is episodic, price and staff an occasional embedded service accordingly. If a protocol wants the feature, establish who owns distribution, support and budget before assuming that an integration will pay for itself.
