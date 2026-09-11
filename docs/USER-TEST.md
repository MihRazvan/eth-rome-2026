# EXIT end-to-end user test

Use this guide to test comprehension and recovery alongside the automated ownership/balance checks. The local product makes real transactions on an isolated chain with valueless test assets. The hosted `?preview=1` page is a visual fixture and cannot satisfy the transaction tasks. Public Fuji and sponsor steps require the resources in [deployment instructions](DEPLOYMENT.md).

## Preparation

Run `npm run preflight` to check live-resource readiness without publishing or exposing secrets. A blocked result identifies missing configuration; an unverified result still requires actual writes. Preserve the report with the environment and code commit. Keep private keys and authenticated endpoint URLs out of recordings, chat and screenshots.

For local testing, use `npm run start:local` and open `http://127.0.0.1:5173`. A fresh start resets this isolated demo, so coordinate before restarting an active session. Use separate browser profiles for seller, competing maker and outsider. Connect a wallet or choose the disclosed local role; no real wallet secret is needed for the isolated demo. Record browser/device and whether storage was retained between visits.

Observe first. Avoid explaining where a control is until the tester has tried it. Record task completion, wrong turns, uncertainty and the participant's own explanation; do not infer comprehension from a successful click.

## Tasks

1. **Understand the exchange.** Show Markets without a connected wallet. Ask the tester to explain what EXIT does, what a buyer receives and what remains uncertain. Then ask them to find a withdrawal they could sell. Record whether they distinguish expected proceeds from the payment offered now.
2. **Originate and compare.** In the seller profile, get test funds and create a backed test claim. Request competing offers. Ask the tester to choose one and explain seller net, fee, buyer cost and acquired rights. Let them inspect “Sell now vs. wait”; check whether they mistake the comparison for a guaranteed yield.
3. **Negotiate privately.** Enable Private Offers and request offers to register the seller's recipient key. In a separate maker profile, enter an independently chosen private price and inspect the capital authorization. Return to the seller, refresh, compare and reload. The seller should retain decryption access on that device. A competing maker and an unconnected profile should see encrypted competing terms. Ask each participant what remains public; settlement terms, addresses and funding limits are public.
4. **Sell and reconcile.** Accept the selected exact offer. Record the transaction hash, seller token balance change and new onchain owner. Switch to the buyer and explain cost and remaining exposure from Portfolio. Check that the former seller cannot collect the sold claim. Do not count a toast as settlement evidence.
5. **Collect and resell.** After the test source's first release, collect and withdraw 4,000. Check that an offer pricing removed cash fails and fresh offers price the remaining rights. Resell the residual; the next buyer collects the final installment. Compare actual cash flows with acquisition costs. Separately use the payout scenario to explain the 5,985 purchase / 5,700 proceeds loss without changing signed terms.
6. **Recover context.** Reload a selected claim/private mode, navigate Back/Forward and switch wallets while a review is open. Check route continuity and confidential-state clearing. In a controlled local run, make offer discovery unavailable while leaving the chain reachable: claims and collection should remain accessible with an explicit discovery error. Restore service before continuing.

## Evidence and follow-up

Capture outcomes per task: completed unaided, completed after help, failed, or blocked; plus the concrete observation and relevant transaction/record identifier. Track financial correctness separately from ease of use. Never record private offer values in a public research artifact before deliberate disclosure.

For the sponsor run, add real Arkiv publication and the identical query before/after native expiry, plus Swarm upload and independent byte retrieval/authentication. Use actual Fuji ownership and payment reads. Local storage, gateway health and a visual preview cannot replace those checks.

After the session, prioritize issues that cause a mistaken trade, conceal an unavailable service, expose confidential terms or block collection. Keep cosmetic suggestions separate. Record a minimal reproduction and add a targeted regression only where it protects a meaningful boundary.
