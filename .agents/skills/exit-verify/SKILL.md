---
name: exit-verify
description: Verify EXIT changes, prepare its end-to-end user test, or assess a release. Use for EXIT readiness and acceptance evidence; skip unrelated projects and ordinary research-only requests.
---

# Verify EXIT

Work from the actual checkout and its current commit. Read `AGENTS.md`, `docs/CONTINUATION.md` and the relevant rows of `docs/ACCEPTANCE.md`; use `docs/handoff/PRODUCT.md` for financial/privacy requirements. Existing user authorization controls actions. Preserve unrelated work and secrets.

## Readiness

Run `npm run preflight` for read-only environment and public network checks. Exit1 means a concrete blocker; exit2 means configuration/read probes passed but live writes remain unverified. Neither means a public lifecycle succeeded. Report missing resources by variable name or public address, never by secret values, authenticated URLs or raw provider errors.

Use `docs/DEPLOYMENT.md` only when deployment or sponsor writes are in scope and authorized. `probe:sponsors` can publish when configured; it is not a universally read-only command. A reachable gateway and an index query are not proof of uploaded offers or native expiry.

## Verify the changed boundary

Use the narrowest meaningful check first. Run required integrated gates before release:

- `npm run check` for type safety, unit/security tests, Solidity tests and production build.
- `npm run test:browser` for actual local trading, privacy and navigation. Inspect screenshots and independent chain assertions. Confirm ownership of the isolated local services before starting/stopping them; do not reset a user's active demo or public deployment. Writers and browser workers need explicit base commits, owned paths, ports and data directories.
- `npm run test:source` when the admitted-source prototype or its evidence changes. Record the source pin and operator/time simulations separately from public transactions.

Preserve the distinction between selected terms, a recent simulation and final onchain settlement. For private-offer changes, inspect losing-bid approval calldata/events as well as ciphertext, logs and indexing metadata. Confirm wallet/chain/disconnect events and out-of-order refreshes cannot retain another session's plaintext, frozen sale review or bid input. Test discovery failure independently of collection rights. Never treat a green ciphertext test as a complete confidentiality review.

Private funding authorization must be explicitly disclosed and independent of the bid amount. Historical keys and public settlement remain outside any promise of erasure. Check request/key binding, cancellation and execution-time validity separately.

## Evidence and handoff

For a material result, preserve the command, exact commit, environment, actual result and relevant artifact/transaction/record identifier. Supersede misleading old conclusions explicitly while preserving their history. Keep blocked, failed, skipped and passed distinct.

If code changed after a passing check, run the affected checks on the integrated head. Inspect the actual remote commit and CI status after an authorized normal push. Update the acceptance ledger and continuation handoff with working services, outstanding resources and next executable step. Do not add repetitive tests or repeated full-suite runs without a new change, failure or unresolved concern.
