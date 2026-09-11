# Restart handoff — EXIT

Updated 2026-09-11. Workspace `/Users/razvan/Repos/real-eth-rome`, origin `MihRazvan/eth-rome-2026`, branch `main`. Nearby `/Users/razvan/Repos/eth-rome-2026` belongs to a different active project; leave it untouched. Preserve handoff files and actual Git provenance.

## Delivered

Settlement/test-source/key-registry contracts; independent review; P-256 HPKE private offers; Arkiv/Swarm adapters; receipt-style market, sale review, portfolio and residual claim detail; actual browser wallet/chain adapter; funded local maker runner; fresh-start scripts; pinned BENQI account fork prototype; CI and deployment instructions. Enabled market collateral is the disclosed backed test source. BENQI remains an admission prototype.

## Verified locally

`npm run check`: TypeScript, 15 JS tests, 39 reported Solidity tests (16 are inherited repetitions), production build. Two invariant campaigns each 128×64 actions. `npm run test:source`: three pinned fork tests at Avalanche block 95031281, with explicit simulated future operator reward publication. `npm run test:browser`: four Chromium tests pass, including public residual lifecycle, custom private price 9987.123456 with reload/outsider/public settlement checks, loaded 390/1024/1440 market, registry rotation/revocation and maker cancellation. Local scenario records normal maker outcomes +25/+15 and adverse +25/−285. See acceptance ledger and evidence directory for scope.

## Runtime and release

`npm ci && npm run start:local` starts isolated Anvil 8547, API 8787, frontend 5173. Public Anvil identities are available only for this local chain. Generated local state is reset at fresh start; do not apply this process to a live chain. PID manifest `.runtime/pids.json`, logs `.runtime/*.log`. Root services are running during final release checks. A final follow-up records clean restart, pushed commit, CI and hosted-preview status.

Vercel project `exit-ethrome-2026` is being published as a static, explicitly labelled `?preview=1` visual preview. It has no hosted trading backend. Default app fails visibly without `/api/config`; no fixture fallback.

## Concrete outstanding requirements

Fuji deployment/public lifecycle requires four distinct funded testnet accounts (deployer and three makers). Arkiv publication/native expiry needs a funded Tiramisu signer. Swarm live upload and independent retrieval need funded postage/upload access. No suitable secrets/funding were supplied. Official faucets require human account/wallet/CAPTCHA/eligibility or event access; these were inspected, not bypassed. Arkiv actual SDK read returned zero entities and gateway health returned HTTP200; neither proves a write. See `docs/evidence/access-blockers.md` and `.env.example`.

Once provided, follow `docs/DEPLOYMENT.md`, deploy with `npm run deploy:fuji` in the configured environment, run sponsor write/expiry probe and independent verifier, deploy the persistent runtime, then repeat browser lifecycle on Fuji without time manipulation. Update evidence only with actual hashes/records/check results. Bounty drafts/storyboard are in `docs/SUBMISSION.md`; human submissions, conversations, attendance and camera recording are still outstanding.

Native workers completed bounded protocol, transport, design and independent reviews. Their preserved commits were integrated by cherry-pick, and `.worktrees/` is ignored. No need to restart their completed work.
