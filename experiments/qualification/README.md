# Review Pass — private qualification experiment

Authorized September 12, 2026: test whether private qualification can support a real product, prioritizing Arkiv, Swarm and Avalanche. This isolated experiment preserves EXIT and REPRISE. No live integrations or privacy guarantees are assumed from a diagram.

Proposed flow: issuer signs a holder-bound qualification; holder proves its class, unexpired status and non-revocation without revealing credential ID/index; a funded assignment contract binds that proof to its job and payout recipient; client approval releases payment. Revocation blocks new acceptance, not an earned payment obligation. Credential issuers and client acceptance remain explicit trusted roles.

The first implementation is an independently built, EVM-compatible bounded circuit informed by credential-status research. It is not a reproduction of ShadowPath, whose artifact host returned 403 during earlier inspection. Sources, departures, test setup and limitations must be recorded.

Ownership: crypto worker owns `prover/`; transport worker owns `transport/`; product worker owns `research/`. Integrator owns this file, shared interface, contracts, browser application, generated integration artifacts and publication. Keep each experiment's dependencies local. Never touch existing demo ports 5173, 8547 or 8787.

## Result

**Technically feasible within the tested boundary; commercial demand and public sponsor completion remain unproven.** A real combined proof now verifies on an EVM and gates a funded assignment. The holder reconstructs its hidden status path from a whole issuer snapshot retrieved through local Bee. Browser-encrypted reviews are stored, retrieved through another Bee node and decrypted. Revocation rejects new acceptance without cancelling the client's ability to pay completed work.

The selected product is a portable permission to accept confidential technical reviews from independent clients. This is an application integration, not a new anonymous-credential primitive. Existing AnonCreds/iden3/Semaphore systems are serious alternatives; the [product assessment](research/product.md) describes when the custom workflow is justified and when to stop.

- [Acceptance and exact limitations](ACCEPTANCE.md)
- [Runbook and demo script](RUNBOOK.md)
- [Research and prior art](research/product.md), [22 primary sources](research/sources.json)
- [Independent bounded security review](security/REVIEW.md)
- [Proof encoding and CLI](prover/README.md), [registry scaling and issuance limits](prover/evidence/snapshot-scalability.md)
- [Sponsor transport evidence](transport/evidence.md), [Arkiv schema](transport/schema.md), [friction](transport/friction.md)
- [Implemented reviewer screen](evidence/reviewer-desktop.png), [mobile settlement](evidence/paid-mobile.png), [alternative rendered concept](evidence/quiet-panel-concept.png)

With the experiment's local Bee stack running, start from the repository root:

```sh
node experiments/qualification/runtime/start.mjs
```

Open **http://127.0.0.1:18787**. Startup generates a fresh local test setup, deploys to its own Anvil on18547, runs the actual integration checks, rolls those test transactions back, and seeds one new assignment. It refuses an occupied RPC port. The helper controls all test roles and must stay on this machine; it is not a hosted privacy-preserving prover. Public Fuji deployment is a separate uncompleted gate.
