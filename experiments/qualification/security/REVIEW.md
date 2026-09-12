# Independent bounded qualification security review

12 September 2026. Reviewer did not implement the qualification circuit, credential CLI, escrow or helper. This is targeted independent review and executable adversarial probing, **not an audit or production-security claim**.

Initial source base: `7cf122c`. Escrow bounds correction independently checked at `253038b80abe7468b2780bbae866be763f9408b8`. Crypto source is unchanged between those commits. Local helper was initially inspected read-only while uncommitted; its correction and final source were then inspected at `5b8b82c`.

## Findings

**Q-01 — funded class outside circuit range (corrected).** `QualificationEscrow.createJob` originally allowed classes below the BN254 field modulus while the circuit allows only unsigned 32-bit classes. Class `2^32` could therefore create a funded job that no real qualification proof can accept. Funds were recoverable only after the acceptance deadline. This is a bounds/API correctness defect, not a proof forgery or an attacker stealing another client's funds. The integrator restricted the class to `type(uint32).max` in `253038b`; the independently rerun regression confirms rejected funding leaves the client's balance intact.

**Q-02 — helper action lock acquired after awaited body (corrected).** In the inspected `runtime/start.mjs`, `/api/action` checked `busy`, awaited the complete request body, then set `busy = true` without rechecking. Two requests can pass the initial test before either sends its final body bytes. Both subsequently execute actions, sharing holder-state/proof/snapshot output files and signer state; one request's `finally` can also release the lock while the other continues. The isolated `concurrency-probe.mjs` reproduces two concurrent actions using this exact ordering, without touching the running helper, files, credentials or chain. Fix by rechecking/acquiring the lock after complete bounded parsing with no intervening await, or locking before body consumption with a bounded timeout and guaranteed release. The integrator added the post-body synchronous busy recheck and a five-second request-body timeout in `5b8b82c`. Independent rerun of the corrected ordering confirms `maximumConcurrentActions: 1`; the second pending request receives the busy response. The same-origin/loopback checks restrict the exposure; this is a local-demo reliability/authority-serialization defect, not a demonstrated remote credential theft.

No concrete credential-signature forgery, non-revocation bypass, copied-proof beneficiary redirection, payout replay or retroactive revocation clawback was found in this bounded pass. This conclusion does not imply the absence of undiscovered defects.

## Boundaries inspected

- **Issuer authenticity and secret knowledge:** the domain-separated signed hash includes holder commitment, the one 16-bit index, class and credential expiry. The circuit recomputes the commitment from a nonzero bounded secret. The same index bits select every status-tree branch. An unissued zero-status leaf alone cannot supply an issuer signature.
- **Curve/signature checks:** issuer and signature R are on-curve; issuer identity/order-two are excluded, and explicit constant multiplication checks prime-subgroup membership. The pinned gnark EdDSA gadget bounds `S < order`. Independent attempted order-two/order-four keys with zero-scalar/identity-R signatures fail. The native curve parameters have quadratic-residue A and nonresidue D; the checked affine operations use the intended complete Edwards parameter setting. This does not replace cryptographic-library review.
- **Domains and bounds:** distinct fixed MiMC domains distinguish holder, credential, status, node, nullifier and presentation inputs. All compared expiry/class/index/address values have explicit unsigned widths. The CLI rejects noncanonical field strings. Nullifier uses secret plus job context, independent of recipient/deadline; tag separately binds those presentation choices.
- **Freshness/context/beneficiary:** escrow compares the verifier statement to its immutable issuer key, current authorized root, immutable job class and chain/contract/job context. It checks current block time and proof deadline. Root freshness means equality to the issuer's currently published onchain root; it cannot compel timely publication. The proof fixes the worker beneficiary and neither caller nor relayer can redirect payout. Recipient binding does not prove one-human identity or prevent voluntary sharing of a credential secret.
- **Verifier adapter:** the generated verifier has `verifyProof(bytes,uint256[9])`, no return value, exact 256-byte proof-length validation and public-input field checks. Escrow uses its reverting success/failure convention. The verifier address is immutable. Deploying some other contract with that ABI is outside the reviewed generated-verifier configuration; deployment identity must remain explicit.
- **State/payments:** assignment and nullifier consumption occur atomically with verification. Only the worker submits and claims review-timeout payment; only the client approves/disputes/refunds; the designated arbitrator resolves disputes. Deadline inequalities leave no simultaneous timeout payout/dispute window. Submitted work cannot use the ordinary refund branch. Revocation changes admission only. A silent arbitrator can leave a dispute unresolved: this is the documented trusted-arbitrator policy, not a cryptographic guarantee of eventual payment. Token admission is the fixed ordinary test stablecoin, not general rebasing/fee-on-transfer compatibility.
- **Local privacy boundary:** issuance receives a commitment, not the holder secret; credential JSON omits the secret. Shared status snapshots contain no holder-specific path request. The local helper nevertheless holds test issuer and holder files on one machine, and controls all test transaction roles. It must not be represented as a hosted privacy-preserving prover or independent actors. Public payout address, issuer, root, class, timing and job remain observable.

## Executed verification

At the isolated review checkout:

```sh
cd experiments/qualification/prover
go test -count=1 -v ./...
# From repository root:
sh experiments/qualification/security/run-probes.sh
forge test --root experiments/qualification/contracts \
  --remappings @openzeppelin/contracts/=/Users/razvan/Repos/real-eth-rome/node_modules/@openzeppelin/contracts/ -vv
node experiments/qualification/security/concurrency-probe.mjs
node experiments/qualification/security/concurrency-probe.mjs --fixed
```

Actual results:

- Existing Go suite: three top-level tests PASS; 16 circuit witness cases, actual Groth16 proving/verification and mutation of all nine public inputs. Observed 26,089 constraints and 256-byte proof. This run measured about 111 ms proving and 1.35 ms verification; a single-host observation, not a browser benchmark.
- Independent Go overlay: 11 additional cases PASS, rejecting low-order/off-curve issuer keys, zero/249-bit secrets, negative index field alias, signed class/expiry overflow, zero recipient, off-curve R and signature scalar equal to subgroup order. Overlay source leaves the original prover files untouched.
- Escrow after Q-01 fix: 10 Foundry tests PASS, including 256 dispute-split fuzz inputs. These tests explicitly use the unit-test verifier double; they are state-machine evidence, not cryptographic Solidity integration evidence. The integrator's separately executed actual-proof/Anvil suite is not claimed as independently rerun here.
- Isolated original-lock reproduction: `maximumConcurrentActions: 2`; corrected ordering: `maximumConcurrentActions: 1`. No shared running helper or chain was modified.

The generated fixture issuer/holder seeds are explicitly public test data. Runtime-generated random issuer keys and holder secrets are still only local experiment credentials. The single-process random Groth16 setup has no ceremony or independently established toxic-waste disposal; no production setup claim is justified. Revocation/root publication, issuer assessment truth, issuance-index allocation, real sponsor storage writes and production operational trust were not validated by these tests.

Primary dependency checks: installed gnark v0.15.0 and gnark-crypto v0.20.1 source, including the EdDSA scalar bound and native twisted-Edwards operations; [upstream scalar-bound advisory](https://github.com/Consensys-Incorporated/gnark/security/advisories/GHSA-95v9-hv42-pwrj). The review used the actual pinned implementation rather than assuming an older advisory remains unpatched.
