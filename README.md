# Deaddrop

<img width="840" height="300" alt="deaddrop-cover-840x300" src="https://github.com/user-attachments/assets/36a6d79e-39d8-45d2-b23c-36f11404a660" />

**Hire a qualified reviewer. Keep their credential private. Pay for the work.**

Deaddrop lets a team fund a technical review in USDC, require a private proof of issuer-approved qualification, and receive an encrypted report. The client opens the report and approves payment; Avalanche settles it. Wallets and payments remain public.

[Open Deaddrop](https://cutout-ethrome-2026.vercel.app) | [Interactive demo](https://cutout-ethrome-2026.vercel.app/?view=demo) | [Video demo](https://youtu.be/oYqHnYT8WfU) | [Project brief](PROJECT_BRIEF.md) | [Quickstart](docs/deaddrop/QUICKSTART.md) | [User flow](docs/deaddrop/USER-FLOW.md) | [Architecture](docs/deaddrop/ARCHITECTURE.md) | [Bounties](docs/deaddrop/BOUNTIES.md) | [Docs index](docs/README.md)

> The product was previously called Cutout. The app URL and browser storage namespaces are retained so existing participants keep their private keys. [Rebrand and bounty decisions](docs/design/deaddrop/README.md).

## Problem first

A team needs a second pair of eyes on a sensitive change: “Can an unauthorized wallet withdraw after this permissions update?” It wants an approved reviewer and a funded agreement. The reviewer should not have to publish a reusable credential identifier for every small engagement, and the resulting report should stay between the participants.

Deaddrop separates those responsibilities. An issuer approves the reviewer. A proof checks that approval without revealing the credential. The client evaluates the work. An escrow holds and pays the reward.

## How it works

1. **Get qualified.** Apply in Deaddrop. The browser saves your private pass and sends an encrypted application. After issuer approval, collect the pass in the app; no credential files need to change hands.
2. **Fund a task.** The client writes a public scope and locks test USDC on Avalanche Fuji. A separate Arkiv transaction lists the task for discovery.
3. **Prove eligibility.** The reviewer proves, in their browser, that the required credential is valid and unrevoked. The proof is bound to this task and wallet. Fuji verifies it when they accept.
4. **Seal the report.** The browser encrypts the report for the client and reviewer, uploads ciphertext to Swarm, and checks retrieval. A Fuji transaction commits its reference and hash.
5. **Open and pay.** The client retrieves and decrypts the report, then approves payment to the assigned reviewer.

<img width="2120" height="1035" alt="deaddrop-user-flow" src="https://github.com/user-attachments/assets/9bd12635-6c7d-49ea-a96b-bd2720fafef2" />

Read the [complete user flow](docs/deaddrop/USER-FLOW.md) for qualification issuance, wallet roles, deadlines and disputes.

![Deaddrop workspace on desktop](docs/design/deaddrop/assets/application.png)

## Try it

**No setup:** the [guided demo](https://cutout-ethrome-2026.vercel.app/?view=demo) walks through a review in about three minutes. Browser encryption and decryption are real; qualification, funding and payment are explicitly simulated, and the walkthrough does not upload to Swarm.

**Real testnet work:** the [live workspace](https://cutout-ethrome-2026.vercel.app) uses deployed Fuji contracts, public Arkiv discovery and public Swarm storage. A paid review needs two wallet roles, test funds, registered browser report keys and an issuer-approved credential. Storage requires no customer Swarm account. Follow the [end-to-end test](docs/deaddrop/TESTING.md).

**Run the frontend locally:**

```sh
git clone --branch main https://github.com/MihRazvan/eth-rome-2026.git
cd eth-rome-2026
npm ci
npm run dev
```

Open **http://127.0.0.1:18904/?view=demo**. Requires Node 24.12+. This starts the UI walkthrough; the live workspace requires a configured backend. The [quickstart](docs/deaddrop/QUICKSTART.md) covers the full local chain/storage rehearsal and verification. `npm run build` creates the standalone interface; `npm run build:hosting` prepares the verified public API deployment.

## Why these technologies

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Settlement | **Avalanche Fuji + Solidity + test USDC** | Hold rewards, enforce proof-bound assignment, commit delivery and settle payment |
| Discovery | **Arkiv Tiramisu** | Wallet-owned, queryable task listings with native expiry and WebSocket updates |
| Documents | **Swarm / Bee HTTP** | Public scopes and issuer snapshots; recipient-encrypted reports |
| Qualification | **gnark Groth16 on BN254, Go → WebAssembly** | Prove issuer approval and current nonrevocation locally; verify onchain |
| Report privacy | **WebCrypto + HPKE** | Encrypt locally and wrap document keys separately for each recipient |
| Product | **TypeScript + Vite; Vercel** | Deaddrop interface, browser proving worker, public reads and encrypted application relay |

<img width="1780" height="1094" alt="deaddrop-tech-stack" src="https://github.com/user-attachments/assets/863169c2-69c9-428b-bf2b-bf51675a0ed0" />

The [architecture](docs/deaddrop/ARCHITECTURE.md) maps each boundary to source. The [security model](docs/deaddrop/SECURITY.md) explains exactly what remains trusted or public.

## Bounty targets

| Sponsor | Entry | Where to inspect |
| --- | --- | --- |
| Avalanche / Team1 | Track B — asset rule, an eligibility or transfer policy, and settlement logic | [Integration and demo proof](docs/deaddrop/bounties/AVALANCHE.md) |
| Arkiv | Mission 02, Mission 03; Best Use consideration | [Queries, expiry, subscriptions and feedback](docs/deaddrop/bounties/ARKIV.md) |
| Swarm | Useful decentralized document storage | [Encryption, upload and retrieval](docs/deaddrop/bounties/SWARM.md) |

> Reviewer passes now persist privately in the browser. Files are optional backups or a one-time migration path. [Qualification and approval workflow](docs/deaddrop/QUALIFICATION.md).

## What is verified

**A complete public review has settled:** task #4 funded, accepted with a browser proof from a saved pass, delivered through encrypted Swarm storage, opened by the client and paid on Fuji. The reviewer received **0.1 test USDC**, reconciled against finalized receipts and token balances. Real two-browser Arkiv publication and native expiry were also exercised. [Receipts and browser evidence](docs/deaddrop/evidence/saved-pass/README.md).

These checks used operator-owned test wallets in actual Chromium profiles. Independent teammate extension-wallet review and the final presentation video remain separate. The [evidence index](docs/deaddrop/EVIDENCE.md) distinguishes public transactions, local tests and the simulated walkthrough.

## Deployments

Avalanche Fuji C-Chain, **43113**. Links open exact-runtime source verification records.

| Contract | Address |
| --- | --- |
| Qualification escrow | [0xb431e570d506168711cc1f9f91e325b3114c62af](https://repo.sourcify.dev/43113/0xb431e570d506168711cc1f9f91e325b3114c62af) |
| Groth16 verifier | [0x9c1293e7e499d56fdc52186e7624dcfa04dfcbd1](https://repo.sourcify.dev/43113/0x9c1293e7e499d56fdc52186e7624dcfa04dfcbd1) |
| Document-key registry | [0x181db4e48a0e76fdc50101085ac3b831464792c1](https://repo.sourcify.dev/43113/0x181db4e48a0e76fdc50101085ac3b831464792c1) |

Payment token: canonical Fuji test USDC, `0x5425890298aed601595a70AB815c96711a31Bc65`. [Public manifest, network details and hosting instructions](docs/deaddrop/DEPLOYMENT.md).

---

Deaddrop was built with <3 during ETHRome 2026.
