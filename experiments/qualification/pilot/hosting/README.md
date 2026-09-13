# Deaddrop hosting

The [deployment guide](../../../../docs/deaddrop/DEPLOYMENT.md) is authoritative. The existing app hostname is retained because private browser keys are origin-bound.

From the root, `npm run build:hosting` fetches the exact public proving artifacts pinned by the deployment manifest, checks their hashes, compiles the existing contracts and builds the static app plus Vercel Build Output API. It requires Node24.12+, Go1.25.7 and Foundry1.5.1. It does not run a new cryptographic setup, deploy contracts or load issuer/holder secrets.

With the already-configured project access:

```sh
npm run build:hosting
vercel deploy --prebuilt --prod --cwd .runtime/review-pass-vercel --scope mihrazvans-projects
```

The wrapper also prepares `.vercel/output` for standard prebuilt deployment. Do not reconnect automatic Git builds unless that environment has the required Go/Foundry tools. The static `npm run build` output alone is the UI walkthrough; it does not contain the live API.

For another deployment, use `build.mjs --config <verified-public-manifest>` with its matching public setup directory. The builder checks finalized Fuji bytecode and authorities, the whole Swarm snapshot and artifact hashes before enabling financial actions. No fixture fallback is used.

The Node24 function provides bounded public reads. `/api/enrollment` additionally accepts wallet-authorized encrypted applications through a dedicated server-only gas relay; its compatibility environment variable is `CUTOUT_ENROLLMENT_RELAY_KEY`. This is not the issuer signing key. Reports are encrypted and uploaded in the browser using gateway-funded Swarm postage. New issuances are manually reviewed offline.

The optional `--pending` setup mode supports original public snapshot publication; it does not enable funded work. The active deployment and original paid-lifecycle receipts are documented in [evidence](../../../../docs/deaddrop/EVIDENCE.md).
