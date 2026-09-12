# Cutout acceptance evidence — 12 September 2026

Public app: https://cutout-ethrome-2026.vercel.app · immediate walkthrough: `?view=demo`.

- `deployment.json` and `build.json`: actual final Vercel deployment and public artifact hashes, using the existing Fuji contracts. Fonts include their original licenses in source.
- `cutout-domain/browser.json` and screenshots: actual fresh Chromium on the public Cutout hostname. Client/reviewer navigation, live form preview, in-flow official Swarm account iframe, drag/keyboard AES-GCM roundtrip, explicit simulated payment,390px layout, and unavailable-config fallback. No signed-in Vercel context/bypass, wallet transaction or Swarm upload.
- `hosted/`: earlier passing production check on the preserved Review Pass hostname during this design pass. It predates the small inline-style CSP correction. Public testnet lifecycle is not claimed.
- `local-lifecycle/browser.json`:21checks against fresh local Anvil contracts and local Bee, including two wallet-separated clients, browser-generated ZKproof acceptance, encryption/recovery/revocation/payment and approval disabled until successful decryption. This is real local-chain execution, not a Fuji lifecycle.
- Targeted unit checks:22passed,1optional external browser case skipped. Pilot TypeScript and active bundle build passed. Both GitHub workflows passed application revision9b8db9e;Follow-ups move storage layout styling into the stylesheet for production CSP, refresh reviewer empty-state copy on role change, and keep the demo simulation disclosure visible on mobile.

## Problems found and corrected

The first layout exposed the client form in reviewer mode because an ID-specific grid rule overrode role visibility. The role boundary now wins and browser regression checks it. An early screenshot harness waited on a stale local API process; a separate18903 preview was used. The walkthrough amount assertion initially expected trailing zero formatting; the actual numeric amount was correct and the assertion was corrected.

A manually assigned Cutout alias initially redirected unauthenticated visitors to Vercel SSO. Root's new-domain check and independent review caught this. Registering the hostname as an actual verified project production domain made it public while retaining preview protection; the subsequent production deploy automatically assigned Cutout. A console probe caught one CSP-rejected inline layout style, now in the stylesheet. The final browser verifier rejects app CSP violations.

## Remaining product gates

The walkthrough deliberately simulates qualification, funding and payment, while genuinely encrypting/decrypting report text in browser memory. It does not count as sponsor evidence. Actual public credential proof generation has separate earlier hosted verification. The funded Fuji client/reviewer lifecycle and actual Arkiv creation/native expiry remain unexecuted. Live Swarm needs account authentication and usable storage; users are not asked to paste technical IDs or signing keys. Original registered browser keys remain on the original hostname and were not migrated or reset.

## Independent public review

A separate agent used fresh Chromium on the Cutout domain, completed all six steps on1440px/390px with an edited42demoUSDC budget and custom report, rejected invalid example credentials, decrypted exact text, verified simulated settlement labels and returned to the live workspace. No JavaScript exceptions or overflow. It found the initial domain SSO block, stale reviewer empty-state copy and hidden mobile explanation; these were corrected and added to root verification. It also observed a stale Arkiv connection: no live opportunity or funded discovery is claimed.
