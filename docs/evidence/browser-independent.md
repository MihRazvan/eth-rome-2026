# Independent browser evaluation — September 11, 2026

Reviewer implemented the transport package, did not implement the frontend. Evaluation used a separate Chromium context through installed Playwright 1.63.0 CLI, the Playwright skill, and visible application controls at `http://127.0.0.1:5173`. No browser routes were mocked. No private/live wallet credentials were used. The local role selector explicitly exposed isolated test wallets.

Observed approximately 16:56–17:05 UTC. The integrated worktree was changing during review; Vite reloaded it several times. Deployment manifest reported commit `d30e145da06d0ea3021cc7de034a4594a491cdaf`; repository head at screenshot capture was `d01b34c3655637afa45bc095e4bb898afe3ecf61` with uncommitted integration changes. This is evidence for the exercised running app, not a claim that every later head has passed.

## Executed workflow

1. Opened a new browser context without connection. During initial server startup a temporary no-deployment screen appeared. Once the runtime was ready, reloading showed actual claims with the wallet disconnected. Markets and claim detail remained browsable without signing.
2. Clicked Connect wallet, Portfolio, Get funds, Create. Created a new backed **claim #3** as Seller. Other concurrent tests used different claims. Seller test USDC balance changed from 80,000 to 170,000 after faucet funding and a 10,000 deposit. No more claims were originated by this reviewer.
3. Opened claim #3's Sell remaining rights view and requested public offers. Three team-operated makers offered 9,960 / 9,940 / 9,900. The trade ticket separated gross debit, fee, net payment, gas and the exact remaining rights.
4. Switched to Private Offers, set up a separate device key through the UI, and requested encrypted quotes. Seller read three decrypted offers: 9,939.24 / 9,933.01 / 9,906.35. These are local demonstration offers deliberately disclosed here for verification; they are not claimed as sponsor-network uploads.
5. Switched the visible local role selector to Maker B. The three records became disabled ciphertext-only cards with no prices. A disconnected outsider view also showed three encrypted cards; a DOM check found zero occurrences of the previous highest private price. Reconnected Seller after reload and the existing device key successfully decrypted the earlier records. Maker C's changed allowance/balance made its offer appear unfunded and disabled; the other offers remained usable.
6. Chose Public offers and selected **Maker B's 9,940 offer**. Opened the review dialog, read the exact net payment and acquired rights, checked the explicit sale acknowledgement, then pressed Sell for 9,940.00 USDC. The pending status warned against resubmission; confirmation followed. The old seller then had no sale authority for claim #3.
7. Switched to Maker B and opened Portfolio. Acquisition cost 9,940 and claimable 10,000 appeared. Clicked Collect proceeds, then Withdraw cash. Portfolio showed 10,000 withdrawn and realized result **60**. The ownership record and claim dossier remained after standard payout, with later recovery-rights text.
8. Inspected Markets, Portfolio and Claim detail at desktop 1440, laptop 1024 and mobile 390 widths. Screenshots were actually opened and visually reviewed. Document scroll width equaled viewport width for tested mobile/desktop surfaces; Markets' wide table scrolls inside its region. Values, owner address and action controls fit the narrow claim view.
9. Keyboard: first Tab reached Local demo wallet; second reached Skip to content; Enter moved to `#main`; the next Tab reached Find an exit, skipping header navigation.

This session used naturally elapsed local source time. The reviewer did not change chain time or mine artificial time jumps. By collection both installments were available, so this browser session proves final collection, not the partial-collection/resale scenario. That scenario requires separate acceptance evidence.

## Independent chain reconciliation

Read directly from local RPC `http://127.0.0.1:8547` with viem in a separate Node process, using contract views and decoded events rather than UI state. Chain 31337; market `0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0`; payment token `0x5fbdb2315678afecb367f032d93f642f64180aa3`. Values below are test USDC, six decimals.

| Read | Before sale, block 28 | After sale, block 29 | After collection/withdrawal, block 31 |
|---|---:|---:|---:|
| Seller balance | 170,000 | 179,940 | unchanged by buyer collection |
| Maker B balance | 100,000 | 90,060 | 100,060 shown by wallet/portfolio |
| Claim #3 owner | Seller `0xf39F…2266` | Maker B `0x3C44…93BC` | Maker B retained |
| Ownership epoch | 0 | 1 | 1 |
| Purchase price | 0 | 9,940 | 9,940 |
| Recognized cash | 0 | 0 | 0 after withdrawal |
| Withdrawn / depletion | 0 / 0 | 0 / 0 | 10,000 / 10,000 |

