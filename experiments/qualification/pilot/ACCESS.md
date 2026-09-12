# Public pilot access: explicit gates

This preflight is read-only. It inspects only inherited project configuration, the explicitly selected project's `.env`, the explicitly selected public network JSON, and named public services. It does not search wallets, keystores, browser identities, shell histories, cloud secrets or other accounts. It never creates an identity, claims faucet funds, deploys, signs, uploads or modifies the running local Bee/Anvil services.

Run from the checkout with dependencies installed:

```sh
node experiments/qualification/pilot/preflight.mjs --self-test
node experiments/qualification/pilot/preflight.mjs \
  --project-dir /path/to/authorized/project \
  --config experiments/qualification/pilot/network-config.example.json
```

`--project-dir` defaults to the current directory. Only `.env` immediately inside that directory is read; an outward-pointing symlink is rejected. Inherited environment takes precedence over `.env`. The example deliberately contains blank deployment/upload/API fields. Copy it to an appropriate local configuration file, fill actual public addresses after deployment and retain chain 43113. Never publish authenticated RPC URLs, bearer tokens or keys in a public network JSON. Redacted output omits all endpoint URLs and config values except public signer/contract addresses, chain IDs, blocks and native balances. Raw HTTP/RPC errors and response bodies never appear in the report. Do not enable dependency debug logging when using credentials.

The command exits **2** for BLOCKED or UNVERIFIED readiness and **0** for its passing self-test. A read-only command cannot certify a completed funded lifecycle; even fully configured healthy reads return UNVERIFIED until actual public write evidence exists separately. Individual checks may PASS.

## Supported configuration

| Purpose | Project environment override | Public JSON field |
|---|---|---|
| Fuji reads | `FUJI_RPC_URL`, then `EXIT_RPC_URL` | `rpcUrl`, `chainId` fixed to43113 |
| Fuji authorized project signer | `FUJI_PRIVATE_KEY`, then `EXIT_DEPLOYER_KEY`, then `DEPLOYER_PRIVATE_KEY` | Never in public JSON |
| Arkiv reads | `ARKIV_RPC_URL` | `arkiv.rpcUrl`; Tiramisu chain7738577 is checked |
| Arkiv authorized project signer | `ARKIV_PRIVATE_KEY` | Never in public JSON |
| Deployed contracts | — | `escrow`, `verifier`, `keyRegistry`, `token` |
| Public upload/download | `SWARM_UPLOAD_URL`, `SWARM_RETRIEVAL_URL` | `swarm.uploadUrl`, `swarm.retrievalUrl` |
| Public Bee postage | `SWARM_POSTAGE_BATCH_ID` | `swarm.postageBatchId` (ordinary public batch ID) |
| Authorized gateway bearer | `SWARM_AUTH_TOKEN` | Never in public JSON |
| Pilot API | `QUALIFICATION_API_URL` | `apiUrl` |

Private keys must be hex32bytes prefixed `0x`, and valid secp256k1 scalars. Only configured project signers are derived and queried for native balances. Nonzero balance does not prove sufficient gas; no gas estimate or transaction simulation is performed. Bytecode at a configured address does not prove the correct ABI, verifier setup, source revision, token policy or escrow→verifier/key-registry relationships. Deployment integration must establish those relationships separately. An injected-wallet-only pilot need not give this script a user private key: its account funding/deployment path then remains outside this particular signer probe and must be demonstrated through the wallet.

Only HTTPS public endpoints are accepted. Loopback services cannot accidentally satisfy public readiness. The Swarm read checks a health route (Bee JSON `status:ok` or gateway plain `OK`) and, if a public batch is configured, GET `/stamps/{batchId}`. A usable response establishes only what that node reports. Some authenticated/subsidised gateways intentionally omit stamp introspection; those remain UNVERIFIED rather than falsely rejected as universally unusable. This script does not implement Swarm ID login or its `canUpload` handshake. Supplying a bearer token is not itself upload permission. A public gateway must independently support the required ordinary ciphertext upload, browser CORS and subsequent independent retrieval.

## Fresh observation and remaining gates

See `access-evidence.json` for the exact latest run time, block heights and duration. No main project `.env` or configured project Fuji/Arkiv signing key was found at the check. Public Fuji/Arkiv RPCs and the Swarm retrieval health endpoint are reachable. Public contract addresses, upload authority/postage and hosted pilot API are unconfigured. This does not claim there are no accounts elsewhere; they were intentionally not inspected.

A human may use the official [Arkiv faucet](https://hub.arkiv.network/faucet), [Avalanche Builder Hub console](https://build.avax.network/console) or the event's documented Swarm gift-code flow with their authorized project wallet. The old Avalanche faucet URL currently redirects to that console. No anonymous funding success, redemption, login or bypass was attempted here. Existing prior SIWE/CAPTCHA observations are not relabeled fresh transaction failures. Gateway/postage mechanics are documented in the [official Bee API](https://docs.ethswarm.org/api/), checked12September2026; a health200 is not POST `/bytes` permission.

Before public readiness can be claimed, retain actual funded deployment receipts, registry-key registration from separate wallets, Arkiv entity create and native-expiry evidence, encrypted Swarm upload/download with client decryption, and a proof-bound Fuji assignment settled by the independently controlled client. Keep the existing local Anvil18547/Bee1633/1635 results explicitly local. The preflight intentionally never restarts or replaces them.
