# Technical follow-up before teammate manual review

12 September 2026. The teammate owns the independent human review. Engineering is checking/fixing network recovery and publication feedback before handing over the real payment test.

- `preflight.json`: actual read-only Fuji/Arkiv balances and current snapshot HTTP200. Finalized `nextJob` was 0: no funded public review is claimed.
- `discovery-before.json`: actual production browser received 10 heads and 18 entity notifications and showed a live board. Separate fresh sessions intermittently remained stale after initial connection failure. A healthy sample does not erase that failure.
- Listing changes recover from transient hydration/query failures on subsequent real heads. Publication outcomes/receipts remain visible to the client after network switches. Manual Refresh recreates exhausted subscriptions.
- Existing isolated client/reviewer Swarm upload sessions were not ready. Public scope/report uploads, funded settlement and native listing expiry remain blocked on usable authentication; no recovery phrase, postage signer, browser session or private key was extracted.

The [short manual checklist](../../../../deaddrop/TESTING.md) separates immediately usable walkthrough review from the real funded test. Automated synthetic/fault-injected tests must remain identified as such alongside public traffic evidence.

Recovery evidence: `initial-socket-recovery.json` deliberately throws on the first browser WebSocket construction, then uses genuine public Arkiv subscriptions; `established-socket-recovery.json` deliberately closes an established socket after five seconds, then confirms a new real connection and fresh-query recovery. These are isolated transport/board probes with a verification stub, not funded settlement validation or evidence of a missed Cutout task being recovered. No sponsor writes occurred. An earlier harness failed because the Vite library bundle lacked a NODE_ENV definition; that harness error was corrected before collecting these results.

16 listing tests and 26 journey/settlement/storage tests passed; one optional external SDK browser test skipped. Targeted TypeScript passes. SDK node observation received 55 heads and 100 events over 110 seconds without errors. Public production observation is recorded separately after deployment; other applications’ entity notifications are not Cutout publication evidence.

Final production verification: `discovery-after.json` confirms both subscription acknowledgements, seven distinct public heads and no page errors. `hosted-browser.json` records four desktop/mobile and walkthrough checks with no errors or writes. The deployment is recorded in `deployment.json`; these checks do not establish a funded public lifecycle.
