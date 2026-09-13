# Avalanche / Team1 — Track B

[All bounties](../BOUNTIES.md) · [Deployment](../DEPLOYMENT.md) · [Evidence](../EVIDENCE.md)

**The payment is for a specific review, by a proof-bound accepting wallet, under explicit delivery and review deadlines.** Avalanche is the settlement authority, not a decorative wallet connection.

## Integration

The client approves canonical Fuji test USDC and funds `QualificationEscrow`. The contract records the reward, required qualification class, deadlines and public scope commitment. The reviewer submits a task/wallet-bound Groth16 proof; acceptance verifies it against the current issuer key and revocation root. Only the assigned reviewer can commit delivery. Client approval releases USDC from escrow to that reviewer.

The same contract handles unaccepted/undelivered refunds, delayed undisputed claims and explicitly trusted arbitration. `QualificationKeys` binds a wallet to its browser's report encryption key. There is no separate platform custody balance or backend signer moving user funds.

## Track B mapping

| Requirement | Implemented behavior |
| --- | --- |
| Asset rule | A funded task fixes its USDC reward, scope, deadlines and permitted payout/refund paths |
| Eligibility policy | Acceptance verifies a current task/wallet-bound proof before assigning the reviewer |
| Settlement logic | Only the assigned reviewer delivers; payment, timeout claims, refunds and disputes follow the escrow rules |

This is our proposed fit with [Team1 Track B](https://build.avax.network/events/73a939b1-6d35-4847-9388-320024638249). The deployed system has no newly issued ERC asset token, transferable task token or tokenized non-transferable payment right. Its right to claim payment is contract state assigned to a wallet. Sponsor acceptance of that lifecycle within Track B’s asset scope is not confirmed.

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

**Verified on public Fuji:** task #4 funded 0.1 test USDC, accepted with a real browser-generated qualification proof, delivered a Swarm report and paid the assigned reviewer after client decryption. [Finalized receipts and reviewer balance increase](../evidence/saved-pass/finalized-payment.json), [browser/issuance scope and harness corrections](../evidence/saved-pass/README.md). This used actual Chromium UI and operator-owned test wallet signers; this receipt bundle does not independently sign off a human wallet-extension run. The team has also provided a [presentation video](https://youtu.be/oYqHnYT8WfU) and [slides](../../../SLIDES.md).

## Questions to expect

**Did you deploy a stablecoin?** We use canonical Circle Fuji test USDC. The local rehearsal's freely minted token is a separate test fixture. We have not deployed a new stablecoin or a separate asset token.

**Who decides the reviewer is good?** Nobody assesses expertise during enrollment. The issuer service automatically issues a participation pass after validating the signed request. The proof checks its signature, class, expiry and nonrevocation. The client evaluates the report; an externally assessed issuer would be a future integration.

**What if the client disappears?** After timely delivery and the review deadline, the reviewer may explicitly claim if there is no dispute. Refunds and arbitration are separate contract paths; no cron performs them automatically.

**Why Track B?** We are presenting the proof-enforced eligibility policy and funded task lifecycle together with settlement. Team1 accepts one track per project, so Track B is our selected target. This is an eligibility argument, not sponsor confirmation or a claim that a new token was deployed.
