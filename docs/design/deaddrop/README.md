# Deaddrop visual design

[Documentation](../../README.md) · [Try the app](https://cutout-ethrome-2026.vercel.app) · [Browser evidence](evidence/README.md)

Deaddrop combines a full-screen thermal field with a compact, dark working interface. The [original HTML concept](reference/deaddrop-app-v2.html) supplies the visual direction: an underlined monospace wordmark, ember actions, ice-blue confirmation states and fine dashed boundaries. Its sample users, measurements and transactions are illustrative; the application uses actual task and wallet state.

## Interface

- **Home:** an interactive thermal field and direct entry for clients, reviewers and qualification information.
- **Tasks:** public brief creation for clients; verified opportunities, reward and acceptance deadlines for reviewers.
- **Activity:** funded tasks, proof-bound assignment, encrypted delivery and payment actions.
- **Your workspace:** connection state, saved reviewer pass and optional recovery controls.
- **Who qualifies?:** the actual manual test-issuer flow, without fictional collective accounts or automatic accreditation.
- **Guided demo:** the complete product story with real browser encryption and explicitly simulated settlement.

The thermal field is decorative. Cooling it performs no transaction, cancels no task and changes no credential state. No simulated counter or receipt is presented as public-network evidence.

## Implementation and accessibility

The shader in [thermal.ts](../../../experiments/qualification/pilot/web/thermal.ts) adapts the supplied reference. Animation is capped at 30 fps and a 1200-pixel render width, pauses on hidden tabs and outside Home, and uses a static frame for reduced-motion preferences. A CSS fallback keeps the interface usable without WebGL. Entry actions are immediately available.

Martian Mono and Azeret Mono are self-hosted with their OFL licenses. Archivo supports prose. The implementation includes responsive layouts, visible focus, accessible role/navigation state and a button/keyboard alternative to the report-opening gesture. [Font provenance](../../../experiments/qualification/pilot/web/assets/README.md).

The existing hostname and private browser namespaces are preserved for returning users. Rebranding does not reset credentials, report keys, contracts or encryption formats. [Security and recovery boundaries](../../deaddrop/SECURITY.md).

## Verification

[Replay the browser checks](verify-browser.mjs) against a running app to inspect landing entry, qualification information, live read-only states, desktop/mobile guided encryption and offline fallback. [Dated evidence](evidence/README.md) distinguishes the visual release from the earlier [real paid task](../../deaddrop/evidence/saved-pass/README.md).
