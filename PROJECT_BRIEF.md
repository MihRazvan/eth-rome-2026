# Deaddrop — project brief

[App](https://cutout-ethrome-2026.vercel.app) · [Walkthrough](https://cutout-ethrome-2026.vercel.app/?view=demo) · [Docs](docs/README.md)

## The idea

Deaddrop is a paid technical-review workspace. A client funds a precise question, a reviewer proves valid enrollment without publishing their credential, and an encrypted report is delivered before payment approval.

For example: a small protocol team changes a withdrawal permission and wants an independent review of that change. It can publish a non-sensitive scope, reserve a USDC reward, and receive a private report. The reviewer can accept without turning their credential into a public identifier across every engagement.

## What is different

The contribution is the connection between private qualification, a particular funded task and its settlement. The credential is not an NFT or a public badge. A browser-generated proof checks an issuer signature, the task’s credential class, validity and nonrevocation, and binds the result to the accepting wallet and task. The browser also encrypts the report for its recipients before storing it on Swarm.

Avalanche holds the money and verifies acceptance. Arkiv makes listings discoverable across clients, expires recruiting advertisements and streams updates. Swarm carries the documents. The report's reference and digest are committed by the assigned reviewer on Fuji, so storage alone cannot substitute a different report.

## Who does what

| Participant | Responsibility |
| --- | --- |
| Client | Specify the work, reserve payment, inspect the report, approve or dispute |
| Reviewer | Choose work, complete automatic setup, accept, deliver the report |
| Issuer service | Validate signed enrollment requests, issue private passes, maintain revocation state |

Enrollment is open. The server-side issuer validates the wallet-signed encrypted request and returns a signed pass automatically; nobody on the team must approve it. The pass proves enrollment, not assessed expertise or report quality. The Deaddrop team controls the issuer and dispute arbitrator.

## What exists today

A distinctive, responsive web application; a no-account walkthrough with real browser encryption and simulated settlement; deployed Fuji contracts; public Arkiv discovery; public Swarm documents; and local/browser proof generation. [Evidence](docs/deaddrop/evidence/saved-pass/README.md) includes a complete public paid task: browser pass issuance/collection, proof-checked acceptance, encrypted Swarm delivery, client decryption and finalized 0.1 test USDC payment. Real Arkiv two-browser publication and native expiry were also captured. These used operator-controlled wallets; independent teammate review and final presentation recording remain separate.

Wallets, rewards and scope are public. Credential contents and report plaintext are protected. This is an experimental testnet product, with a single-process proving setup and no production audit or external accreditation.

## Next beyond the hackathon

Pilot focused reviews with one real reviewer collective and a small group of protocol teams. Validate whether clients value the qualification requirement and whether reviewers value reduced credential exposure. Replace temporary gateway storage with an operator-funded retention policy, integrate externally assessed qualifications and improve document-key recovery, and commission independent cryptographic and contract review before real-value use. The [first-100-users proposal](feedback.md#first100users-hypothesis) is a recruitment hypothesis, not claimed traction.

See the [user flow](docs/deaddrop/USER-FLOW.md), [architecture](docs/deaddrop/ARCHITECTURE.md) and [sponsor integrations](docs/deaddrop/BOUNTIES.md) for implementation details.
