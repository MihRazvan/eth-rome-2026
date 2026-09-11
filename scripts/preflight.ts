/** Read-only: keys derive public addresses locally; no transaction or publication capability. */
import { readFile } from "node:fs/promises";
import { runPreflight } from "../packages/runtime/preflight";
let manifest: unknown;
try {
  manifest = JSON.parse(
    await readFile(
      process.env.EXIT_DEPLOYMENT || "deployments/fuji.json",
      "utf8",
    ),
  );
} catch {
  /* Report a fixed unavailable-manifest check; never print path or parser payload. */
}
try {
  const result = await runPreflight(process.env, manifest);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === "blocked" ? 1 : 2;
} catch {
  console.log(
    JSON.stringify({
      mode: "read-only-live-preflight",
      status: "blocked",
      detail: "Preflight failed unexpectedly; diagnostic input withheld.",
    }),
  );
  process.exitCode = 1;
}
