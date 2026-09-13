# Swarm — documents with recipient privacy

[All bounties](../BOUNTIES.md) · [Security](../SECURITY.md) · [Evidence](../EVIDENCE.md)

**Swarm carries the actual review documents.** Public scopes and whole issuer status snapshots are readable. Reports are encrypted in the browser for their intended recipients before upload. Fuji commits the document reference and digest; Swarm supplies the retrievable bytes. This makes a delivered report independently addressable and verifiable beyond a Deaddrop-hosted file URL, subject to network retention and recipient key availability.

## Integration

1. Read and authenticate the client/reviewer public report-key bindings from Fuji.
2. Generate a content key; encrypt the report using AES-GCM.
3. HPKE-wrap the content key separately for each intended recipient and bind the envelope to the task.
4. Upload the envelope through Bee HTTP at `api.gateway.ethswarm.org/bytes`.
5. Separately retrieve the returned content reference and compare SHA-256 before submitting delivery on Fuji.
6. The recipient later retrieves bytes, checks the onchain digest and decrypts locally.

Public references are normal 64-hex content references. We do not publish a native encrypted Swarm reference carrying a decryption key as though it were safe public metadata.

## No customer storage setup

The active adapter uses the [official gateway upload path](https://github.com/ethersphere/bee-js#upload-via-swarm-gateway). The gateway supplies postage; the browser sends the zero-stamp placeholder. No customer account, drive, recovery phrase or gift signer is required. This is not consumption of the team's Swarm ID gift drive.

Swarm ID remains an [optional adapter](../../../experiments/qualification/pilot/swarm-id.ts), with its provenance preserved. It is optional in the [supplied sponsor brief](../../review-pass/supplied-bounties.txt). The active product already has wallet authorization and recipient report keys, so an extra identity account is not required.

## Code and evidence

| What | Source / artifact |
| --- | --- |
| Public gateway, bounded uploads/retrieval and digest verification | [swarm-gateway.ts](../../../experiments/qualification/pilot/swarm-gateway.ts) |
| Recipient encryption and persistent device keys | [keys.ts](../../../experiments/qualification/pilot/keys.ts) |
| Public scope encoding and authenticated terms | [terms.ts](../../../experiments/qualification/pilot/terms.ts) |
| Task-authoritative document retrieval | [Hosting read API](../../../experiments/qualification/pilot/hosting) |
| Real ciphertext round trip and both-recipient decryption | [Account-free storage evidence](../../design/cutout/evidence/account-free-storage/README.md) |
| Public whole snapshot | [Current read endpoint](https://cutout-ethrome-2026.vercel.app/api/snapshot) |

A generated 1,625-byte recipient-encrypted report was actually uploaded to public Swarm and separately retrieved. Both test recipients recovered exact Unicode text; reload preserved the key; an unrelated browser could retrieve ciphertext but not decrypt. Production-origin CORS/CSP upload checks also passed. Those earlier tests used generated test document bindings. The subsequent [public task #4 lifecycle](../evidence/saved-pass/README.md) uploaded a 1,739-byte encrypted report, committed it on Fuji, recovered exact plaintext in the client browser and settled payment. [Finalized delivery, reference, digest and independent retrieval](../evidence/saved-pass/finalized-payment.json).

## Show the judges

Seal a recognizable non-sensitive report, show its content reference and successful retrieval check, and open it from the client's original browser. Compare the plaintext exactly and demonstrate an unrelated browser cannot decrypt. Then show the Fuji delivery commitment and payment receipts for the same task. Public task #4 provides a completed example.

Separate retrieval verifies availability and integrity at that time; the current upload and retrieval paths use the same gateway operator. Temporary gateway storage has unspecified retention and service limits. Deaddrop offers local report export. Our production next step is an operator-funded gateway with a stated retention policy, followed by a real review pilot. We do not claim permanent storage or independent gateway operators.
