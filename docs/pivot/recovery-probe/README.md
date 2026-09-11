# REPRISE payment recovery feasibility probe

This isolated research probe demonstrates that a replacement worker can recover a **single contract-enforced payment obligation** after the first worker pays and loses its acknowledgement. It is not a production implementation, a general exactly-once protocol, an independent security audit, or a live sponsor integration.

Run from the repository root:

```sh
forge test --root docs/pivot/recovery-probe -vv
python3 docs/pivot/recovery-probe/capture.py
```

The directory has its own Foundry configuration and no external Solidity dependencies. It starts no Anvil, makes no RPC calls, and changes no shared chain state. `vm.warp` advances the isolated test EVM's timestamp to the lease deadline. The deliberate omission of a receipt after worker A's payment models a process crash; no actual operating-system process is killed.

The owner enrolls workers A and B, then approves and funds immutable step 1. The owner is the sole authority that can introduce a new obligation. Its effect hash binds a domain separator, chain ID, contract address, job ID, step ID, recipient, token and amount. Workers choose an existing step, but cannot supply replacement payment terms or create a new identifier to repay it. The owner remains responsible for not approving the same business obligation under two distinct step IDs.

A acquires epoch 1 and pays. ERC-20 transfer and payment consumption happen in the same EVM transaction. No checkpoint or acknowledgement is written. At the deadline, B acquires epoch 2, attempts the same effect and receives `AlreadyPaid`; the recipient's token balance is unchanged. B reads the paid effect and publishes a receipt commitment. Its commitment incorporates the original effect and payment provenance, the publishing worker/epoch and an opaque evidence hash. The contract authenticates publication by the current worker. It does **not** validate the meaning, availability or honesty of external evidence bytes.

An active lease cannot be taken over. At or after its deadline, it cannot authorize a payment or receipt even before another worker acquires it. Every protected operation checks the current worker, epoch and deadline; knowing the new epoch does not restore the old worker's authority. Cancellation prevents all unpaid effects and future approvals, returns accounted unspent escrow, and preserves recovery of receipts for already-paid effects. Receipt publication is one-time: a later worker cannot replace an existing commitment.

The executed suite covers:

- Payment followed by missing acknowledgement, takeover, duplicate rejection and receipt recovery.
- Old worker and old epoch rejection, including attempts against a different owner-approved step.
- Unknown steps, changed recipient/amount, immutable approvals and unauthorized worker enrollment use.
- Exact expiry boundary, early takeover rejection and unregistered worker rejection.
- Repeated payment and receipt replay, unpaid/empty receipt rejection.
- Owner cancellation, escrow refund and recovery of an already-paid obligation.
- Token transfer failure rolling back consumption before a successful retry.
- Effect domains, including rejection after a simulated chain-ID change.
- 256 fuzz cases, each attempting repayment across 1–20 worker takeovers.

`evidence.json` and `forge-output.txt` are produced by `capture.py`, which records tool version, UTC observation time, exit status, deterministic fuzz seed and actual process output. The final recorded run passed 10 tests, zero failures or skips. The first development invocation failed because Foundry reserves the `testFail*` prefix; that test was renamed before the passing runs. This was a test-discovery issue, not a waived contract assertion.

The token is a local exact-transfer test ERC-20, minted by the test harness. This proves real token state changes inside the isolated EVM, not movement of a public stablecoin. Fee-on-transfer, rebasing, callback-bearing or dishonest tokens are not admitted by this probe. Owner-authorized workers may withhold work or publish meaningless evidence; leases enable another attempt after timeout but do not guarantee service. Chain inclusion/finality, transaction replacement, secret distribution, browser recovery and operator availability are untested here. The owner cannot undo a paid effect, and arbitrary external APIs need their own idempotency or reconciliation mechanism.

Arkiv discovery/expiry, Swarm encrypted checkpoints and ENS delegation are **not implemented**. In this probe the payment contract itself enforces lease time and epoch. Replacing that check with an unchecked Arkiv query would change the security boundary. ENS Sepolia authority over Fuji execution would also require an explicit crosschain trust design. Restate, DBOS and conventional idempotency are acknowledged prior art; the potential product distinction remains recovery between independent operators, not a new exactly-once primitive.

The working name was changed from BATON to REPRISE after finding the adjacent [Agent Baton Protocol](https://github.com/ziyad-m97/agent-baton-protocol). Its name and general delegation/escrow category are prior art; no code or mechanism was copied into this probe.
