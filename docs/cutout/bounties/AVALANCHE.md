# Avalanche / Team1 — Track A

[All bounties](../BOUNTIES.md) · [Deployment](../DEPLOYMENT.md) · [Evidence](../EVIDENCE.md)

**The payment is for a specific review, by a qualified accepting wallet, under explicit delivery and review deadlines.** Avalanche is the settlement authority, not a decorative wallet connection.

## Integration

The client approves canonical Fuji test USDC and funds `QualificationEscrow`. The contract records the reward, required qualification class, deadlines and public scope commitment. The reviewer submits a task/wallet-bound Groth16 proof; acceptance verifies it against the current issuer key and revocation root. Only the assigned reviewer can commit delivery. Client approval releases USDC from escrow to that reviewer.

The same contract handles unaccepted/undelivered refunds, delayed undisputed claims and explicitly trusted arbitration. `QualificationKeys` binds a wallet to its browser's report encryption key. There is no separate platform custody balance or backend signer moving user funds.

## Code and deployment

| What | Source / artifact |
| --- | --- |
| Payment and qualification rules | [QualificationEscrow.sol](../../../experiments/qualification/contracts/src/QualificationEscrow.sol) |
| Wallet report-key registry | [QualificationKeys.sol](../../../experiments/qualification/contracts/src/QualificationKeys.sol) |
| Proof relation | [circuit.go](../../../experiments/qualification/prover/circuit.go) |
| Wallet-driven UI actions | [main.ts](../../../experiments/qualification/pilot/web/main.ts), [settlement.ts](../../../experiments/qualification/pilot/settlement.ts) |
| Contract addresses, token, networks | [Deployment guide](../DEPLOYMENT.md) |
| Deployment receipts and code hashes | [Public manifest](../../review-pass/evidence/fuji-rollout/deployment.json) |
| Source verification | [Recorded results](../../review-pass/evidence/fuji-rollout/source-verification.json) |

## Demonstration

Start from a funded task and show its scope/reward receipt. In the reviewer browser, generate the proof and sign acceptance. Seal/deliver a report. In the client browser, open it and approve payment. Show the resulting Paid state and reconcile reviewer USDC before/after. Gas is paid separately in test AVAX.

**Verified:** deployed/source-verified contracts, actual public funding and a refund, real browser proofs verified by the deployed contract and simulated against a funded task. **Still required:** the complete public acceptance → delivery → payment receipt bundle. The local paid lifecycle is evidence of implementation, not a substitute for public testnet completion.

## Questions to expect

**Did you deploy a stablecoin?** We use canonical Circle Fuji test USDC. The local rehearsal's freely minted token is a separate test fixture. The [official Track A description](https://build.avax.network/events/73a939b1-6d35-4847-9388-320024638249) asks for a stablecoin application with a complete verifiable flow, not issuance of a new currency.

**Who decides the reviewer is good?** The issuer approves eligibility; currently that is our experimental team issuer. The proof checks approval, not professional competence. The client evaluates the report.

**What if the client disappears?** After timely delivery and the review deadline, the reviewer may explicitly claim if there is no dispute. Refunds and arbitration are separate contract paths; no cron performs them automatically.

**Why Track A rather than both tracks?** The central product is payment for work. Team1 accepts one track per project. We do not claim a second Track B entry.
