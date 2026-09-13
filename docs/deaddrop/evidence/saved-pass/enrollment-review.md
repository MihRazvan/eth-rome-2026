# Independent enrollment source review

13 September 2026. Independent vault worker reviewed the integrator's channel, relay API, offline operator and browser enrollment at `11bcb1f`. This is a scoped engineering review, not an external audit. Public paid-flow observations belong to the separate browser/receipt evidence.

Verified corrections:

- [Channel](../../../../experiments/qualification/pilot/enrollment-channel.ts): exact context fields reject nested extras; HPKE binds chain, escrow, issuer, ticket and direction. Executable round-trip/adversarial tests cover altered ciphertext, unrelated keys and wrong context.
- [Operator](../../../../experiments/qualification/pilot/enrollment-operator.mjs): CLI/entity/encrypted tickets agree, decrypted applicant matches the signing wallet, and an actual reply-key encryption probe runs before credential allocation. Identical duplicate entities choose a canonical record; conflicts fail closed. Per-ticket local locks and reuse of a matching existing issuance avoid blind duplicate signing.
- [API](../../../../experiments/qualification/pilot/hosting/enrollment-api.ts): wallet signatures bind normalized encrypted bytes and short authorization expiry. Writes serialize within one instance; wallet/total admission checks bound routine usage. Approved duplicate lookup and retry recovery were corrected.
- [UI](../../../../experiments/qualification/pilot/web/enrollment.ts): failed operations recompute controls; missing old applications and expired approvals permit renewal while retaining the holder.

The follow-up found a stale-session edge: after awaiting approval decryption, the expired-approval branch could write before checking whether the wallet changed. Integrator correction **`cf02149`** checks the session immediately after decrypt/parse, before either credential branch mutates the vault. TypeScript and focused vault/channel/API checks passed afterward; public saved-pass/reload checks were rerun after deployment.

Remaining boundaries: publication serialization, admission quotas and relay nonce coordination are not globally atomic across serverless instances. Relay funds are finite; outages/rejections are surfaced rather than simulated as approval. Browser private material is accessible to same-origin code and requires an optional private backup for recovery after clearing storage. Issuer approval is manual; interrupted local approval locks require inspection. HPKE confidentiality and wallet application authorization do not replace prover/contract verification of an issued credential.
