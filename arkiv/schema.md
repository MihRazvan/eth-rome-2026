# EXIT Arkiv schema — version 1

Implementation: `packages/transport/arkiv.ts`. Target SDK `@arkiv-network/sdk@0.8.1`, Tiramisu chain 7738577. Live read probe at 2026-09-11T16:39:13Z returned block 318199 and zero EXIT offers. This is read connectivity evidence, not publication or expiry evidence.

## Visibility fixed before attributes

| Mode | Seller | Maker | Arkiv / Swarm / visitor | Settlement observer |
|---|---|---|---|---|
| Public | Signed quote | Every published quote | Signed quote bytes reachable by ordinary reference | Submitted terms and transfers |
| Private | Locally decrypts authenticated offers | Own quote, public request | Routing metadata and HPKE ciphertext only | Submitted terms, even if execution fails |

Never index price, net proceeds, signature, underwriting secrets, plaintext quote hash, or decryption keys. No sorting by a private price on the server. Sensitive supporting documents must be encrypted separately or omitted; the current quote pipeline does not upload underwriting documents.

## Offer entity

All attributes are an explicit allowlist; `offerAttributes` cannot accidentally spread a quote.

| Attribute | SDK type | Purpose |
|---|---|---|
| `app` | string `exit` | Application namespace |
| `kind` | string `offer` | Record kind |
| `schema` | numeric `1` | Schema compatibility |
| `settlementChain` | numeric | Avalanche execution chain; Arkiv storage is not a bridge |
| `market` | lowercase address string | Settlement contract |
| `seller` | lowercase address string | Intended seller |
| `request` | bytes32 encoded string | Public request identifier |
| `mode` | string `public` / `private` | Explicit routing mode |
| `keyVersion` | numeric | Recipient binding version; public mode uses zero |

Payload: JSON `{ chainId, market, seller, requestId, mode, keyVersion, reference, sha256 }`. `reference` is a 64-hex ordinary Swarm bytes reference. `sha256` covers the uploaded bytes, hence ciphertext in Private Offers. It is not a guessable commitment to the quote. Arkiv entity owner may be the team-operated discovery publisher; maker authority comes from the enclosed quote signature, never entity ownership.

Create with `flags.readonly=true`, random SDK salt, `expires: ExpirationTime.fromSeconds(lifetimeSeconds)`. Lifetime must be a positive multiple of the network block duration. Prefer short useful offer discoverability lifetimes and republish freshly signed offers deliberately. Native expiry removes discovery records; settlement's Avalanche deadline and cancellation are separate.

## Query and comparison

Compound equality on app, kind, schema, settlementChain, market, seller, request and mode. SDK page size 200. Walk immutable pages with `page = await page.next()` until `hasNextPage()` is false. Only then retrieve/authenticate offers and compare valid terms locally. A failed page rejects the operation; no partial list is called the best offer.

Result entities are untrusted. Validate route against the request, retrieve bytes, compare digest, validate private envelope context and decrypt if authorized, parse canonical quote and verify maker signature. Inspect current ownership/depletion/deadline/capital and simulate settlement before acceptance. Storage cannot authorize settlement.

## Native expiry evidence procedure

`proveNativeOfferExpiry` publishes a real stored offer record with a 12-second native lifetime, records the entity, and repeats an identical fresh-head query before/after the boundary. It has no delete method and records query text, transaction hash, expiry block, observed blocks and entity keys. Cursors remain tied to one snapshot; each expiry check creates a fresh query.

Run `ARKIV_EXPIRY_RECORD_PATH=/absolute/path/to/published-offer-record.json npm run probe:sponsors` with a funded Arkiv signer and actual stored record. Environment setup command may vary with root scripts. The checked-in implementation exists; public write/expiry evidence remains blocked until credentials are supplied. No scheduler or local-clock filter substitutes for native expiry.

## Network/source references

- [Official event hub](https://hub.arkiv.network/ethrome): observed live September 11, now links its [submission form](https://tally.so/r/vGZ98v). No form submitted.
- [Tiramisu network](https://docs.arkiv.network/networks/tiramisu/).
- [SDK source](https://github.com/Arkiv-Network/arkiv-sdk-js) and installed 0.8.1 source are authoritative for the chosen API; several prose snippets still describe the prior SDK.
- [Query documentation](https://docs.arkiv.network/typescript-sdk/querying-data/), [mutation documentation](https://docs.arkiv.network/typescript-sdk/mutating-data/).

Mission 02 is targeted. Mission 01 is not claimed (no pre-existing indexer migration). Mission 03 is not claimed by HTTP polling. Human conversation/qualification remains a human action.
