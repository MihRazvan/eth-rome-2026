# Review Pass on Vercel

The local long-running server is not uploaded. Build Output API v3 packages the frontend as static files and an independently bundled Node24 read-only function. Browser proving, wallets and Swarm ID uploads stay in the user's browser. This deployment never needs a wallet private key, issuer secret, holder file, recovery phrase or server upload endpoint.

## Build and deploy

From the repository root with the pinned npm dependencies installed:

```sh
# Explicit honest setup screen while public contracts/storage are pending.
node experiments/qualification/pilot/hosting/build.mjs --pending

# When an actual Fuji manifest and matching public artifacts exist:
node experiments/qualification/pilot/hosting/build.mjs --config .runtime/review-pass-fuji/deployment.json

# Only the isolated build directory is the Vercel project root.
vercel link --yes --project review-pass-ethrome-2026 --scope mihrazvans-projects --cwd .runtime/review-pass-vercel
# First link can auto-connect the repository. Disconnect this NEW project
# to prevent the root EXIT build from replacing it; confirm the CLI prompt.
vercel git disconnect --cwd .runtime/review-pass-vercel --scope mihrazvans-projects
vercel deploy --prebuilt --prod --cwd .runtime/review-pass-vercel --scope mihrazvans-projects
```

The existing linked staging directory can be redeployed directly; do not repeat linking on every build.

Do not run the deployment from the repository root: its root vercel.json serves the preserved EXIT project. The separate project leaves that application and teammate projects untouched. Vercel authentication is the existing CLI login; the Fuji deployer key remains local in the Git-ignored .env. No secret is required in Vercel environment variables. The build does not read .env.

The active build refuses local-chain manifests, custom/private endpoints, missing deployment hashes, unmatched finalized bytecode/escrow authorities, a stale public snapshot and mismatched setup hashes. It extracts only an explicit public projection. Prover binaries and matching public setup are copied by filename allowlist; private runtime directories are never copied. An inventory with byte hashes is saved outside deployment output as build-evidence.json. The build's output is .runtime/review-pass-vercel/.vercel/output; it is not tracked in Git. A pending build is explicit and is never a fallback when an active build fails.

The public setup page explains both user roles and enables real Swarm ID sign-in. After storage credit is active, an explicit click can upload a generated public test note and verify independent retrieval. It never offers financial transactions or claims a public funded workflow. Once the active manifest is available, rebuild and redeploy to activate the existing workspace at the same origin. First-time reviewer enrollment remains separate.

## HTTP and deployment boundaries

- GET /api/config exposes reviewed public configuration and explicit pending/active status.
- GET /api/snapshot downloads the whole snapshot and compares the root with finalized escrow state.
- GET /api/terms?job= and /api/document?job= derive locator/digest from the configured escrow, retrieve independently and authenticate bytes. Related chain reads share one finalized block and recheck its canonical hash.
- Mutation methods return405; pending data reads return503. No server signs or uploads.
- Vercel function duration60seconds; internal read deadline40seconds. Responses are bounded below the platform4.5MB response limit. No in-memory upload quota or long-running WebSocket server is hosted.
- Arkiv WSS runs directly in the browser. Fixed public origins are permitted by CSP. The worker response alone permits wasm-unsafe-eval; general script unsafe-eval is not enabled.
- Unknown/private paths return404. CDN config/data caching is disabled so issuer state is rechecked. Static assets are deployment-specific.

The current active-manifest promotion path cannot be declared live until the Fuji deployment and public snapshot exist. Mocked API tests prove handling, not public sponsor completion. Deployment verification must open the public HTTPS URL without a Vercel login and check status, API routes, CSP, mobile layout and actual Swarm connection initialization. A signed-in storage test still requires the participant's browser and credit.

## References checked

- https://vercel.com/docs/build-output-api/primitives
- https://vercel.com/docs/build-output-api/configuration
- https://vercel.com/docs/cli/deploy
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- https://vercel.com/docs/functions/limitations

Vercel CLI59.11.7 and Node24.12.0 were available locally. No framework/dependency change was needed.

## Reviewed snapshot publication before activation

The pending build validates `hosting/publication/issuer-public.json` and `snapshot.json` through the Go public-metadata validator and serves only those two explicit public files. It exposes an exact byte hash/length/root manifest and an explicit browser publication button. No private registry or credential is copied. A connected participant spends their Swarm postage to upload the whole reviewed snapshot; independent retrieval is required and its public reference can be shared with the operator.

Contracts may be deployed first with `deploy-fuji.mjs --broadcast-contracts` using a validated local public snapshot and no reference. This writes `snapshotPublication: pending`; contracts are publicly callable but the funded workspace remains disabled. The normal `--broadcast` still requires verified prior Swarm publication. After a participant publishes, run:

```sh
node experiments/qualification/pilot/publish-snapshot.mjs <64-hex-public-reference>
node experiments/qualification/pilot/hosting/build.mjs --config .runtime/review-pass-fuji/deployment.json
vercel deploy --prebuilt --prod --cwd .runtime/review-pass-vercel --scope mihrazvans-projects
```

Publication finalization checks the exact original byte digest, public issuer key and current finalized onchain root before recording the reference. Active hosting again checks public retrieval, code hashes and authorities. It never promotes an unpublished snapshot implicitly.

This pilot uses the project deployer as both issuer root authority and explicitly trusted arbitrator, with separate client and reviewer wallets. This is a team-administered experiment, not independent arbitration or external professional accreditation.
