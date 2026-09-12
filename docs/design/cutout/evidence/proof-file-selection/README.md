# Proof-file selection and teammate issuance

12 September2026. Application source83e18e0, deployment in `deployment.json`.

The task proof form now identifies the issued credential versus the holder backup, explains that the enrollment request is not either proof input, and links directly to enrollment help. Disconnected file controls have a nearby reviewer-wallet reconnect action. That action respects the current operation's busy state; the first test exposed an ignored click during task refresh, which was corrected before deployment.

Local validation rejects enrollment requests, swapped files, mismatched holder commitments, invalid file formats, wrong class and expired credentials. The generation button remains disabled until both selected files match locally. These are preliminary checks, not signature verification or accreditation. The existing browser prover and contract simulation remain authoritative. Files are not uploaded; wallet changes clear their controls.

Six focused tests pass (two proof-file scenarios including negative cases, three enrollment-request tests, one holder-worker validation/cancellation suite), along with targeted pilot TypeScript and the public-only hosting build. `local.json` records actual Chromium native file-picker behavior and a real browser proof using the operator's existing private files, accepted by an eth_call simulation against funded Fuji task#3. There was no acceptance transaction, report delivery or payment.

Separately, the user supplied their teammate's public enrollment request. The existing test issuer actually issued a credential using only its commitment. Private output was validated against the request and checked mode0600; it expires2026-09-13T17:58:21Z. A local download link was returned to the user for private delivery. The teammate's holder secret was never received, and their own proof/acceptance has not been run here. No credential, enrollment commitment or holder backup is included in this evidence directory.

The browser harness is retained in ignored `.runtime/cutout-proof-files/probe.mjs`; it uses current public eligible listings, locally held operator files and a synthetic read-only wallet provider. It forbids signing and transactions. The first attempt had an overbroad role selector matching the body and button; that harness issue was corrected before the recorded passes.

Final production HTTPS run also passed all five checks with no API/prover interception, zero page errors and zero signatures/transactions. Actual app file selection, deployed worker and funded-task acceptance simulation all passed (`production.json`). The wallet provider itself remains synthetic/read-only; this is not teammate wallet testing.
