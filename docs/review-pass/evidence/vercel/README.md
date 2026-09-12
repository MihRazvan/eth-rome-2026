# Vercel public setup deployment

[Open Review Pass](https://review-pass-ethrome-2026.vercel.app). Actual deployment dpl_EbMq4HGKTAWwhyEegRiycqzGjiHw, application source69de065. This URL is publicly reachable without a Vercel login. It is explicitly a setup deployment while public contracts and Swarm publication are pending.

The page explains both roles, initializes the real Swarm ID iframe and enables sign-in. Its public test upload remains unavailable until a signed-in account has usable storage credit. No authenticated upload or financial lifecycle was run for this deployment. A user-triggered test upload will use real public bytes and verify independent retrieval; no sample receipt is displayed.

Evidence: [deployment metadata](deployment.json), [22-file public build inventory](build.json), [actual HTTPS Chromium checks](browser.json), [desktop](desktop.png), [390px mobile](mobile.png).

Executed checks:

- Actual production alias: HTTP200 for home and public configuration,503 for unpublished snapshot,405 for POST upload,404 for private/unknown paths.
- Fresh unauthenticated Chromium: both role explanations, real Swarm iframe initialization, gated upload, delivered CSP, no horizontal overflow at390px and zero page exceptions.
- Read-only API suite:9tests passed. Finalized-block pinning/recheck, SHA integrity, stale root, economics, timeout, method/query bounds and sanitized failures use explicit mocked dependencies; these are not live sponsor writes.
- Pending build completed; deliberately supplying the local Anvil manifest to active mode was rejected before replacing the existing output.
- Full explicit TypeScript checks passed. Both CI workflows passed at69de065; [exact run IDs and scope](ci.json).

Independent review found that Vite would otherwise read the checkout's.env during SSR bundling. Before deployment, both build calls were changed to envDir:false and publicDir:false; a dedicated public env prefix is used. The build copies only named public setup/WASM files for active mode, projects only reviewed public config fields and refuses local endpoints. The actual pending deployment uploaded22generated files; no runtime directories or secret environment files were included. No secret value exposure was observed.

Vercel CLI59.11.7 auto-connected Git while creating the separate project. That connection was explicitly removed so repository pushes cannot rebuild the root EXIT configuration into this app. Deployments use only the isolated prebuilt directory. The old EXIT project and unrelated projects remain unchanged.

[Build, activate and redeploy instructions](../../../../experiments/qualification/pilot/hosting/README.md). Active Fuji mode checks finalized runtime code hashes and authorities, public snapshot availability and setup integrity before packaging. It remains unexecuted against a real public manifest until those resources exist. The hosted function has no signer, filesystem manifest, secret key or mutation endpoint. Swarm recovery phrases remain with their owner.

A [separate full-workspace bootstrap smoke test](active-boot.json) paired the new frontend with the existing local Anvil/Bee API through an explicit read-only test bridge. The real funded local task and verified scope rendered, and missing-wallet help worked. The initial harness synthesized the main HTTP response and Chromium denied loopback RPC access; serving the document normally from the local preview with local-only CSP resolved that harness issue. No production CSP was weakened. This does not claim an active Fuji deployment.
