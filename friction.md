# Current product: Cutout

The current reproducible sponsor feedback is [feedback.md](feedback.md); see [Arkiv schema](arkiv/schema.md) and [submission evidence](arkiv/submission.md). The earlier EXIT feedback below is retained as project history.

---

# EXIT integration friction — observed September 11, 2026

No issues were posted to sponsor repositories and no conversation/form completion is claimed.

## Arkiv: event/manual/docs/package version mismatch

- Event manual snapshot recommends `@arkiv-network/sdk` 0.7.x; npm resolved current 0.8.1. Current docs homepage advertises Tiramisu chain 7738577, while querying prose contains Braga-era examples.
- Installed 0.8.1 `src/query/queryResult.ts` says pages are immutable. `next()` returns the next page. A current querying-page example calls `await result.next()` and then prints the same `result.entities`. Following this literally repeats the first page; in a loop it can fail to terminate.
- Reproduce: query enough entities for at least two pages, retain `const page`, call `await page.next()`, inspect `page.entities`. EXIT's regression uses immutable pages and confirms the highest offer on page two is included.
- Workaround: `let page = await query.fetch(); ... page = await page.next()`. No sorting before all pages arrive.
- Mutation parameters also changed: 0.8.1 uses `expires: ExpirationTime.fromSeconds(...)` and attribute objects. Earlier `expiresIn`/attribute-array examples are incompatible.
- Live outcome: real Tiramisu compound EXIT query succeeded at block 318199, returned 0 entities. No fake results substituted. Mutation/native expiry are unrun: no funded Arkiv signing account configured.
- [Query docs](https://docs.arkiv.network/typescript-sdk/querying-data/), [installed SDK source upstream](https://github.com/Arkiv-Network/arkiv-sdk-js).

## Arkiv: live event guidance changed

`https://hub.arkiv.network/ethrome` is now HTTP 200 and contains a [submission form](https://tally.so/r/vGZ98v), Tiramisu websocket reference, EUR-denominated bounty descriptions and weights 30% why Arkiv / 25% technical / 20% usefulness / 25% feedback. Earlier handoff/manual says dollars and a different scoring breakdown. Preserve the handoff and use the current event page when preparing sponsor submission. Human conversation remains unverified. This observation is guidance drift, not a claimed SDK defect.

## Swarm: connectivity does not establish upload authority

Public `https://api.gateway.ethswarm.org/health` returned HTTP 200. No upload URL or funded postage batch was configured, so the upload probe reports blocked before sending data. No fixture or local Bee is counted as a public Swarm integration. The official event manual promises gift codes collected from the on-site desk; obtaining/redeeming one is still external work. [Swarm ID quick start](https://swarm.snaha.net/docs/getting-started/), [Bee API](https://docs.ethswarm.org/api/).

EXIT uses the ordinary-byte Bee API because its client encryption boundary is explicit. A full native encrypted reference contains a decryption key and must not be published to Arkiv. A 128-character reference returned by a misconfigured gateway is rejected. Independent retrieval uses a separately configurable gateway and authenticates signed content. This is a documented design boundary, not a sponsor bug.

## HPKE non-extractable key compatibility

Local native WebCrypto + `@hpke/core@1.9.0` probe intermittently failed with `recipientKey: privateKey`. Source inspection found fallback public-key reconstruction picks even Y after private JWK export fails; half of original public keys can have the other parity. Passing the full key pair fixes the mismatch without making the private key extractable. Regression tests exercise actual HPKE encryption/decryption and key loss. No audit claim or externally reported issue is implied.
