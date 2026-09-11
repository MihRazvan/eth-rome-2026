# Read-only live readiness preflight

Implemented in `packages/runtime/preflight.ts` and `scripts/preflight.ts`. This command has no transaction, signing, publication or faucet capability. Private keys are validated locally and used only to derive public addresses. No wallet client is created.

Run with environment already configured:

```sh
npx tsx scripts/preflight.ts
```

To load a project `.env` explicitly with the required Node runtime:

```sh
node --env-file-if-exists=.env --import tsx scripts/preflight.ts
```

The integrator owns the optional npm script. Default manifest is `deployments/fuji.json`; `EXIT_DEPLOYMENT` can override it. Local-chain manifests are rejected for this live-test check. An unavailable manifest blocks lifecycle readiness while independent sponsor and RPC reads continue.

Checks cover valid secp256k1 scalars; four distinct deployer/maker addresses; manifest maker matching; nonzero distinct contract addresses; public manifest RPC shape; actual Fuji/Tiramisu chain IDs; configured signer native balances; deployed bytecode existence; an Arkiv offer query; postage identifier syntax; configured upload and retrieval endpoints; and GET health responses. Dependent balance, code and Arkiv queries do not execute against a mismatched chain.

`passed` applies only to the named read or syntax check. One wei is a positive observed balance, not a sufficient deployment budget. Bytecode existence does not verify the ABI, proxy implementation, source identity, configuration or permissions. An Arkiv read does not prove publication/expiry. An HTTP health response does not establish Swarm upload authorization, batch ownership/capacity or a bytes round-trip. Separate end-to-end evidence remains mandatory.

The overall status can only be `blocked` or `unverified`, never live-verified. Exit code 1 means a blocking configuration/read check or unexpected command failure. Exit code 2 means no blocking read/configuration check was found but writes remain unverified. Health-endpoint failure is inconclusive rather than proof the provider cannot upload. This is intentionally unsuitable as a generic zero-exit deployment approval gate.

Reports contain only fixed diagnostic messages, public addresses, observed balances and check statuses. RPC URLs, file paths, postage IDs, private keys, and raw provider errors—including attacker-controlled error names—are omitted. HTTP request bodies are read RPC methods only; Swarm checks use GET. No provider request or returned payload is logged. `validateConfiguration` is pure, and `runPreflight` accepts a read-only probe interface for deterministic tests.

## Actual verification, 11 September 2026

- `npx tsc --noEmit`: passed against worktree base plus this change.
- `npx vitest run packages/runtime/preflight.test.ts`: 6 tests passed. Cases cover duplicate identities/invalid scalars, secret redaction, chain mismatch gating, absent bytecode and zero gas, maker-manifest mismatch, malformed config and hostile provider errors. Positive reads remain explicitly unverified for writes.
- `npx tsx scripts/preflight.ts`: actual read-only run at **19:48:08 UTC**, exit code **1**, overall **blocked**. Fuji chain **43113** and Arkiv Tiramisu **7738577** observed; Arkiv offer-index first page succeeded; Swarm retrieval health endpoint reachable. Process environment had no configured five signer keys, upload endpoint or postage batch, and no Fuji deployment manifest was available in this isolated worktree. No signer balances or deployed code could therefore be checked. No live write, bytes round-trip or native expiry verification occurred.

No new credentials were generated, loaded from wallet storage or printed. No network mutation was performed. The research branch contains no `.env` change or root configuration change.
