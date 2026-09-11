# Restart handoff — EXIT

Updated 2026-09-11. Workspace `/Users/razvan/Repos/real-eth-rome`, origin `MihRazvan/eth-rome-2026`, branch `main`. Nearby `/Users/razvan/Repos/eth-rome-2026` is a different active project; leave it untouched. Preserve handoff files and actual Git provenance.

## Delivered and current focus

The user is gathering resources for the live end-to-end test. Independent work continued through a full research pass, reproduced privacy/reliability fixes, product improvements and release verification. Read [research synthesis](research/README.md) for four cited reports, pinned repositories/skills, comparable-product screens, source limitations and decisions. Use [the human test guide](USER-TEST.md) when the participant is ready.

Working product: settlement/test-source/key-registry contracts; independent contract review; P-256 HPKE private offers; Arkiv/Swarm adapters; receipt-style market/trade/portfolio/detail; actual wallet/chain adapter; funded local makers; startup/deployment scripts; pinned BENQI account fork prototype. Enabled collateral remains the disclosed backed test source. BENQI is an admission prototype, not an enabled market.

Research uncovered two defects in baseline `b36fbf1`: a private bid's exact amount appeared in public token approval, and an old seller refresh could overwrite a newer wallet session with plaintext. Both were corrected and independently reprobed. Historical ciphertext checks now have scope corrections. New funding uses a disclosed fixed 100,000 test-USDC limit independent of the bid, with allowance reuse. Refreshes bind to wallet/session and onchain request context. Discovery failure preserves claim/collection, public certificates retry publication, and incomplete HTTP bodies cannot occupy the signer mutation queue.

Navigation preserves claim/page/private mode across reload/history; named dialogs restore focus; identity changes clear confidential reviews/inputs/notices. Seller comparison shows discount/premium against uncertain remaining proceeds. A collapsed local buyer scenario calculates gain/loss/break-even without changing signed terms or making network requests. A repository-local `$exit-verify` skill routes future agents to these boundaries; global agent settings were not changed.

## Verified implementation

Implementation commit **`c8ce819b3b867e25b6916f22a3d98d451049ad09`** is committed and pushed. `npm run check` passed TypeScript, **55 JS tests**, **39 reported Solidity tests** (16 inherited repetitions), and production build. Two invariant campaigns each run 128×64 actions with zero reverts. The existing optional Node-crypto externalization and large-bundle warnings remain; actual browser crypto passes.

Fresh `npm run test:browser`: **10 passed in 1.5m**, including a natural idle release, discovery outage with collectible rights, exact public/residual economics, custom private price and fixed approval calldata/events, seller reload/outsider/public settlement, rotation/revocation rejection and independent public cancellation, route/history, invalid claims, focus, mobile and wallet-switch cleanup. See [integrated evidence](evidence/research-integration.json) and `docs/evidence/browser-research/`.

Independent review confirmed corrected controller boundaries against `42bd712` using actual HPKE/signatures with controlled network scheduling. Economics has 16 arithmetic tests and separate explicit-preview keyboard/mobile evidence. The source package did not change in this research pass; its prior three pinned fork checks at Avalanche block 95031281 remain documented, including simulated future operator publication. No new fork execution is claimed.

The remote CI run for the implementation is [34642629503](https://github.com/MihRazvan/eth-rome-2026/actions/runs/34642629503). It **passed**, including clean install, type/tests/build, ABI consistency and all 10 Chromium scenarios; actual job metadata is in `docs/evidence/ci-research.json`. The subsequent evidence-only commit does not change the verified implementation. Pinned-source CI is dispatch-only and is not implied by a push pass.

## Running services and hosting

After the fresh browser suite, the integrator started `npm run start:local` again and left a newly seeded two-claim stack at **http://127.0.0.1:5173**. Owned child processes are listed in `.runtime/pids.json`; Anvil8547, API8787, Vite5173. Logs are `.runtime/*.log`; launcher output `.runtime/research/ready-stack.log`. Startup resets only isolated local demo state and refuses occupied ports. Coordinate before restarting an active user test.

The updated static visual preview is **https://exit-ethrome-2026.vercel.app/?preview=1**, Vercel deployment `dpl_8HFxZ58fsMvq1nHrMwmQ1K6RFbvD`, source implementation `c8ce819`. Actual hosted Chromium inspection returned HTTP200, displayed the preview label and new economics comparison, and had zero page errors. Default route showed an explicit unavailable error with zero claim rows; no fixture fallback. It has no hosted trading backend. Metadata and screenshots are in `docs/evidence/hosting.json` and `browser-research/`.

## Required live resources and next action

`npm run preflight` now loads project `.env` if present and performs only secret-safe read checks. Its actual 19:52 UTC run was **blocked**: Fuji43113 and Tiramisu7738577 responded, Arkiv query succeeded and Swarm retrieval health responded, but funded deployer/three distinct maker keys, Arkiv signer, Fuji manifest, Swarm upload endpoint and postage were missing. See [redacted report](evidence/preflight-integrated.json). A positive gas balance is not proof of adequate deployment budget; this command cannot certify writes.

Once resources arrive, follow `docs/DEPLOYMENT.md`: deploy the funded Fuji test source/market, exercise the public and private lifecycle, publish/query/observe native Arkiv expiry, upload and independently retrieve Swarm records, and host the persistent runtime. Record actual hashes and identifiers. No CAPTCHA/account eligibility was bypassed; no public lifecycle or sponsor write is claimed. Human bounty submissions, required conversation, attendance and camera recording remain separate outstanding steps in `docs/SUBMISSION.md`.

Research workers `design`, `review` and `transport` completed bounded assignments in ignored worktrees from explicit bases. Their commits were integrated by cherry-pick; no active worker needs continuation. Pending-transaction recovery after closing a tab, larger datasets, device eviction and a production CSP are documented future experiments, not passed checks. Continue the live integration when access is available; do not restart completed research or redesign the coherent receipt application.
