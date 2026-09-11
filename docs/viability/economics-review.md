# Independent review of the viability calculator and claim inspector

Reviewed 11 September 2026, against root checkout `781ef85780605d9430d8572a3c092d6b7d172af1`; the same files remained unchanged at root `55d325408b1029c0352e164bd87b4bb1b08122e0`. Scope: `packages/viability/economics.ts` and `claims.ts`. These are read-only research tools, not settlement contracts, funded offers or a source-admission audit. The reviewer did not edit root code.

File SHA-256 at review:

- `economics.ts`: `636b2313344a55b47b27b6f490e394c376dbc7b634952a2bbd3eec4ce6d4991e`
- `claims.ts`: `6f3df91b29af736128708851fa74db2b17704e33450386cec538c5260d73b5e4`

## Findings

**CR1 — medium, misleading collectibility label.** For ether.fi, `inspectClaim` returns `status: "claimable"` whenever a stored request is valid and finalized and the amount getter succeeds. The reviewed implementation's `_claimWithdraw` separately calls `blacklister.nonBlacklisted(recipient)` and has escrow, downstream withdrawal and ETH-transfer requirements. The amount getter does not test these conditions. A valid finalized NFT whose current owner becomes blacklisted can consequently be reported as claimable even though collection reverts.

A bounded injected-provider reproduction returned `status: "claimable"`, `claimableWei: "990000000000000000"`, and did not call the configured rejecting `nonBlacklisted` read. The read sequence was exactly `nextRequestId`, `getRequest`, `ownerOf`, `isFinalized`, `getClaimableAmount`. This is a counterfactual-state reproduction supported by the actual source checks, not evidence that a currently sampled mainnet owner is blacklisted.

Recommended bounded correction: describe the state as **finalized**, distinguish the source-reported amount from collection executability, and explicitly say collection has not been simulated. Alternatively check relevant restrictions and retain an unverified result when those reads fail. A restriction check alone still cannot prove a payment callback succeeds. Lido's pause deliberately preserves already-finalized claims, so do not apply a generic “paused means unclaimable” rule across sources. [ether.fi reviewed implementation](https://api.routescan.io/v2/network/mainnet/evm/1/etherscan/api?module=contract&action=getsourcecode&address=0x41617D01362770ebAAC10311aB899FBc8a4E4A7E), [Lido pause/claim semantics](https://docs.lido.fi/contracts/withdrawal-queue-erc721/)

**CR2 — low, legacy fee metadata may be mistaken for a charged fee.** The ether.fi ABI retains `feeGwei` in the request struct. The reviewed implementation does not reference that field anywhere in its executable source: neither `_getClaimableAmount` nor `_claimWithdraw` deducts it. The inspector converts it to `sourceFeeWei` without explaining that distinction. A consumer could subtract it again or present a fee the current claim path does not charge. The injected request with stored `feeGwei: 17` produced `sourceFeeWei: "17000000000"` despite this absence of a charging path.

Recommended bounded correction: name the field `legacyStoredFeeWei`, or explicitly document it as stored historical metadata with no assertion that it is charged under the reviewed implementation. Preserve the source-reported amount without a second deduction. This is a labeling/API issue; no double subtraction currently occurs inside these two reviewed modules. [Verified request interface and implementation bundle](https://api.routescan.io/v2/network/mainnet/evm/1/etherscan/api?module=contract&action=getsourcecode&address=0x41617D01362770ebAAC10311aB899FBc8a4E4A7E)

## Arithmetic and other checks

No material arithmetic bug was found. An independent executable probe imported the actual root module and tested **2,211** combinations: every integer payment budget from 0 through 200 and fee rates 0, 1, 5, 99, 100, 999, 1000, 3333, 5000, 9999 and 10000 bps. For each returned payment `p`, it independently computed debit `p + ceil(p * fee / 10000)`, asserted debit fits the budget, and asserted payment `p + 1` does not. Thus the floor-payment/ceil-fee combination was both conservative and maximal throughout the tested small-unit domain, including 100% fees.

Another **48** deterministic cases varied remaining duration (0, 1, 15, 365 days), annual hurdle (0, 1, 500, 10000 bps) and upfront/terminal costs (0, 1, 57 base units), with an additional recovery haircut and reserve. They verified that actual initial capital plus the present-value reserve, multiplied by the exact simple-return factor, did not exceed stressed terminal recovery net of collection cost. These checks passed. They validate arithmetic under explicit assumptions, not the truth of payout, delay, funding-rate or seller-reservation inputs.

The inspected code correctly retains negative seller effective proceeds, rejects a zero-improvement tie, avoids JavaScript floating-point money calculations, treats operating scale as a steady-state illustration, keeps finalized amount separate from pending face, pins related source reads to one block, exposes implementation drift, and treats a deleted ether.fi record as **closed**, not proof that payment occurred. Existing ordinary-owner and source-interface assumptions were inspected against the actual code rather than generalized from ERC-721 alone.

The tests were run from a temporary `.mts` file using the installed `tsx`, with no network mutations. The first `.ts` execution failed because `/tmp` selected CommonJS for top-level await; rerunning the same probe as `.mts` succeeded. No failing probe was counted as passing. Mainnet source/ABI retrieval was read-only. No current blacklisted claim, live payout, NFT sale or recipient callback was executed.

## Integration handoff

Both findings were sent to the integrator before this artifact. Their resolution is pending at this reviewed revision; the integrator should update evidence after changing labels/API and rerunning affected tests. No additional economic model, asset integration or settlement feature is requested by this review.
