# Transport and privacy acceptance evidence

Environment: local Node 25.2.1, dependency versions @arkiv-network/sdk 0.8.1, @hpke/core 1.9.0, viem from root lockfile. Worker based on 9289233; final integration commit supplied by integrator. No secrets copied to evidence.

## Executed

- `vitest run packages/transport`: 8 tests passed, September 11 2026. Actual HPKE encrypt/decrypt; wrong recipient, changed ciphertext/request/chain/version, substituted key certificate, maker signature mutation, expired/rotated/revoked key, unavailable registry, encryption-before-upload, no plaintext price/signature in captured body/index payload, independent retrieval SHA-256 integrity, all-page discovery, IndexedDB structured clone/reload and permanent key-loss behavior.
- TypeScript no-emit check for `packages/transport/index.ts`: passed.
- `tsx scripts/probe-sponsors.ts`: live Tiramisu read succeeded at 2026-09-11T16:39:13.153Z, chain 7738577, block 318199, compound `app=exit && kind=offer` query returned zero first-page entities with no next page. The empty result is real, not demo liquidity.
- Arkiv event brief HTTP 200. Swarm public gateway `/health` HTTP 200.

The HPKE tests use local test wallets and HTTP test doubles explicitly. They are cryptographic/transport unit evidence, not funded onchain or sponsor-write evidence. fake-indexeddb verifies serialization behavior in Node; a real browser reload must additionally be evaluated by the integrator.

## Blocked / not claimed

- Actual signed-offer Swarm upload, independent public-network retrieval: requires configured `SWARM_UPLOAD_URL`, funded `SWARM_POSTAGE_BATCH_ID`, suitable retrieval gateway. Public health response does not grant uploads.
- Arkiv entity publication and native-expiry before/after: requires funded `ARKIV_PRIVATE_KEY`, and an actual stored offer record. `proveNativeOfferExpiry` implements the fresh identical query/no-delete experiment, but this public run was not performed.
- Public key-registry deployment and browser transaction flow: owned by integrator/protocol worker; transport requires the registry reader and refuses unavailable authority.
- Onchain reconciliation after retrieval and quote simulation: integrator supplies current claim state/simulation. Signature verification alone is not proof of funds or current economic bounds.
- No required human conversation or submission completed.

## Integration usage

```ts
const context = { chainId, market, seller, requestId: offerRequestId(chainId, market, claimId, ownershipEpoch) };
const codec = purchaseQuoteCodec({ claimId, source, sourceVersion }, publicClient);
const store = new BrowserKeyStore();
const key = await generateRecipientKey();
const binding = { ...context, publicKey: key.publicKey, version: 1, validFrom, validUntil };
await store.save(keyStorageId(binding), key);
const signature = await wallet.signTypedData(keyBindingTypedData(binding));
// Register keccak256(binding.publicKey), binding.version, binding.validUntil; wait for confirmed receipt.
const cert = { binding, signature };
const status = registryStatusReader(publicClient, registryAddress);
const verify = (data, signature, address) => publicClient.verifyTypedData({ ...data, signature, address });
const services = {
  storage: new SwarmBytes({ uploadUrl, retrievalUrl, postageBatchId }),
  index: createArkivIndex({ rpcUrl: arkivRpc, account: arkivSigningAccount }),
};
await publishPrivateOffer(signedQuote, cert, context, codec, verify, status, services, 60);
// Public choice invokes publishPublicOffer explicitly. No private error fallback.
const records = await services.index.discover(context, 'private');
const values = await Promise.all(records.map(record => verifyStoredOffer(record, context, codec, services.storage, { cert, key })));
// Compare authenticated valid offers locally, inspect/simulate current chain state immediately before acceptance.
```

Private payloads must stay entirely in browser/maker client; a server upload proxy may receive ciphertext only. Swarm gateway configuration is infrastructure access, not a wallet encryption key. Never persist plaintext quotes or private keys in logs/telemetry.