- Sale, block 29: `0x3c92c60c07b62c01bde987e3d23bfc714d9f3cb1b2f484e52d29e92c2a0e9052`. Decoded Accepted event bound claim 3, Seller, Maker B, net 9,940, fee zero, epoch 1. Balance deltas independently confirm exact payment.
- Collection, block 30: `0x31204e8c14e24808ac77d23055be8619c794b020cbf072993fe13ef06ddcb71d`. Collected event amount 10,000.
- Withdrawal, block 31: `0xd1b631ab86c1fe50d850b95d1346d6cfa224b203a4bd209f7a1bdb551fe34c8d`. Withdrawn event bound current Maker B owner, amount 10,000 and depletion 10,000. Direct positions view confirmed owner persistence, zero cash and cumulative withdrawn 10,000.

These hashes are local Anvil evidence. They are not Fuji explorer transactions.

## Visual/task critique and findings sent to integrator

The sale ticket makes the immediate payment and traded rights legible. The perforated claim card, consumed-value bar and ownership trail form a coherent EXIT identity. The portfolio equation connects acquisition cost and collected value; the claim dossier provides the deeper accounting without replacing the trading screen. It operates as a market, not just a landing page. Mobile controls remain usable, although the long Markets table requires horizontal scrolling within its region.

Reported findings at capture time:

- **Financial wording:** after collecting 10,000 against cost 9,940, the label “Unrecovered cost” displays **-60.00**. The math is correct but the label is confusing; clamp unrecovered cost to zero and show realized surplus separately, or clearly name a signed net-cost measure. The realized-result field already correctly shows +60.
- **Inconsistent completion state:** claim #3 shows “exhausted” in Portfolio but “Pending” in Markets after all standard payout was withdrawn. Use consistent “Standard payout collected”/“Recovery rights” wording while preserving later recovery ownership. This is a material status-label defect, not observed loss of rights.
- **Private identity wording:** encrypted team-operated quotes display “Independent maker” to outsiders. Identity is encrypted and independent participation cannot be inferred. Integrator accepted changing this to an identity-encrypted label.
- **Mobile status accessibility:** the footer hides Connected/Unavailable words at 390px and leaves colored dots beside sponsor names. Keep a textual status so unverified sponsor paths remain clear without hover/color interpretation.

No critical funds-loss or private-plaintext exposure was observed during these actions. These findings were reported before writing this artifact; fixes require follow-up verification against the final integrated head.

## Console and network

Initial navigation produced one `favicon.ico` 404. Later reloads had zero console errors/warnings (React's development-tools notice only). The full session request log contained 2,321 non-static requests at sampling: 2,314 HTTP 200, four `ERR_CONNECTION_REFUSED` requests during a concurrent dev-server restart, and three pending/no-final-status entries. The failed requests were an offers query and record fetches; reloading recovered. The session is therefore not represented as a zero-network-error run. High request volume warrants monitoring before a public RPC deployment.

All observed chain/index/storage URLs were local and labeled as such in runtime configuration. Footer tooltips explicitly said Arkiv publication and Swarm upload unverified. This evaluation does not prove Fuji deployment, Arkiv native expiry or Swarm public upload/retrieval. It also does not establish mobile touch-device performance or complete WCAG conformance.

## Screenshots

- [Public offer comparison, desktop](browser-independent/public-offers-desktop.png)
- [Private seller prices](browser-independent/private-seller-desktop.png), [competing Maker B ciphertext view](browser-independent/private-maker-desktop.png), [disconnected outsider ciphertext view](browser-independent/private-outsider-desktop.png)
- [Portfolio desktop](browser-independent/portfolio-desktop.png), [1024px laptop](browser-independent/portfolio-laptop.png), [390px mobile](browser-independent/portfolio-mobile.png)
- [Claim detail mobile](browser-independent/claim-mobile.png)
- [Markets desktop](browser-independent/markets-desktop.png), [1024px laptop](browser-independent/markets-laptop.png), [390px mobile](browser-independent/markets-mobile.png)
