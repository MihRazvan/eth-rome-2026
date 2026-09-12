# Qualification transport experiment

These adapters separate **Fuji proof authority**, **public issuer-wide snapshot transport**, **Arkiv discovery** and **client-side document confidentiality**. They do not implement a credential circuit or imply native expiry erases copied data. Existing EXIT services are untouched.

## Reusable browser API

- `beeBytes({environment, uploadUrl, downloadUrl, postageBatchId})`: ordinary Swarm byte upload/download with SHA-256 checking, response-size bounds and generic errors. Choose `public-swarm` or explicitly `local-bee`; local mode requires loopback URLs. Native 128-character encrypted references are rejected because they embed keys. A gateway credential/stamp must not be baked into a publicly hosted client; inject an authorized browser provider or owner-managed upload service as appropriate.
- `downloadIssuerSnapshot(provider, ref, trusted, validate)`: fetch one whole issuer snapshot, first requiring its metadata to match current trusted Fuji issuer state. `validate(bytes, trusted)` must recompute the prover's exact commitment and validate issuer/epoch/format. **A SHA-256 match is transport integrity, not the revocation proof.** There is deliberately no credential-index URL, partial leaf fetch or per-holder status request.
- `arkivStatusIndex({rpcUrl, wsUrl, account?})`: publish an explicit allowlisted snapshot pointer with native lifetime, discover every result page using compound issuer/root/epoch/authority/chain predicates, and subscribe using actual WebSocket transport without historical `fromBlock`. `watch` emits refresh hints; deduplicate/serialize refreshes in the consuming UI. After reconnect, independently reload the current authoritative root and reconcile discovery. Entity absence must never turn an invalid credential into a valid credential, revoke an existing payment obligation or override a contract root. Public metadata is not issuer-authenticated by itself; the downloaded commitment check remains mandatory.
- `encryptJobDocument(bytes, {chainId,contract,jobId,version:1})` returns uploadable envelope plus a **nonextractable CryptoKey**. Upload only `envelope`. `decryptJobDocument(envelope,key,context)` authenticates the exact job domain with AES-256-GCM. Contract addresses normalize to lowercase; job IDs use canonical unsigned decimal. A separate random key and IV are created each call. The creator can retain the CryptoKey in IndexedDB; this module does not yet implement persistence, recipient key delivery, rotation or cross-device recovery. Losing the returned key loses access. It is a confidentiality primitive, not a completed multi-party access workflow.

Example:

```ts
const snapshotBytes = await downloadIssuerSnapshot(store, discoveredRef, issuerStateReadFromFuji,
  async (bytes, current) => proverAdapter.verifyWholeStatusSnapshot(bytes, current.root));
// Derive the holder's private witness path locally from the complete validated state.
const encrypted = await encryptJobDocument(jobBytes, jobContext);
const storedJob = await store.upload(encrypted.envelope);
const recovered = await decryptJobDocument(await store.download(storedJob), encrypted.key, jobContext);
```

The opaque snapshot byte format avoids inventing a Merkle hash incompatible with the proof worker. `SnapshotRef.root` is the prover's canonical decimal root field; `authority` identifies the contract that supplies current trusted state. A caller must pin related Fuji state reads to one confirmed block. A storage operator can observe issuer/job metadata, file sizes, access time and network addresses; downloading whole state avoids exposing the specific requested index but does not make the user anonymous.

## Run

Uses the repository's installed SDK/viem/tsx; no root dependency changes:

```sh
node --import tsx --test experiments/qualification/transport/adapters.test.ts
node --import tsx experiments/qualification/transport/probe.ts
```

The default probe is read-only. It reports funded-key and postage gates explicitly. `--write-testnet` permits configured public testnet writes using `ARKIV_PRIVATE_KEY`, optional `ARKIV_RPC_URL`, `SWARM_UPLOAD_URL`, `SWARM_RETRIEVAL_URL`, `SWARM_POSTAGE_BATCH_ID`. `FUJI_PRIVATE_KEY` or `DEPLOYER_PRIVATE_KEY` allows a read-only balance readiness check; it does not deploy. The public write path uploads a **labelled synthetic transport snapshot**, then publishes a short-lived pointer and verifies the same query before/after its native expiry boundary without a delete call. It does not claim that the synthetic root passes the credential circuit. Never load real personal documents into this probe.

For explicit local Bee, invoke `node experiments/qualification/transport/start-local-bee.mjs`. It refuses any existing `bee-factory-*` container and occupied required port. This downloads official `@ethersphere/bee-factory@1.1.2` into a temporary directory, installs only its runtime dependencies, restricts host bindings to loopback and changes its Anvil port from 8545 to 28545, including the actual Anvil argument and healthcheck. It preserves upstream dependencies/licenses; upstream prebuilt images currently use a mutable latest tag, so record image digests for any new run. It suppresses upstream startup logs, which print known test keys. The stack has five actual Bee nodes and a separate Anvil with test balances. It is not public Swarm.

After local startup, purchase a **mock local** batch with `POST http://127.0.0.1:1633/stamps/1000000000/17`, wait until `/stamps` reports usable, and use its returned batch ID with upload `http://127.0.0.1:1633` and retrieval `http://127.0.0.1:1635`. Pass `--local-bee` to the probe. No public BZZ purchase or faucet action is necessary. Avoid using the factory's generic cleanup command while another task owns such containers; remove only this experiment's six named containers when the integrated browser no longer needs them.

## Fresh evidence and blockers

See `public-probe.json`, `local-bee-probe.json` and `evidence.md`. Earlier EXIT or sponsor research successes are not counted as fresh experiment writes. No local fixture or devnet is automatically substituted after a failed public call.
