# Public Arkiv lease evidence runner

This runner publishes **one real listing for an existing funded Fuji job**, observes it in two independent Node worker clients, and confirms natural expiry while the escrow remains funded. It does not create/fund the Fuji job, retrieve faucet funds, register wallets, delete entities, or replace browser judging evidence.

From the repository root:

```sh
# Read-only prerequisite check; no signing key is needed to inspect the job client's balance.
node --import tsx experiments/qualification/pilot/arkiv-public-probe.mjs --check --config .runtime/review-pass-fuji/deployment.json --job 1

# Explicit public write using the SAME client's protected local wallet file.
node --import tsx experiments/qualification/pilot/arkiv-public-probe.mjs --publish --config .runtime/review-pass-fuji/deployment.json --job 1 --wallet-file /absolute/private/path/client.json --lease-blocks 30
```

The wallet file must be a regular file owned by the current user with no group/other permissions (`0600` or stricter). Symlinks are rejected. Its exact schema is one property: `{"privateKey":"0x<64 hexadecimal characters>"}`. Supply an existing authorized client key privately; never put the real JSON in a terminal transcript, Git, screenshot, web deployment or chat. The script does not load `.env` or search other keys. Read-only `--check` optionally accepts `--wallet-file` to verify ownership as well; without it, `signerConfigured:false` does not claim signing access.

Both modes require the canonical Fuji manifest, a currently Open positive reward in canonical test USDC, the exact onchain scope reference/digest and successful public Swarm retrieval. The signer must match the immutable funded client. That same address needs Tiramisu GLM. A nonzero balance is only a prerequisite; the transaction can still fail for insufficient fees. The manifest's localhost/custom RPC alternatives are rejected.

The application-private `verifyListing` cannot be imported without DOM side effects. The runner mirrors its finalized funding/owner/scope policy using shared `encodeTerms`, `matchTerms` and `projectListing`, and records the current UI-policy source hash. The actual board is shared `createListingBoard`; discovery uses shared `listingQuery` and `createArkivListingDriver`. Two Node Workers isolate viem's WebSocket client cache. Each stream is established before publication. No wallet/key is passed to observer workers, and their environment is empty.

The lease defaults to30blocks and is restricted to3–60blocks. Actual expiry comes from the receipt, not a wall-clock prediction. Very short leases can expire before pre-expiry verification finishes; use30blocks for a rehearsal. Query output is bounded to100pages/10000records and observer evidence to1200records per client. The overall observation/publication deadline is240seconds with individual network timeouts. Head/event callbacks drive the board; there is no entity-query polling interval or historical start block.

Output defaults to `.runtime/review-pass-arkiv/<escrow>-<job>.json`. Optional `--out <path>` chooses another output explicitly. The output and adjacent `.journal.ndjson` are created exclusively and never automatically overwritten or resumed. Every save appends and fsyncs the public transaction/status journal before updating the readable evidence. The guarded transport records a send attempt before `eth_sendRawTransaction` and captures its returned transaction hash before waiting for the SDK receipt; retries/alternate sends are refused. An uncertain network result may mean the transaction succeeded even if no hash was returned. **Inspect receipts, account nonce and both journal files before deliberate recovery. Do not rerun with another output path to bypass an uncertain send.** An existing active client lease for the same job also blocks a duplicate publication.

`PASS_PUBLIC_SOFTWARE_CLIENTS` requires both clients to receive the actual entity event, include the new listing, remove it because a fresh query confirms native expiry, and show identical predicates before/after. The runner checks absence at/after recorded expiry, rejects an observed delete event, and verifies the Fuji job remains Open with its original scope. It records source hashes, creator/owner query metadata, transaction hash, creation block, actual expiry, observer callbacks and the surviving funded state. It makes no delete calls.

Still collect a **real second-browser UI recording**, an irrelevant-event filtering demonstration and deliberate disconnect/reconnect evidence before treating the whole sponsor demonstration as complete. Software clients are not physical users, these callbacks are not a browser DevTools capture, and this runner does not claim to have performed those additional checks. Public task attributes, scope and transaction evidence are intentionally public; confidential reports, credentials and private key material are excluded from the report.

Implementation verification: Node syntax and offline CLI/config/wallet permission guards; two actual read-only worker streams reached live state and received heads using an intentionally empty filter. No funded publication or natural-expiry run was performed during implementation. The integrator must execute the explicit write command against its authorized funded client and inspect the resulting evidence.
