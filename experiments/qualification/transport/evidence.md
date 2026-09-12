# Fresh qualification transport evidence

Observed September 12, 2026, beginning 07:23 UTC. Scope: adapters and transport capability, **not an implemented qualification proof, issuance service, public deployment or full application**. Only files under `experiments/qualification/transport/` were changed.

## Public access

Fresh environment inspection found no inherited Arkiv/Swarm/Fuji/private-key configuration and no root project `.env`; `.env.example` is present. No other user wallet, keystore, browser identity or credential vault was searched. No project signing account was generated and no real funds were spent.

`public-probe.json` records a fresh default read-only run at **07:23:44.733 UTC**:

- Arkiv Tiramisu: chain **7738577**, block **344735**, compound qualification issuer-status query succeeded with zero records and no additional page. Zero records is not a fixture substitution.
- Actual SDK WebSocket: **9 notifications in 10,003 ms**, zero reported errors, no historical start block. This is passive observation of the public network, not an experiment-owned two-wallet publication.
- Fuji: chain **43113**, block **58330100**; deployment blocked because no project signer is configured. A reachable RPC is not deployability.
- Official Arkiv anonymous `GET /api/faucet`: **401**; no claim attempted.
- Public Swarm upload and Arkiv create/native expiry: **blocked**, not passed. No configured funded postage/gateway or Arkiv signing key exists.

The [current Arkiv faucet](https://hub.arkiv.network/faucet) still directs users through wallet connection. The existing September 11 browser evidence documents SIWE and CAPTCHA; this experiment reconfirmed anonymous401, not a new human login attempt. [Swarm ID quick start](https://swarm.snaha.net/docs/getting-started/) still requires an authenticated identity **and** usable upload capability. [Subsidised gateway documentation](https://swarm.snaha.net/docs/subsidised-gateway/) requires owner-funded infrastructure; it is not a free anonymous write URL. The [event brief](https://www.ethrome.org/hackermanual/prizes.html) offers desk-issued gift codes, not an authorization to guess codes or bypass account controls. The precise public gates are: an authorized funded Arkiv test account, a funded Fuji deployment account, and redeemed/usable Swarm postage or an authorized upload gateway. No new permitted anonymous funded route was identified. Existing Core/Builder Hub CAPTCHA/login requirements are prior evidence; no fresh faucet transaction was attempted.

## Actual local Bee round trip

Docker server **29.7.2** was available. Current official docs say `bee dev` was removed and recommend [bee-factory](https://docs.ethswarm.org/docs/develop/tools-and-features/bee-dev-mode/). The inspected official npm package **@ethersphere/bee-factory1.1.2** obtained six prebuilt images, creating five actual Bee nodes and its own Anvil. `local-stack.json` records image digests, actual loopback bindings, node health and the local batch ID. Bee reports **2.8.2-7e703f4-dirty**, API **8.1.1**; do not silently describe this prebuilt image as a clean pinned2.8.1 release.

Factory defaults bound ports to all interfaces. Temporary runtime changes restricted them to127.0.0.1. Initial startup found an existing Anvil at8545; that process was left untouched. A first port-only adjustment was insufficient because the factory's Anvil command and readiness detection still assumed8545. The final adjustment changed all three places to **28545**. The isolated chain is **1337**. Existing EXIT ports5173/8547/8787 and Kurtosis containers were not modified. The generated factory logs print public Foundry test keys; the reusable startup wrapper suppresses those logs, and no keys are committed in this artifact.

A **local mock** postage purchase returned HTTP201, and `/stamps` confirmed the batch usable. This used the factory's mock balances on its local chain, not public xBZZ/xDAI. The successful `local-bee-probe.json` run at **07:26:50.143 UTC** uploaded through queen **127.0.0.1:1633** and retrieved through a separate worker **127.0.0.1:1635**:

| Object | Result |
|---|---|
| Whole issuer-wide synthetic status snapshot | 138 bytes uploaded/retrieved, SHA-256 matched |
| Private synthetic job document | 49 plaintext bytes;213-byte authenticated ciphertext envelope uploaded/retrieved |
| Client decryption | Successful under the original job context/key |
| Key publication | No key in uploaded envelope or public reference |
| Swarm scope | **Local Bee**, not public Swarm |
| Credential root/issuer authenticity | **Not evaluated**; snapshot is explicitly transport-only synthetic data |

The same run freshly observed ten Arkiv WebSocket events in10,002ms with zero errors; public write gates remained blocked. Native expiry was not fabricated with a local timer. The provided public-write probe will publish a genuinely stored snapshot pointer, inspect its query before expiry, wait until the network passes its returned expiry block and inspect the identical query after expiry, without calling delete. It is presently **unrun** because authorization/funding is missing.

## Adapter verification

Six independent Node tests passed after final adapter edits. Cases cover AES-GCM authentication with different job/chain/contract contexts, tampered ciphertext, nonextractable keys, whole-snapshot single-URL retrieval, trusted-root mismatch rejected before fetching, mandatory commitment-validator failure, wrong downloaded digest, bounded streaming size, encrypted-reference rejection, generic provider errors, and the public attribute allowlist. Test providers are injected local doubles and labelled tests; they are never automatic live fallbacks.

Commands actually run:

```sh
node --import tsx --test experiments/qualification/transport/adapters.test.ts
node --import tsx experiments/qualification/transport/probe.ts
# Local probe with explicitly configured loopback endpoints and local mock batch:
node --import tsx experiments/qualification/transport/probe.ts --local-bee
# Standalone typecheck with installed root TypeScript:
tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck --types node experiments/qualification/transport/{bytes,cipher,arkiv,probe,adapters.test}.ts
node --check experiments/qualification/transport/start-local-bee.mjs
```

Typechecking initially exposed TypedArray/BufferSource generic distinctions and a missing explicit Node types flag; both were corrected, and the final standalone check passed. The setup wrapper is syntax checked and mirrors the successful temporary setup changes; it was **not rerun over the already running stack**, since it intentionally refuses existing factory containers.

## Remaining integration responsibilities

The root authority and public-input ordering come from the qualification prover/contracts. Consumers must read trusted issuer state from Fuji, recompute the exact Merkle commitment for downloaded **whole** snapshot bytes, and derive their secret witness path locally. This transport never chooses a different root because an index entry expired. Publication metadata and its digest do not alone authenticate an issuer.

The browser key returned by document encryption is currently retained only by its caller. Persistence, recipient key delivery and revocation of future access are not implemented by this module; do not claim multi-party sharing or recovery yet. Downloaded plaintext cannot be recalled. Public issuer snapshot retrieval hides the selected credential index from the URL, but metadata, IP address, timing and file-size observations remain.

Six Bee/factory containers remain running for the integrator's browser work, all loopback-bound. Only those experiment-owned containers may be torn down when no longer needed. Public testnet publication/deployment remains a separate acceptance gate.
