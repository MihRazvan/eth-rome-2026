# Qualification enrollment and judge rehearsal

Review Pass currently uses an **experimental test issuer and class7**. The proof establishes that this issuer signed a matching, unexpired credential and that its slot is not revoked under the current root. It does not establish review quality, professional accreditation, a named expert's reputation or an external issuer partnership. The issuer decides whom to qualify; demonstrating the mathematics is separate from validating that decision.

Browser proving now accepts two local files and generates the proof in a Web Worker. **First-time holder creation and credential issuance still use the operator/holder CLI workflow below.** The app has no browser enrollment service. A judge with only a wallet cannot manufacture an issuer credential through the UI.

## Roles and artifacts

| Artifact                                       | Who keeps it                            | Where it may go                                                                                                    |
| ---------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `holder.json`, including `holderSecret`        | Holder only                             | Holder's own device and protected backup; select locally in the browser; never send to issuer, server, chat or Git |
| `holderCommitment`                             | Holder shares with issuer               | Enrollment channel; it is not a secret but is a reusable identifier, so keep it out of public task metadata        |
| Signed `credential.json`                       | Issuer delivers privately to its holder | Protected delivery to the intended holder; local browser selection; never public storage or Git                    |
| Issuer private key and allocation state        | Issuer operator                         | Private operator runtime and protected backup; never served by the app                                             |
| `issuer-public.json` and whole `snapshot.json` | Public metadata                         | Published whole snapshot and deployment metadata; no holder-specific lookup URL                                    |
| Task-bound proof and public inputs             | Holder produces; contract verifies      | Acceptance transaction; public proof import is an alternative workflow                                             |

The holder secret is separate from the payment wallet's key and from the browser's report-encryption device key. Losing one cannot be repaired by substituting another. Credential JSON contains an issuer signature and a slot/commitment; its privacy matters even though it contains no holder secret.

## 1. Holder: create a secret locally

On the holder's own machine, build the repository CLI or use a trusted build of the same source. Commands below run from a repository root. They write local files; they do not contact an issuer or make chain transactions.

```sh
umask 077
mkdir -p .runtime/review-pass-enrollment/holder
REVIEW_PASS_PROVER="$PWD/.runtime/review-pass-enrollment/prover"
REVIEW_PASS_HOLDER="$PWD/.runtime/review-pass-enrollment/holder/holder.json"
go -C experiments/qualification/prover build -o "$REVIEW_PASS_PROVER" .
test ! -e "$REVIEW_PASS_HOLDER" && "$REVIEW_PASS_PROVER" holder-new --out "$REVIEW_PASS_HOLDER"
```

If `holder.json` already exists, stop and reuse it; the existence guard intentionally prevents replacing a credential's secret. `holder-new` itself does not provide an exclusive-create guarantee. Run enrollment once at a time. Do not use the repository's deterministic fixture as a private holder identity.

Extract **only the public commitment** into a separate handoff file without printing the secret:

```sh
node --input-type=module - "$REVIEW_PASS_HOLDER" <<'JS'
import { readFile, writeFile } from 'node:fs/promises';
const holderPath = process.argv[2];
const { holderCommitment } = JSON.parse(await readFile(holderPath, 'utf8'));
if (typeof holderCommitment !== 'string' || !/^[1-9][0-9]*$/.test(holderCommitment))
  throw Error('Invalid public holder commitment');
await writeFile(`${holderPath}.commitment.txt`, `${holderCommitment}\n`, { flag: 'wx', mode: 0o600 });
JS
```

Send that `.commitment.txt` file to the intended issuer through the agreed enrollment channel. Keep `holder.json` locally. Re-running extraction refuses to overwrite the handoff file; that is not a reason to regenerate the secret.

## 2. Issuer: qualify and issue class7

The operator must use the **existing registry whose signing public key matches the deployed escrow's immutable `issuerX`/`issuerY`**. Its signing key is different from the EOA authorized to call `setRoot`. Creating a fresh registry does not enroll it into an existing escrow.

For the local rehearsal, the existing registry is normally `.runtime/review-pass-judge/issuer`. Public deployments use their designated private issuer directory; configure that path deliberately. Never reset a registry, recycle revoked indices, or delete its state to repair an error. The registry allocator preserves allocation history across concurrent processes and interrupted issuance.

