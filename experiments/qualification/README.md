# Private qualification feasibility experiment

Authorized September 12, 2026: test whether private qualification can support a real product, prioritizing Arkiv, Swarm and Avalanche. This isolated experiment preserves EXIT and REPRISE. No live integrations or privacy guarantees are assumed from a diagram.

Proposed flow: issuer signs a holder-bound qualification; holder proves its class, unexpired status and non-revocation without revealing credential ID/index; a funded assignment contract binds that proof to its job and payout recipient; client approval releases payment. Revocation blocks new acceptance, not an earned payment obligation. Credential issuers and client acceptance remain explicit trusted roles.

The first implementation is an independently built, EVM-compatible bounded circuit informed by credential-status research. It is not a reproduction of ShadowPath, whose artifact host returned 403 during earlier inspection. Sources, departures, test setup and limitations must be recorded.

Ownership: crypto worker owns `prover/`; transport worker owns `transport/`; product worker owns `research/`. Integrator owns this file, shared interface, contracts, browser application, generated integration artifacts and publication. Keep each experiment's dependencies local. Never touch existing demo ports 5173, 8547 or 8787.
