# Public Swarm integration review

Read-only review of the integrator's uncommitted public-mode integration on 12 September 2026. Repository HEAD was `ccd10426f1ce351ca45998a47181d4f9ef173ed5`; the reviewed files include changes beyond that commit. The source identities below define the review precisely. This is an independent integration review, not an audit or a claim that public uploads ran.

| Reviewed source | SHA-256 |
|---|---|
| `experiments/qualification/pilot/start.mjs` | `720bd0de36533349ff7417ce55a6328a129d0a3db52f0f54414f8be7319b1789` |
| `experiments/qualification/pilot/web/main.ts` | `888a99d89d7b9861921be9c9781d320a1f9d64942feb5bf7de3deec278b3ef81` |
| `experiments/qualification/pilot/swarm-id.ts` | `fb80674e1f5ce715b5751822cffd7828691467a73b0ac0314d2f398fdd4b059a` |

## Findings requiring correction

### RP-SWARM-01 — Medium: public submission does not revalidate recipient bindings

The `submit` action reads client and worker key bindings, encrypts the review, awaits public Swarm upload and immediately calls `submitDocument`. The local upload endpoint rechecks current key bindings; the public Swarm ID branch bypasses that check. If a recipient rotates or revokes its key while the upload is pending, the newly committed review still targets the older binding. For a compromised revoked key, confidentiality remains with the old key holder; for a client that lost the old key, delivery may be unreadable.

A bounded executable probe extracted the actual reviewed `case "submit"` control flow and supplied stubbed crypto/storage functions. The storage stub advanced the current registry version from1 to2 during `upload()`. The action completed, performed only the two original key reads and called `submitDocument`. No live transaction or upload was attempted. This tests the missing state revalidation, not the cryptography.

Recommended correction: capture both exact bindings and compare fresh onchain public key, version and expiry immediately before external upload and again before requesting the submission transaction. Reject changes and explain that the already uploaded ciphertext was not submitted. A final RPC check cannot eliminate a rotation occurring later in the mempool; full transaction-time enforcement would require binding versions or key hashes in the contract interface. Do not claim that an application check provides that stronger property.

### RP-SWARM-02 — Low: public scope upload starts before wallet-session revalidation

The create action captures the client account, awaits key and block reads, builds public terms and calls `publicStorage.upload()` before checking that the wallet generation is unchanged. A wallet switch during the earlier reads can therefore upload a scope for the stale account and consume the connected storage identity's postage, even though the later generation check prevents funding. There is no observed unauthorized settlement or private report disclosure from this trace: scope requires an explicit public-data checkbox.

Recommended correction: validate the captured generation and owner immediately before either public upload or wallet signing, and retain the existing checks before approval and funding. A failed operation should distinguish “not uploaded” from “scope uploaded but not funded.”

### RP-SWARM-03 — Medium availability: inconsistent retrieval URL precedence

The server's public store and CSP select `swarm.retrievalUrl ?? swarm.downloadUrl`, while `/api/config` emits `gatewayUrl: swarm.downloadUrl ?? swarm.retrievalUrl`. If both fields are present with different origins, server terms/snapshot retrieval uses one gateway and the browser uses another that its CSP may not allow. The canonical Fuji deployment manifest currently emits only `retrievalUrl`, so that specific generated configuration avoids the problem; legacy or hand-authored dual-field configurations do not.

Recommended correction: normalize a single retrieval URL once during configuration validation and use it for the server store, public config and CSP. Reject ambiguous dual values or document an explicit precedence. Keep independent retrieval separate from the uploader's identity capability.

## Positive boundaries observed

The public upload path encrypts the review in the application before passing its bytes to Swarm ID. Qualification credentials, holder secrets and device private keys are not passed into that transport. The client/worker bindings come from the configured onchain registry, while the assigned worker commits the reference and exact envelope digest through its payment wallet. Browser storage identity and payment authority remain separate; connecting Swarm ID alone does not grant transaction authority.

Public report retrieval uses the independent native-fetch adapter without storage sign-in. It validates the onchain SHA-256 digest, and the UI checks the parsed envelope against that digest again before decryption. Wallet account/network/disconnect events clear private views and invalidate asynchronous operations through generation checks. The retrieval action checks its generation before rendering plaintext. Exported encrypted reports contain public context and ciphertext; decrypted export requires an intended recipient account and an already decrypted view.

The server's public mode has no active Swarm ID signer or initialization call: using the transport's download-only method in Node does not import the browser SDK. `/api/upload` rejects the Swarm ID mode, while the terms endpoint allows writes only in explicitly local-pilot mode. The API projects public fields rather than exposing the complete deployment manifest or local setup path. The Arkiv object is passed through as supplied; deployment configuration must contain public RPC/WS metadata only, not signer material or secret API credentials.

The fresh-root comparison on `/api/snapshot` fails closed if the configured whole snapshot differs from the current escrow root. That does not update the snapshot pointer automatically or compel timely issuer publication; an issuer must still publish and configure its current snapshot. Scope records are canonicalized and verified against funded terms before display or listing admission.

## CSP probe and compatibility

A separate ephemeral local HTTP page served the current vendored adapter under the same source CSP pattern, with Fuji RPC, Arkiv HTTP/WSS and configured Swarm gateway origins. Actual clean Chromium successfully loaded the adapter and initialized the canonical `https://swarm-id.snaha.net` iframe. Observed state was `connected=false`, `canUpload=false`, `mode=unavailable`, `reason=not-connected`. The probe observed **zero CSP violations**. It made no connection/account creation, upload, gift redemption or storage payment.

The browser on port18889 was known to contain an older build. It was not used to claim verification of the latest application source. The isolated CSP probe establishes initialization compatibility only; it does not establish the actual public application walkthrough, passkey flow, wallet popup, signed upload or cross-device recovery.

Server configuration still intentionally binds only loopback ports18888/18889 and rejects other Host headers. It is runnable as a local frontend connected to public testnets, not a publicly hosted website. Hosting requires a separate deliberate origin/CSP/deployment configuration rather than merely naming the chain public. The existing network-config example also predates the new `storageMode` field; public run instructions should point to a generated compatible manifest or update the example explicitly.

## Recommended acceptance before a public-demo claim

1. Close RP-SWARM-01–03 and rerun the wallet-switch/key-rotation negative cases against the integrated UI.
2. Verify canonical Swarm ID initialization under the actual rebuilt app CSP, not just this adapter probe.
3. Use an explicitly authorized human storage session and usable postage for a real ciphertext upload; retrieve through the normalized independent gateway and compare the onchain digest.
4. Confirm an unrelated client cannot decrypt and that the intended client can decrypt after reload; retain a transaction-linked encrypted export.
5. Record funding, scope publication, upload and submission as separate states so a failed later step does not erase knowledge of earlier external effects.

No critical or high-severity unauthorized-funds trace was found in this bounded pass. The medium findings affect recipient-key freshness and configuration reliability. Fixes belong to the integrator; this report does not mark them closed merely because they were communicated.
