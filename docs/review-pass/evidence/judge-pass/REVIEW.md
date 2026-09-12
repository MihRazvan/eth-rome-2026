# Browser prover integration review

Root integrated on top of `980c172`, 12 September 2026. Independent browser-proving reviewer inspected the worker host, explicit server asset routes, CSP and subsequent UI integration. This is targeted review, not a production security audit.

Findings addressed:

- Public parameter downloads now share the UI's 180-second cancellation deadline. Individual worker calls also have a 120-second bound. Cancellation races public RPCs and terminates the worker; stale wallet sessions cannot install a result.
- Server startup compares the three public setup artifacts with deployment-pinned SHA-256 hashes. Local deployment now pins those hashes too. The UI checks the verifier address and simulates actual escrow acceptance before caching a public presentation.
- Proof validity is bounded by credential expiry, the task acceptance deadline and a ten-minute presentation lifetime. The contract remains authoritative at transaction execution.
- Snapshot and setup streaming are bounded before buffering. Private-file parse and prover errors do not echo file contents.

Only explicit public parameter/WASM/runtime/license paths are served. Credential and holder JSON are read through browser file inputs and sent to a dedicated worker, never an HTTP upload. File selections are cleared, no credential is persisted by the application, and page exit/account/network/disconnect/cancel terminates the worker. JavaScript/Go memory zeroization is not claimed.

The real Chromium lifecycle uses the actual configured local verifier and Bee nodes. It is not a public Fuji or public Swarm transaction. Browser proof acceptance, cancellation and wallet changes were exercised in the 20-check run. Firefox, WebKit and mobile-hardware proving have not been tested. Issuer enrollment and the experimental single-process trusted setup remain explicit limitations.
