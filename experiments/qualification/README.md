# Deaddrop implementation

[Project](../../README.md) · [Architecture](../../docs/deaddrop/ARCHITECTURE.md) · [Quickstart](../../docs/deaddrop/QUICKSTART.md)

This directory contains Deaddrop's deployed qualification, payment and encrypted-delivery implementation. Its path retains the original experiment name so deployment and verification tooling remain compatible.

| Directory | Responsibility |
| --- | --- |
| `pilot/web` | User-facing app, saved reviewer passes and local proof generation |
| `pilot/hosting` | Verified Vercel build, public reads and encrypted application relay |
| `contracts` | Fuji escrow, proof-bound assignment and document-key registry |
| `prover` | Credential issuance, nonrevocation snapshots and Groth16 circuit |
| `browser-probe` | WebAssembly proving worker and reproducible probes |
| `transport` | Storage/discovery adapters and boundary tests |
| `security` | Independent circuit and protocol reviews and executable probes |

Run `npm run check` and `npm run test:browser` from the repository root. The walkthrough's encryption is real; its qualification and settlement are explicitly simulated. [Public-network evidence](../../docs/deaddrop/EVIDENCE.md) records the separate live checks and receipts.

The [security model](../../docs/deaddrop/SECURITY.md) describes issuer trust, setup trust, public wallet linkability and report-key recovery. Nothing in this testnet implementation establishes professional accreditation or guarantees report quality.
