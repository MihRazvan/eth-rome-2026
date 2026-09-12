# EXIT — preserved earlier project

This is the earlier README, archived on 12 September 2026. Its integration status and commands describe EXIT at that point, not current Cutout. Return to the [Cutout README](../../README.md) or [documentation index](../README.md). Original implementation, research, handoff documents and Git history are preserved.


**Sell your withdrawal. Get paid now. Let the buyer wait.**

EXIT is testing a narrower opportunity: an owner whose liquidity needs changed **after entering a noncancellable withdrawal queue** can sell the existing claim to a buyer willing to wait. The [viability assessment](../viability/README.md) explains why ordinary BENQI exits and a generic liquid-token marketplace are weak launch choices. Commercial demand and independent buyer capital remain unverified.

[Open Exit Check](https://exit-ethrome-2026.vercel.app/?check=1) to inspect a real Lido unstETH or standard ether.fi NFT on Ethereum, without connecting a wallet. It reports source state at one block and provides an optional calculation using your own assumptions. It does not trade native NFTs, publish bids or guarantee collection. Finalized claims point toward the source's collection workflow.

The separate local onchain product demonstrates public/private offers, exact payment, collection and residual resale using a disclosed test vault. [Open its labelled visual preview](https://exit-ethrome-2026.vercel.app/?preview=1). The static preview has no hosted settlement backend.

## Inspect an actual claim

```sh
npm ci
npm run dev
# Open http://127.0.0.1:5173/?check=1; no local chain or maker API needed.
npm run inspect:claim -- lido 135118          # current public Ethereum read
npm run inspect:claim -- etherfi 82520       # current public Ethereum read
npm run research:economics                    # hypothetical, reproducible cost scenarios
```

NFT IDs in these commands are public research examples, not your assets. Age is not remaining wait; a source amount getter is not a simulated payout. RPC failures remain errors. No fixtures replace source reads. The optional CLI block argument requires an RPC with access to that historical state; public providers can reject older reads.

## Run the real local product

Requires Node **24.12+**, npm, Foundry **1.5.1** (Forge/Anvil), and Chromium for browser tests.

```sh
npm ci
npm run start:local
```

Open **http://127.0.0.1:5173**. This starts an isolated Anvil chain on 8547, deploys funded test contracts, starts the maker/discovery API on 8787, and starts the app. Ctrl+C stops the three child services. Logs/manifests are under `.runtime/local` and `.runtime/*.log`. It refuses occupied ports and never reuses a live manifest. A fresh start resets **local** demo records and chain only.

Browse first, then select **Seller** in Local test wallets. Portfolio → Get funds gives valueless test USDC; Create originates a genuinely backed 10,000-unit claim. Sell a withdrawal → Request fresh offers → Review sale. After purchase, select the acquiring maker in the local wallet selector, inspect Portfolio, collect and withdraw. The local chain mines timed blocks as well as transactions, so payouts mature while you wait. Source installments release 40% after 60 seconds and the remainder after 120 seconds. These are disclosed test-source timers, not accelerated BENQI time.

Private Offers generates a separate non-extractable browser key and wallet-signed certificate, registers its active hash onchain, and encrypts bids before byte upload. A buyer can submit a custom private price from Claim detail → Make an offer. Seller reconnect/reload preserves keys in IndexedDB; another device cannot recover them from a wallet signature. Use Private offer device keys below the app to rotate/revoke future encryption. Settlement exposes submitted terms and addresses, including on failed transactions.

Private bids reuse sufficient allowance or request a separately disclosed 100,000 test-USDC spending limit. This public limit is independent of the bid price; it does not reserve funds.

The local identities use the standard public Anvil mnemonic **only on chain 31337**. They are not Fuji keys. The local storage/index adapter is explicitly labelled and is not sponsor evidence. Team-operated demo makers use public rates 99.60%, 99.40%, 99.00%; private demonstration rates are randomly drawn in 99.00–99.60%. These are demonstration quotes, not commercial valuation or guaranteed execution.

## Verify

```sh
npm run check          # TypeScript, privacy/recovery tests, Solidity tests, production build
npm run test:browser   # starts local stack if absent; visible actions + independent chain checks
npm run scenario       # running stack: exact public lifecycle + separate adverse scenario
npm run test:source    # pinned source forks; BENQI future operator publication explicitly simulated
npm run preflight      # read-only readiness; never publishes or prints secrets
npm run probe:sponsors # sponsor probe; performs writes when credentials are configured
```

The integrated Solidity suite reports 39 tests: 16 base cases, two invariant campaigns, and 21 reviewer-harness tests (including 16 inherited repeats and five independently authored probes). Invariants each run 128×64 actions with zero reverts. Evidence preserves actual scope rather than calling inherited repeats new coverage. This code is **not audited**.

## Actual integration status

- **Local onchain product:** purchase, partial collection, stale quote rejection, resale, final collection, adverse outcome and continuing recovery verified.
- **Privacy:** real HPKE, purpose-bound separate keys, registry rotation/revocation, custom client ciphertext, reload, outsider separation and public settlement verified locally.
- **Native ETH claims:** live read-only inspection plus four pinned Ethereum fork tests prove sampled pending-NFT transfer/resale and already-finalized collection to the new owner. This is not a native-NFT sale integration or production admission. See [source evidence](../viability/claim-sources.md).
- **BENQI:** three pinned-mainnet-fork tests validate caller-owned account origination, ownership, cancellation, whole-request collection and overdue-share recovery. The account is an admission prototype, not an enabled market source. See [source evidence](../evidence/benqi-source.md).
- **Arkiv:** SDK 0.8.1 live Tiramisu compound discovery reads verified. Publication/native expiry require a funded Arkiv signer and remain unverified.
- **Swarm:** gateway reachability verified; actual upload/independent live retrieval require an upload endpoint and funded postage and remain unverified.
- **Fuji:** deployment/lifecycle blocked by missing funded deployment/maker accounts. No public chain transactions are claimed.

The [product research](../research/README.md) covers comparable markets, trading UX, independent privacy findings and inspected agent workflows. The project-local `$exit-verify` skill packages the release checks.

See [acceptance ledger](../ACCEPTANCE.md), [independent contract review](../evidence/independent-security-review.md), [runtime review](../evidence/runtime-review.md), [Arkiv schema](../../arkiv/schema.md), and [genuine integration friction](../../friction.md).

## Public deployment

Use testnet-only accounts with gas; four distinct addresses are required (deployer plus three makers). Configure `.env` from `.env.example`; never put secrets in `VITE_` variables. Run `node --env-file=.env --import tsx scripts/deploy.ts --fuji`, then the same runtime server with `EXIT_DEPLOYMENT=deployments/fuji.json`. The generated public manifest uses a browser-safe public RPC; a secret provider URL stays server-side. The runtime needs persistent storage for public key certificates and configured Arkiv/Swarm write access. See [deployment guide](../DEPLOYMENT.md).

`?preview=1` is an explicitly labelled visual fixture preview. It never replaces failed live reads. A hosted static preview does not prove a hosted trading backend or funded Fuji contracts.

## Repository

`contracts/` settlement + disclosed test source; `packages/shared/` canonical EIP-712 quote and generated ABIs; `packages/transport/` privacy/index/storage; `packages/client/` wallet/chain adapter; `packages/runtime/` maker service; `packages/source/` separate source fork probes; `packages/viability/` native read inspection and explicit economics; `apps/web/` receipt market. MIT for new EXIT work; third-party notices preserved. Supplied handoff material predates implementation and is retained in `docs/handoff/`. Git history records actual work; no provenance rewriting.
