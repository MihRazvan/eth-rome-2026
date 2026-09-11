# Local idle-time payout regression

On 2026-09-11, final runtime inspection found the default Anvil instant-mining mode only changed the latest block timestamp after a transaction. Browser reads could therefore leave collection disabled while a user waited, although the accelerated local lifecycle test passed.

The launcher now starts Anvil with `--block-time 1 --mixed-mining`, preserving immediate transaction mining and producing ordinary timed blocks while idle. This affects only chain31337; it does not accelerate a Fuji or BENQI deployment.

A new browser scenario originates a real backed claim, opens its detail and waits. It issues no test-clock RPC, serving transaction, manual refresh or fake response during the wait. The visible `Collect 4,000.00 USDC` action becomes enabled. Independent block reads assert increasing block number and at least55 seconds of elapsed chain timestamp. Browser polling has ten-second cadence; the assertion permits75 seconds.

Actual final command: `npm run test:browser`, from stopped services, started and stopped the entire local stack. Five tests passed in1.2m; the idle-maturity case took1.0m. Existing public resale, private reload/isolation, responsive and key/cancellation tests also passed. `npm run typecheck` passed. The prior full CI remains linked at its exact earlier commit; new pushes trigger CI for this fix.
