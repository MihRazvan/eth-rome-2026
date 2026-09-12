# Review Pass — Arkiv integration feedback

Observed12September2026; SDK0.8.1, viem2.56.3, Tiramisu7738577. [Research and reproducible read-only probe](docs/review-pass/arkiv/research.md). No public funded entity was created during these checks. Findings below come from actual source/RPC/browser observations unless explicitly described as deterministic adapter tests.

| Observation | Reproduction / impact | Suggested improvement |
|---|---|---|
| Supplied bounty and current hub/form/MCP disagree | Attachment names USD/USDC, older gates and different scoring. Current hub says EUR; official current guide supersedes older conversation gates. See `docs/review-pass/arkiv/{ethrome-current,mcp-evidence,submission-fields}.json`. | One versioned canonical brief linked from every page; explicit change log and effective time. |
| Telegram says optional but form input is required | Public Tally form metadata inspected without submission. | Align the label and validation flag. |
| Older SDK guidance conflicts with current package | Attachment recommends0.7.x; npm latest is0.8.1, publishedSeptember11. | Version examples and network compatibility together; refresh official agent skill instructions. |
| Attribute names must be lowercase on the live path | Adapter now uses explicit lowercase keys; payload JSON may remain camelCase. | Validate at the SDK boundary and document exact accepted character rules near examples. |
| Natural expiry emits no event | Confirmed in live-events docs and installed callback surface. A deletion callback is not an expiry callback. | Provide a tested WSS-head/expiry-reconciliation recipe that explains the extra query and disconnect ambiguity. |
| A historical start block changes watcher behavior | Installed SDK uses polling when `fromBlock` is supplied; HTTP also polls. | Make transport/strategy visible and warn when a supposed live stream becomes polling. |
| SDK public action types omit block watcher | Root imports `watchBlockNumber` from `viem/actions` over real WSS with `poll:false`. | Expose the supported action consistently or document the extension. |
| Lease duration is quantized | Actual constructor probe rejected5seconds, accepted6/30/60seconds as3/15/30blocks. | Show nominal timing and actual receipt expiresAt; do not imply exact wall-clock expiry. |
| Reconnect is current-state reconciliation | Actual forced-close probe restored subscriptions; events during the gap are not guaranteed replay. | Document gap handling separately from reconnection, with bounded snapshot examples. |

Implementation references: [listings adapter](experiments/qualification/pilot/listings.ts), [deterministic tests](experiments/qualification/pilot/listings.test.ts), [integration contract](experiments/qualification/pilot/LISTINGS.md), [independent browser review](docs/review-pass/arkiv/ui-review.md). Tests cover typed compound filters, complete pagination, forged duplicates, renewal, native expiry versus delete, race/reconnect handling and bounded event hydration. These are not substitutes for funded public mission evidence.

The useful product behavior is a short-lived recruiting board without a cleanup worker. The exact same query stops returning expired opportunities, while a client's escrow and accepted work survive independently. A public scope is deliberately nonsensitive. Credentials, holder identifiers, report plaintext and private keys are absent from the indexed schema.

## First100users hypothesis

Start with one willing reviewer collective and two client teams for five bounded paid second reviews. Measure setup completion, time to qualified acceptance, report retrieval success, payment completion and whether clients actually value private credential verification. No organization has agreed yet; no outreach has been sent. If that pilot succeeds, onboard additional collectives through their existing client relationships, aiming for roughly20reviewers and80client participants rather than buying anonymous wallet activity. This is a distribution experiment, not a claimed user count.

Agent/tool disclosure: native Codex workers researched sponsor-specific sources in isolated worktrees; the root integrated their attributed commits. Official Arkiv skills and installed SDK sources were inspected. SDK/WSS probes, Chromium, deterministic adapter tests and independent integration review were used. No MCP tool submitted the form, no sponsor conversation was fabricated, and no indexer decommission was invented for Mission01.
