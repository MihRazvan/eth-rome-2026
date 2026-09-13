# Swarm ID parent client provenance

This is the Swarm ID **0.4.1 browser parent client**, rebuilt from the unmodified source at upstream commit `59c376991b2c4c9962dfec72f6ac84115f393114`. The Apache-2.0 upstream license and distributed dependency notices are preserved in `licenses/`. Cafe-utility33.11.0 provides only an MIT declaration in its distributed package.json, with no separate license/copyright notice; that exact metadata is preserved and the limitation recorded in the manifest. `manifest.json` records source/input hashes, package versions, output SHA-256 and the build lock hash.

The published npm0.4.1 all-exports bundle includes the entire proxy and Axios0.30.3. Changing a root npm override does not change those prebundled bytes. Deaddrop instead builds the `lib/src/swarm-id-client.ts` entry and resolves its Bee-JS imports to **the same pinned Bee-JS11.2.0 typed-bytes primitive module**. Only primitive classes are imported by this entry and its schemas. No upstream source code or protocol message logic is edited. The resulting build metafile must contain **zero Axios inputs**; the rebuild aborts otherwise. This avoids introducing an unused HTTP client into Deaddrop's browser bundle.

Reproduce from the repository root:

```sh
node experiments/qualification/pilot/vendor/swarm-id/rebuild.mjs
REVIEW_PASS_SWARM_LIVE_PROBE=1 node --import tsx --test experiments/qualification/pilot/swarm-id.test.ts
```

The script fetches the exact upstream Git commit and uses `npm ci --ignore-scripts` in a fresh temporary directory. Pinned esbuild0.28.0 performs the browser build; the installed platform binary works without package installation scripts. The isolated build dependency lock still contains dependencies from upstream Bee-JS that are **not included in the output**. This is not a claim that the full upstream dependency tree is vulnerability-free. Root/runtime code does not import those installed packages.

The browser client communicates with the separately hosted, canonical Swarm ID iframe at `https://swarm-id.snaha.net`. That service remains a trust and availability dependency and serves its own code. Rebuilding the parent client cannot patch or audit the remote identity service. Deaddrop keeps qualification secrets and document decryption keys outside that service and uploads only application ciphertext.

Actual verification covers a clean Chromium import and unauthenticated `initialize()` against that service, plus adapter negative-path tests. It does not establish signed-in upload, passkey/wallet recovery, Safari compatibility or public ACT operations. Real upload remains a separate acceptance gate requiring an authorized session and postage.
