/** Private holder backup. Only holderCommitment belongs in an issuer request. */
export type Holder = {
  version: "qualification-v1-test";
  testOnly: true;
  holderSecret: string;
  holderCommitment: string;
};

const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
function validateHolder(value: unknown): Holder {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Browser returned an invalid holder backup");
  const holder = value as Record<string, unknown>;
  if (Object.keys(holder).sort().join(",") !== "holderCommitment,holderSecret,testOnly,version" ||
      holder.version !== "qualification-v1-test" || holder.testOnly !== true ||
      typeof holder.holderSecret !== "string" || !/^[1-9][0-9]{0,74}$/.test(holder.holderSecret) ||
      typeof holder.holderCommitment !== "string" || !/^(0|[1-9][0-9]{0,76})$/.test(holder.holderCommitment) ||
      BigInt(holder.holderSecret) >= 1n << 248n || BigInt(holder.holderCommitment) >= FIELD)
    throw Error("Browser returned an invalid holder backup");
  return holder as Holder;
}

/** No issuer signature, wallet transaction or private network request occurs here. */
export async function createHolderInBrowser(options: {
  signal: AbortSignal;
  onProgress(message: string): void;
}): Promise<Holder> {
  if (options.signal.aborted) throw Error("Holder creation cancelled");
  options.onProgress("Preparing your private reviewer pass…");
  const worker = new Worker("/prover/worker.js");
  try {
    return await new Promise<Holder>((resolve, reject) => {
      const id = crypto.randomUUID();
      let finished = false;
      const done = (error?: Error, holder?: Holder) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        options.signal.removeEventListener("abort", cancel);
        worker.removeEventListener("message", receive);
        worker.removeEventListener("error", failed);
        worker.removeEventListener("messageerror", failed);
        error ? reject(error) : resolve(holder!);
      };
      const cancel = () => done(Error("Holder creation cancelled"));
      const failed = () => done(Error("Private backup could not be created. Try a current desktop browser."));
      const receive = (event: MessageEvent) => {
        if (event.data?.id !== id) return;
        try { done(undefined, validateHolder(event.data.result)); }
        catch { done(Error("Browser returned an invalid holder backup")); }
      };
      const timer = setTimeout(() => done(Error("Private backup creation timed out. Please retry.")), 60_000);
      options.signal.addEventListener("abort", cancel, { once: true });
      worker.addEventListener("message", receive);
      worker.addEventListener("error", failed);
      worker.addEventListener("messageerror", failed);
      if (options.signal.aborted) return cancel();
      try { worker.postMessage({ id, action: "holder-new" }); }
      catch { failed(); }
    });
  } finally {
    worker.terminate();
    // Termination drops references; JS/Go memory zeroization is not guaranteed.
  }
}
