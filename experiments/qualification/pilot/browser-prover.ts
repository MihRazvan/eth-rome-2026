import { bytesToHex, sha256 } from "viem";

export type ProverManifest = {
  version: 1;
  verifier: string;
  files: { name: string; bytes: number; sha256: string }[];
};
/** Private request is sent only to a dedicated local worker, never fetch(). */
export async function proveInBrowser(
  manifest: ProverManifest,
  request: unknown,
  options: { signal: AbortSignal; onProgress(message: string): void },
) {
  const names = ["circuit.r1cs", "proving.key", "verifying.key"];
  if (
    manifest.version !== 1 ||
    names.some((name) => !manifest.files.find((x) => x.name === name))
  )
    throw Error("Public prover setup is unavailable");
  let worker: Worker | undefined;
  const abort = () => worker?.terminate();
  options.signal.addEventListener("abort", abort, { once: true });
  const check = () => {
    if (options.signal.aborted)
      throw Error("Proof generation cancelled; no transaction was sent");
  };
  try {
    check();
    options.onProgress(
      "Loading public proof parameters. Your private pass stays in this browser.",
    );
    const setup = await Promise.all(
      names.map(async (name) => {
        const expected = manifest.files.find((x) => x.name === name)!;
        if (
          !Number.isInteger(expected.bytes) ||
          expected.bytes <= 0 ||
          expected.bytes > 32 * 1024 * 1024 ||
          !/^0x[0-9a-f]{64}$/.test(expected.sha256)
        )
          throw Error("Invalid public setup manifest");
        const response = await fetch(`/prover/${name}`, {
          signal: options.signal,
          credentials: "omit",
          redirect: "error",
        });
        if (!response.ok || !response.body)
          throw Error("Public proof parameters could not be retrieved");
        const reader = response.body.getReader(),
          chunks: Uint8Array[] = [];
        let length = 0;
        try {
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            length += part.value.length;
            if (length > expected.bytes)
              throw Error("Public setup size differs from manifest");
            chunks.push(part.value);
          }
        } finally {
          await reader.cancel();
          reader.releaseLock();
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        if (
          length !== expected.bytes ||
          sha256(bytesToHex(bytes)) !== expected.sha256
        )
          throw Error("Public setup integrity check failed");
        return bytes.buffer;
      }),
    );
    check();
    worker = new Worker("/prover/worker.js");
    const call = (action: string, payload: object) =>
      new Promise<any>((resolve, reject) => {
        const id = crypto.randomUUID();
        let finished = false;
        const done = (error?: Error, result?: unknown) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          options.signal.removeEventListener("abort", cancel);
          worker?.removeEventListener("message", message);
          worker?.removeEventListener("error", failed);
          error ? reject(error) : resolve(result);
        };
        const cancel = () =>
          done(Error("Proof generation cancelled; no transaction was sent"));
        const failed = () =>
          done(
            Error(
              "Browser prover could not run. Try a current desktop browser.",
            ),
          );
        const message = (event: MessageEvent) => {
          if (event.data?.id !== id) return;
          const r = event.data.result;
          if (!r || r.error)
            done(
              Error(
                "The proof could not be generated. Check the credential, holder file, current snapshot and task deadline.",
              ),
            );
          else done(undefined, r);
        };
        const timer = setTimeout(
          () =>
            done(Error("Proof generation timed out; no transaction was sent")),
          120_000,
        );
        options.signal.addEventListener("abort", cancel, { once: true });
        worker!.addEventListener("message", message);
        worker!.addEventListener("error", failed);
        if (options.signal.aborted) return cancel();
        worker!.postMessage({ id, action, ...payload });
      });
    options.onProgress(
      "Preparing the local prover. The first load can take about 20 seconds.",
    );
    await call("initialize", { setup });
    check();
    options.onProgress(
      "Generating your task-specific qualification proof in this browser…",
    );
    const proof = await call("prove", { request });
    check();
    if (
      !/^0x[0-9a-f]{512}$/i.test(proof.proof) ||
      !Array.isArray(proof.publicInputs) ||
      proof.publicInputs.length !== 9 ||
      proof.publicInputs.some(
        (x: unknown) => typeof x !== "string" || !/^[0-9]+$/.test(x),
      )
    )
      throw Error("Browser prover returned an invalid presentation");
    return { proof: proof.proof, publicInputs: proof.publicInputs };
  } finally {
    worker?.terminate();
    options.signal.removeEventListener("abort", abort);
    // Dropping references/terminating a worker is not a guarantee of zeroized JS/Go memory.
  }
}