The operator has its own CLI build. Save the received commitment as `.runtime/review-pass-enrollment/received-commitment.txt`, then run:

```sh
umask 077
mkdir -p .runtime/review-pass-enrollment/delivery
REVIEW_PASS_PROVER="$PWD/.runtime/review-pass-enrollment/prover"
go -C experiments/qualification/prover build -o "$REVIEW_PASS_PROVER" .
REVIEW_PASS_ISSUER_DIR="$PWD/.runtime/review-pass-judge/issuer"
REVIEW_PASS_CREDENTIAL="$PWD/.runtime/review-pass-enrollment/delivery/credential.json"
REVIEW_PASS_COMMITMENT="$(node -e 'const fs=require("node:fs"); const s=fs.readFileSync(process.argv[1],"utf8").trim(); if(!/^[1-9][0-9]*$/.test(s)) throw Error("Invalid commitment"); process.stdout.write(s)' .runtime/review-pass-enrollment/received-commitment.txt)"
REVIEW_PASS_EXPIRY="$(node -p 'Math.floor(Date.now()/1000)+86400')"
"$REVIEW_PASS_PROVER" registry issue --dir "$REVIEW_PASS_ISSUER_DIR" --commitment "$REVIEW_PASS_COMMITMENT" --class 7 --expiry "$REVIEW_PASS_EXPIRY" --out "$REVIEW_PASS_CREDENTIAL"
```

This example gives a one-day test credential. Choose a real expiry appropriate to the rehearsal and compare it with chain time; an Anvil clock advanced by tests can differ from wall time. The CLI requires a positive expiry but does not by itself guarantee it is still in the future. The credential's class must match the task's class. Existing output files are rejected, and a failed issuance can still have reserved a slot: inspect state before deliberately issuing another credential to a new output filename.

For a **new, separately intended issuer before its deployment**, the actual initialization command is:

```sh
"$REVIEW_PASS_PROVER" registry init --dir /absolute/path/to/new-private-issuer-directory
```

That is not a recovery step for an existing deployment. Initialization refuses a nonempty directory.

Deliver `credential.json` privately to the holder using an authenticated protected transfer or direct local transfer for the supervised test. Verify the intended recipient and commitment before sending. This repository does not implement that delivery channel. The operator should never request the holder secret. The holder saves the issued file beside their own `holder.json`; do not put either file in a public screenshot, recording, app upload endpoint or repository.

## 3. Operator: publish and maintain whole issuer state

Generate a whole snapshot from the existing registry, then validate only its public metadata:

```sh
mkdir -p .runtime/review-pass-enrollment/public
REVIEW_PASS_SNAPSHOT="$PWD/.runtime/review-pass-enrollment/public/snapshot.json"
"$REVIEW_PASS_PROVER" registry snapshot --dir "$REVIEW_PASS_ISSUER_DIR" --out "$REVIEW_PASS_SNAPSHOT"
"$REVIEW_PASS_PROVER" validate-public --issuer-public "$REVIEW_PASS_ISSUER_DIR/issuer-public.json" --snapshot "$REVIEW_PASS_SNAPSHOT"
```

`validate-public` checks the issuer point and reconstructs the root from the entire revoked-index set. Its output contains public metadata/hashes, not private registry contents. Issuance allocates a new unrevoked slot; **it does not change the revocation root**. A still-current published snapshot can therefore serve the newly issued credential without a root-update transaction. `registry issue` does not automatically publish a snapshot.

Before handing the browser flow to a judge, the operator checks:

- [ ] The issuer public key matches the deployed escrow and the generated snapshot root matches its current `revocationRoot`.
- [ ] The exact whole snapshot bytes have been uploaded through the configured storage mode: actual local Bee for a local rehearsal, authorized public Swarm postage for Fuji.
- [ ] Independent retrieval returns the exact SHA256; the runtime configuration's `snapshot.reference` and `snapshot.sha256` identify those bytes.
- [ ] After a deliberate runtime configuration update, the owned application server is reloaded to use it; unrelated services remain running.
- [ ] `GET /api/snapshot` succeeds and returns that current whole snapshot. A409 stale-publication error is a blocker, not a reason to bypass root checks.

