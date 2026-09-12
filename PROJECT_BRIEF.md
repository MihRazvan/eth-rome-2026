# Cutout — project brief

[App](https://cutout-ethrome-2026.vercel.app) · [Walkthrough](https://cutout-ethrome-2026.vercel.app/?view=demo) · [Docs](docs/README.md)

## The idea

Cutout is a paid technical-review workspace. A client funds a precise question, an issuer-approved reviewer proves eligibility without publishing their credential, and an encrypted report is delivered before payment approval.

For example: a small protocol team changes a withdrawal permission and wants an independent review of that change. It can publish a non-sensitive scope, reserve a USDC reward, and require an approved qualification. The reviewer can accept without turning their credential into a public identifier across every engagement.

## What is different

The contribution is the connection between private qualification, a particular funded task and its settlement. The credential is not an NFT or a public badge. A browser-generated proof checks issuer approval, qualification class, validity and nonrevocation, and binds the result to the accepting wallet and task. The browser also encrypts the report for its recipients before storing it on Swarm.

Avalanche holds the money and verifies acceptance. Arkiv makes listings discoverable across clients, expires recruiting advertisements and streams updates. Swarm carries the documents. The report's reference and digest are committed by the assigned reviewer on Fuji, so storage alone cannot substitute a different report.

## Who does what

| Participant | Responsibility |
| --- | --- |
| Client | Specify the work, reserve payment, inspect the report, approve or dispute |
| Reviewer | Obtain approval, prove eligibility, accept, deliver the report |
| Issuer | Assess applicants, sign credentials, publish revocation state |

Today the issuer and dispute arbitrator are the Cutout team. Test enrollment is manually approved. The circuit verifies that approval; it does not measure expertise or work quality.

## What exists today

A distinctive, responsive web application; a no-account walkthrough with real browser encryption and simulated settlement; deployed Fuji contracts; public Arkiv discovery; public Swarm documents; and local/browser proof generation. [Evidence](docs/cutout/EVIDENCE.md) includes real public storage and verifier checks and a complete local paid lifecycle. The full public paid lifecycle and recorded Arkiv mission demonstrations remain acceptance items.

Wallets, rewards and scope are public. Credential contents and report plaintext are protected. This is an experimental testnet product, with a single-process proving setup and no production audit or external accreditation.

## Next beyond the hackathon

Pilot focused reviews with one real reviewer collective and a small group of protocol teams. Validate whether clients value the qualification requirement and whether reviewers value reduced credential exposure. Replace temporary gateway storage with an operator-funded retention policy, improve credential delivery and document-key recovery, and commission independent cryptographic and contract review before real-value use. The [first-100-users proposal](feedback.md#first100users-hypothesis) is a recruitment hypothesis, not claimed traction.

For the presentation, use the [cue sheet](docs/CUTOUT-TEAM-BRIEF.md). For what happens behind every click and sponsor questions, use the [presenter guide](docs/CUTOUT-PRESENTER-GUIDE.md).
