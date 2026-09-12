> **Cutout is the active product in this directory.** Start with the [current README](../../../README.md), [quickstart](../../../docs/cutout/QUICKSTART.md) and [architecture](../../../docs/cutout/ARCHITECTURE.md). The pilot notes below are historical; current public deployment and account-free storage supersede their access blockers.

# Review Pass product continuation

The current `review-pass/product` branch adds client-defined funded scope, Arkiv discovery, Swarm ID delivery and Fuji deployment preparation. Start with the [current product runbook](../../../docs/review-pass/RUNBOOK.md), [research](../../../docs/review-pass/README.md) and [acceptance](../../../docs/review-pass/BUILD.md). Its local port is18889;18888 below is the preserved earlier pilot.

---

# Review Pass — wallet-separated pilot

The local pilot works with one issuer, one reviewer and two independently controlled client wallets. Clients fund review assignments; the reviewer imports a locally generated qualification proof, accepts, and encrypts a review for that job's client and the reviewer. Each client retrieves and decrypts its own review before approving payment. Revocation prevents new qualification acceptance without cancelling payment for work already submitted.

This implements the next step after the [feasibility workbench](../README.md). It remains a **local test rehearsal**, not a recruited customer pilot or completed public bounty integration. The browser server has no transaction signer or credential/proving endpoint. Automated browser verification uses explicit public Anvil wallet bridges in separate Chromium profiles; it does not establish that real participants used wallet extensions on separate physical machines.

- [Run the pilot](RUNBOOK.md)
- [Acceptance and remaining boundaries](ACCEPTANCE.md)
- [Independent security review](SECURITY.md)
- [Device keys and recovery](KEYS.md), [durable issuer registry](../prover/ISSUER.md)
- [Public access gates](ACCESS.md), [one issuer/two clients validation worksheet](PILOT.md)
- [Actual browser evidence](evidence/browser.json), [desktop screen](evidence/reviewer-desktop.png), [mobile screen](evidence/reviewer-mobile.png)

## What changed

Every transaction is approved by the connected wallet. Wallet-owned onchain P-256 key bindings replace the original one-tab document key. Nonextractable private keys persist in each browser profile; encrypted documents contain independently wrapped keys for the client and reviewer. The assigned worker commits both the Swarm locator and exact envelope digest onchain, authenticating authorship independently of the storage gateway. Neither another client nor a third browser can decrypt that review.

The issuer now reserves credential indices durably before signing. Concurrent processes and process death cannot cause the tested allocator to reuse a slot. Revocation is permanent in this registry; reissue consumes a fresh index. Whole-disk rollback and a malicious issuer still require stronger external controls.

The current UI deliberately uses a fixed class-7 technical review, 250 freely minted test qUSD and a documented approval/dispute policy. It has no custom assessment policy editor, private source-code intake, or commercial task marketplace. Real pilot tasks and acceptance rubrics must be agreed before funding; the generic onchain terms digest does not capture a separately negotiated task. Arkiv discovery remains a separate adapter and public integration gate.

## Sponsor direction

Avalanche is intended to enforce proof-bound acceptance and payment on Fuji; Arkiv is intended to publish/query expiring generic assignment and issuer-snapshot records; Swarm holds whole public status snapshots and recipient-encrypted review bytes. These are substantive intended uses, but the latest configured access still lacks funded Fuji/Arkiv authority and public Swarm uploads. The new wallet pilot currently runs on Anvil and local Bee. See the [bounty research](../../../docs/pivot/sponsors.md) for source-backed rules; no award or eligibility outcome is promised.