There is no dedicated snapshot-publication CLI or issuer-control page in this pilot. Storage upload, configuration update and an authorized root transaction remain operator integration steps. Use the existing storage adapters and project deployment access; do not invent a public upload endpoint or put issuer credentials in the web server. The [public deployment runbook](RUNBOOK.md#public-fuji-preparation-and-deployment) specifies the actual deployment command and public snapshot inputs.

For deliberate revocation, the actual local registry command is `registry revoke --dir <existing-directory> --index <allocated-slot>`. It permanently updates the local revocation set and writes the registry's `snapshot.json`. It **does not** send `setRoot` or publish bytes. The configured onchain issuer authority must separately update `setRoot(newRoot)`, wait for the appropriate settlement policy, and publish/configure the matching whole snapshot. Until publication catches up, new browser acceptances should fail. Existing accepted work retains its contract payment rules; revocation does not retrieve old plaintext or cancel those rights.

## 4. Holder: use the browser flow

- [ ] Open the correct Review Pass deployment, connect the intended payment wallet and select the Reviewer role. Verify the configured network and task scope.
- [ ] Register this browser's document-encryption key if required for delivery. This is separate from qualification enrollment.
- [ ] Open an eligible funded task with class7 and an acceptance deadline in the future.
- [ ] Under **Prove qualification in this browser**, select the issuer-delivered file in **Credential JSON** and the holder's own secret file in **Private holder JSON**. Both inputs currently require JSON files below16KB each.
- [ ] Select **Generate qualification proof**. The worker loads the matching public prover artifacts and the whole public issuer snapshot. The files are read locally; they are not sent to the server.
- [ ] Wait for the proof and contract simulation to succeed. The proof's deadline is the minimum of credential expiry, one second before task acceptance closes, and approximately ten minutes after the observed chain time.
- [ ] Review the scope again, then select **Verify proof & accept** and sign with the connected wallet. Proof generation/simulation alone does not reserve the task or complete acceptance.
- [ ] Confirm the actual accepted state/transaction, then deliver the encrypted report and complete the client approval/payment flow.

Cancellation, a wallet change, stale issuer state, expired credential or a competing acceptance can invalidate the prepared flow. Generate a fresh task-bound proof when required. The private inputs are cleared after use and worker cancellation terminates the work; this is not a promise of secure memory erasure or protection from a malicious browser/device. The advanced CLI path imports **public proof JSON only** and must not receive the credential in that public-proof field.

## Local supervised rehearsal and evidence boundary

The local deployment helper maintains an ignored `.runtime/review-pass-judge/holder/latest.json` file containing paths to its current holder/credential files. A local operator can use those paths to select files on their own machine for the supervised manual test. The file is neither an enrollment API nor a public download. Never serve it, publish its referenced files, or offer the public Anvil identity as an independently qualified professional.

The browser suite intentionally revokes its credential and leaves the previously configured snapshot stale. A seeded open task alone does not repair that enrollment. Keep the existing issuer and chain intact; intentionally issue another credential into a fresh slot if appropriate, and ensure the published whole snapshot matches the latest root before another rehearsal.

The public server exposes only explicit public prover artifacts and public API projections; private holder/issuer directories are not exposed. A completed rehearsal should record the source revision, environment, proof/acceptance result and public receipts without credential contents, private files, issuer keys or reusable holder commitments. Public Fuji verification, independent physical-device testing and an actual external issuer remain separate evidence from a local test issuer demonstration.

Source checks for this checklist: [CLI and holder generation](../../experiments/qualification/prover/main.go), [registry commands](../../experiments/qualification/prover/issuer_registry.go), [registry tests](../../experiments/qualification/prover/issuer_registry_test.go), [public validation](../../experiments/qualification/prover/validate_public.go), [browser acceptance](../../experiments/qualification/pilot/web/main.ts), and [server public-artifact allowlist](../../experiments/qualification/pilot/start.mjs). Commands were checked against source; this documentation task performed no enrollment, publication, chain write or private-file inspection.
