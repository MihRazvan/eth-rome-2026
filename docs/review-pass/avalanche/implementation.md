# Avalanche implementation proposal

Implement canonical Fuji test-USDC escrow before optional issuance. This is a proposal derived from [research.md](./research.md), not public deployment evidence.

1. Add a chain-aware settlement helper. Await receipt success; on Fuji wait until finalized block number covers the receipt; ensure receipt block's canonical hash matches; return a settled block number/hash for subsequent state reads. Bound polling, support cancellation and classify pending/reverted/replaced transactions. On local Anvil use an explicit local policy, never label it Fuji settlement.
2. Add a public deployment entrypoint owned by the integrator. It must validate chain43113, canonicalUSDC code/decimals, issuer-public key association and snapshot, verifier setup provenance, authorized signer balance/identity and intended arbitrator. It must not fall back to Anvil credentials, a test token mint or a fixture manifest. Dry run should perform read-only checks/simulation and emit unsigned deployment intent.
3. Store sourceSHA, compiler settings, verifier/proving-key hashes, contract addresses, deployment receipts and verified token metadata in an allowlisted public manifest. Keep signer and issuer secrets outside Git and API responses.
4. Replace qUSD faucet controls in public mode with canonical test-USDC balance and faucet guidance; show exact approval requirement and client budget. Keep the local qUSD environment explicit. Let users understand reward/deadline/qualification before wallet connection.
5. Run a pinned Fuji fork against the configured USDC for ERC20 behavior, then run actual public funding/proof/delivery/payout after funded access exists. Archive settled receipts and state differences. A faucet attempt or zero-amount transfer is not a substitute for the lifecycle.

## Required invariants

- Each client funds exactly its own job amount; pooled escrow balance covers all live liabilities.
- Every terminal outcome pays/refunds at most once, and paid plus refunded principal equals that job's original principal.
- If token calls revert or return false, job status and liabilities remain unchanged.
- Admission validates current issuer key/root, qualification, expiry, job context and recipient; copied proofs cannot redirect payout.
- Revocation cannot retroactively cancel earned payment; storage/indexing cannot authorize money movement.
- Public-mode deployment refuses chain/address/config substitution and cannot mint qUSD as a hidden fallback.
- Settled UI/evidence never derives from a transaction hash, accepted block or optimistic state alone.

## Optional issuance design only if a concrete product need emerges

A nonupgradeable, immutable-underlying 1:1 test-USDC wrapper could expose deposit/mint and burn/redeem, with six decimals and ordinary transfers. No treasury mint, reserve sweep, yield strategy or arbitrary execution. Deposit must receive the exact amount before minting; withdrawal burns caller tokens before exact outgoing transfer. Direct donations are excess backing, not yield or mint authority. Use reentrancy protection and reject zero amounts, self/zero recipients and unsupported underlying token behavior. Do not expose an unrestricted recovery-mint path.

Invariant: underlying.balanceOf(wrapper) >= totalSupply, with equality except donations. Deposit increases both by the same base-unit amount; redemption reduces both by the same amount; transfer changes neither. A blocked underlying transfer atomically rolls back mint/burn. Test unauthorized mint attempts, taxed/rebasing assets, callbacks, failed transfers, donation behavior and full redemption. State clearly that reserves are test USDC with no fiat value. This design gives a coherent issuance demonstration but adds no credential privacy; it is currently deferred.
