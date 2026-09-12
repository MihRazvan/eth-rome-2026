# Review Pass pilot implementation boundary

Authorized by the user's “Lets do it” after the feasibility result. Preserve the original workbench and all EXIT/REPRISE history. This milestone makes separate wallet/device roles, recipient document delivery and public-network preparation usable. It does not invent issuer/client adoption or authorize outreach to third parties.

## Shared interfaces

- The existing QualificationEscrow proof/payment ABI is preserved. A separate QualificationKeys contract lets each wallet register or revoke its current P-256 encryption public key. Registry record: `(bytes publicKey, uint64 expiresAt, uint64 version)`, mapping getter `keys(address)`, actions `register(bytes,uint64)`, `revoke()`. Version increments on both. Public key is 65-byte uncompressed P-256; validate actual curve import in the client, not merely byte length. Expiry is enforced when encrypting. Old plaintext cannot be recalled.
- Browser key binding: `{owner:0xaddress, publicKey:0xhex, version:string, expiresAt:number}`. Context: `{chainId:number, escrow:0xaddress, jobId:string, purpose:'review-result', version:1}`. Key module accepts current bindings obtained from the configured chain/registry by the integration client. Never accept an unverified replacement directory key.
- Key module owns `loadOrCreateDeviceKey(namespace)`, `getDevicePublicKey(device)`, `encryptForRecipients(bytes, context, bindings)`, `decryptForRecipient(envelope, context, owner, device)`. Nonextractable private CryptoKeys persist in IndexedDB; fresh contexts/devices do not share a private key. HPKE P-256/HKDF-SHA256/AES-256-GCM can wrap a fresh content key for each recipient. Envelope contains ciphertext/key wraps/public recipient identifiers, never plaintext content keys or private keys. Context authenticates every wrap. Old device keys may decrypt previous documents after rotation; new encryption must use current onchain bindings.
- The pilot frontend signs escrow/key-registry transactions through an injected EIP-1193 wallet. No server endpoint impersonates worker/client/arbitrator. Local automated tests inject distinct explicitly public test wallets into isolated browser contexts. Real wallet connectivity remains distinguishable from that harness.
- Proving stays in a holder-local CLI. The public pilot accepts only proof JSON with its nine public inputs, never a witness, credential file or holder secret. A copied CLI command exports a presentation for the exact job/recipient/deadline. Enrollment and public deployments are separate flows, not generic server-side prove buttons.
- Public chain/storage configuration is explicit and fails closed. Local pilot may use the existing dedicated Anvil/Bee stack, visibly labeled. Deployment preflight reports availability without exposing keys or creating identities in third-party services.

## Ownership from this shared base

Integrator: pilot frontend/server/build, registry Solidity, root configuration, deployment manifests, integration, CI and pushes.
Key worker: only `pilot/keys.ts`, `pilot/keys.test.ts`, `pilot/KEYS.md`.
Issuer worker: only `prover/issuer_registry.go`, `prover/issuer_registry_test.go`, `prover/ISSUER.md`; propose main.go CLI dispatch changes to integrator first.
Access worker: only `pilot/preflight.mjs`, `pilot/ACCESS.md`, `pilot/access-evidence.json`, `pilot/network-config.example.json`, `pilot/PILOT.md`. No outreach or live writes without configured authorized access.
