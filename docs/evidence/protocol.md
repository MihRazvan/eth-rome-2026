# Protocol acceptance evidence

Environment: local Foundry EVM, Solidity 0.8.30, OpenZeppelin Contracts 5.6.1, Forge 1.5.1. These are local tests, not live Fuji transactions, sponsor integration evidence, or an audit.

Run from repository root after `npm ci`:

```sh
forge test -vv
forge fmt --check
slither . --filter-paths 'node_modules|test' --exclude-dependencies
```

## Actual local results, 2026-09-11

`forge test -vv`: 18 tests passed, zero failed/skipped. The amount/price/adverse fuzz test executes 256 funded sales and collections. Each of two stateful invariants runs 128 campaigns × 64 calls = 8,192 calls, zero reverts. The handler's independent actor-balance and cash-flow ledger checks repeated resale, time advancement, servicing, withdrawals, cancellations and funded recovery. Its constructor executes successful sale, collection and withdrawal, and invariants assert nonzero counters to prevent a vacuous campaign.

| Requirement | Executed evidence |
|---|---|
| P1 exact exchange | Fuzzed amounts/prices; separate net/fee balance assertions; seller/fee recipient alias rejection; fee-on-transfer rollback; insufficient second fee leg rolls back net payment, ownership and nonce. |
| P2 removed seller authority | Old owner and outsider withdrawal rejection; direct source collection rejection. No receipt approval/transfer or arbitrary execution surface exists. |
| P3 residuals | Full-bundle stale quote fails after 4,000 withdrawal; collecting into recognized credit, elapsed time and unsolicited dust preserve quote validity; away-and-back ownership changes epoch. |
| P4 authentication/replay | Seller-only acceptance; maker and outsider cannot force a trade; buyer, price and chain tampering fail; cancelled/expired/replayed orders fail; ERC-1271 revoked then reauthorized signature is checked at execution. |
| P5 independent capital | Maker A's signature cannot spend maker B's funds; valid signature after maker spends its balance fails atomically. Stateful exact balances track three independent actors. |
| P6 callbacks | Hostile payment token attempts withdrawal as new buyer during settlement; global guard rejects callback and acquired claim cash remains intact. Inexact transfers revert all effects. |
| P7 continuing entitlement | After final 6,000 collection, ownership remains. Additional backed 100 recovery goes only to current owner; prior buyer cannot take it. Stateful recovery continues after ordinary maturity. |
| Private key authorization | Seller-controlled registry version increase, revocation and replay rejection; another seller cannot revoke this seller's key. Ciphertext/client boundaries are tested separately by transport workstream. |

Reference profitable lifecycle: seller paid 9,960; A withdraws 4,000 and receives 5,985 on resale; B withdraws 6,000. A's gross realized result +25, B's +15. Separate adverse source pays B 5,700 after the same 5,985 purchase, producing −285. Zero fees in these reference examples; gas excluded. Test balances independently asserted.

## Static analysis triage

Slither executed successfully through compilation and analysis (30 contracts, 101 detectors). Its findings exit status is nonzero by design. Initial scan returned eight findings; explicit initialization removed the uninitialized-local warning (Solidity already initializes locals to zero). Remaining findings: guarded collection balance snapshot/cross-function read visibility; state writes after immutable source calls in guarded collect/originate; and intentional deadline/installment/key-expiry timestamp comparisons. All market mutations share persistent-storage OpenZeppelin ReentrancyGuard and the source has its own guard. Read views may transiently observe pre-credit cash during a callback; no market mutation or supported integration acts on that transient read. Callback tests exercise settlement mutation rejection. Timestamps are coarse demo schedules and deadlines, not randomness. No warning is represented as an independent audit approval.

## Limits and next gates

Independent fresh-context review and integrated-head rerun belong to the integrator. Native withdrawal NFT acquisition is not implemented or claimed. The controlled vault is not a production protocol. BENQI fork admission belongs to the separate source workstream. Live Fuji deployment, balances and transaction links must be recorded separately after real execution. Storage discovery and privacy payload checks do not authorize settlement.
