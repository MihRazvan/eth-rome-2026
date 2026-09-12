# Independent public-terms review

The new contract path preserves the existing funding authority and amount accounting. No fund-redirection, mutable commitment or signature-substitution defect was found in this bounded review. Two low-severity request-handling issues were reproduced: UTF-8 corruption across HTTP chunks, and duplicate concurrent uploads consuming all of one client's local quota.

This is a targeted independent implementation review, not a full audit or public deployment verification. Reviewed root working-tree files on September 12, 2026 around 09:12–09:14 UTC; the reviewer did not author these changes and made no source edits. Root source hashes at capture:

| File | SHA-256 |
|---|---|
| QualificationEscrow.sol | `0fdfbb30f835a49cf22e08291c1ccab93a6120d97a843050458884e52bffba9a` |
| pilot/terms.ts | `c78550f168cc6ccaee65c75abd6b98d97d4813da41276a15af1557cb14fe40b7` |
| pilot/start.mjs | `3c6d8b3353dc1c256e62173ca157a0be6c4966fa4a889b15aa284c14113481d7` |

## L1 — Chunk decoding can reject valid signed public terms

**Location:** `start.mjs`, POST `/api/terms`; the older POST `/api/upload` has the same pattern.

**Cause:** `body += chunk` converts each Buffer to UTF-8 separately. TCP/HTTP chunks are not aligned with Unicode character boundaries. A split inside the three bytes of `✅` produces replacement characters, while JSON remains parseable. The server canonicalizes these altered terms and computes a different digest from the correctly signed original.

**Impact:** a legitimate non-ASCII scope or title can fail signature verification depending on request chunking. This does not permit a forged scope to pass: the signature binding rejects it. The body cap also counts JavaScript characters rather than received bytes.

**Reproduction:** encode a valid signed terms request containing `scope: 'Public scope ✅'`; split its Buffer after the first byte of that character; independently decode and concatenate both parts. The parsed scope digest differs from the original. This reproduction exercised the actual terms encoder, not an HTTP server or Bee write.

**Minimal correction:** collect Buffer chunks, enforce a running byte-length cap, and decode `Buffer.concat(chunks).toString('utf8')` once. Alternatively use a streaming UTF-8 decoder. Apply consistently to both request bodies. Add a split-Unicode request regression.

## L2 — Concurrent duplicate authorizations consume quota repeatedly

**Location:** `start.mjs`, POST `/api/terms`, cache lookup and `termsQuota` reservation.

**Cause:** the completed-upload cache is populated only after `await store.upload`. No in-flight entry or lock exists for the same client/digest. Ten concurrent copies of one valid signed request all miss the cache, reserve one quota unit each and perform duplicate storage work.

**Impact:** one logical upload can exhaust that client's entire per-process allowance, blocking subsequent legitimate scopes until restart. Retries after upload failures also permanently consume units. The cap itself is race-safe: reservation happens synchronously before storage, so the observed race cannot exceed ten uploads for that client. It does not affect escrow funds. This endpoint is currently local-only and requires a valid client's signature, bounding severity.

**Reproduction:** extract the exact POST route body from the reviewed root source into an isolated async function with real `verifyMessage`/terms encoding and a delayed fake ByteProvider. Submit twelve identical valid requests simultaneously. Observed ten storage calls, quota ten, two quota errors. No real storage or transaction writes were performed.

**Minimal correction:** keep an in-flight promise or lock keyed by the canonical client/digest before awaiting upload; duplicate requests should reuse that operation. Define whether failures consume rate budget, and show that distinction in errors. A bounded time-window or explicit recovery can improve the local-only quota without promising global Sybil resistance.

## Contract and authenticity observations

`createJobWithDocument` rejects a zero locator, calls the same `_createJob` as the legacy path, then stores the locator and emits the digest. Both public entrypoints are nonreentrant; internal extraction preserves the original caller. `_createJob` still writes that caller as client, transfers funds from that caller, and checks the actual escrow balance increase equals the amount. A failed transfer rolls back the job, counter and locator. There is no later terms or locator setter.

The contract cannot validate Swarm bytes itself. It commits the caller-supplied digest and locator; `/api/terms` independently downloads bytes against that digest, canonicalizes the supported schema and matches client, chain, escrow, token, amount, qualification and all deadlines to the funded job. Legacy jobs receive an explicit missing-document result. An upload signature authorizes local storage work only; it does not let the server fund or alter a job.

The upload message binds the canonical digest, client, chain, escrow and short expiry. The digest covers the token, financial fields, title, scope and policy. The encoder explicitly reconstructs supported fields, preventing arbitrary extra object properties from entering the published payload. Human-entered title and scope remain intentionally public. Standalone `verifyMessage` covers EOAs here; no ERC-1271 support was demonstrated.

Repeated identical scopes across different jobs are permitted. The onchain job ID is unique and its commitment immutable, so omission of a future job ID from the pre-upload schema does not let a reviewer change another job's terms. A client can deliberately fund incoherent bytes by bypassing the UI; retrieval then rejects the mismatch rather than inventing a valid scope. This is a usability concern for custom callers, not authority escalation.

## Exact-transfer payout limitation

The escrow checks inbound balance deltas but does not check outgoing recipient deltas. `SafeERC20` handles false/no-return call conventions and reverts, not fee-on-transfer economics. A freely chosen token that taxes outgoing escrow transfers could make a terminal job pay less than its nominal amount. The contract constructor does not independently restrict token identity, so its generic deployment surface must retain the exact-transfer admission requirement.

Canonical Fuji USDC has six decimals and ordinary ERC20 accounting in the inspected Circle source and read probe. A configured canonical-token deployment makes this limitation acceptable within that explicitly restricted test integration; it is not a proof that every ERC20 is supported. Circle proxy/pausing/blacklisting authority remains an external trust dependency. If USDC blocks a transfer, SafeERC20 reverts atomically and job status rolls back. An administrator changing implementation economics is outside the current invariant assumptions. Do not describe successful inbound checks as universal outgoing exact-payment protection.

For stronger generic-token support, measure outgoing recipient deltas as well and enforce exact receipt, considering self-transfers and unsupported balance behavior. For this product, canonical-address enforcement in the public deployer plus explicit token semantics is the smaller justified scope. No actual Fuji payout was executed during this review.

## Actual verification

- Root `forge test --root experiments/qualification/contracts`: **18 passed, 0 failed, 0 skipped**, three suites. This includes the new client-funded public-scope commitment test and existing financial/proof tests.
- Real EOA-signature probe: eleven independent field changes rejected, covering amount, class, chain, token, client, escrow, all three deadlines, title and scope.
- Funded-job matching probe: six altered client/financial/deadline fields rejected; a matching job accepted.
- Extra private-property stripping checked on the encoded bytes.
- UTF-8 split corruption reproduced with the current encoder.
- Exact extracted route concurrency probe: twelve requests → ten duplicate upload calls and two cap errors; no cap bypass.

No browser flow, RPC outage recovery, real HTTP body splitting, public Swarm upload, public token transfer or issuer-wallet operation was run in this review. Findings were sent to the integrator for correction; this report captures the pre-fix code and does not claim their resolution.
