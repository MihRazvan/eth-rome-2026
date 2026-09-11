import type { IncomingMessage } from "node:http";

/** Safe application error. Never wrap provider errors or payloads in this type. */
export class RequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly closeConnection = false,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

/** Parse a complete, bounded JSON object before admitting any signer mutation. */
export async function readJsonBody(
  req: IncomingMessage,
  {
    maxBytes = 100_000,
    timeoutMs = 10_000,
  }: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<Record<string, any>> {
  const mediaType = req.headers["content-type"]
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    req.pause();
    throw new RequestError("Content-Type must be application/json", 415, true);
  }
  const length = req.headers["content-length"];
  if (
    length !== undefined &&
    (!/^\d+$/.test(length) || Number(length) > maxBytes)
  ) {
    req.pause();
    throw new RequestError("Request body exceeds the size limit", 413, true);
  }
  const bytes = await new Promise<Buffer>((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    const cleanup = () => {
      clearTimeout(timer);
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
    };
    const fail = (error: RequestError) => {
      cleanup();
      req.pause();
      reject(error);
    };
    const onData = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.byteLength;
      if (size > maxBytes)
        return fail(
          new RequestError("Request body exceeds the size limit", 413, true),
        );
      chunks.push(buffer);
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks, size));
    };
    const onError = () =>
      fail(new RequestError("Request body could not be read", 400, true));
    const onAborted = () =>
      fail(new RequestError("Request body was interrupted", 400, true));
    const timer = setTimeout(
      () => fail(new RequestError("Request body timed out", 408, true)),
      timeoutMs,
    );
    req.on("data", onData);
    req.once("end", onEnd);
    req.once("error", onError);
    req.once("aborted", onAborted);
  });
  try {
    const body = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("object required");
    return body;
  } catch {
    throw new RequestError("Request body must be a valid JSON object");
  }
}

type Waiter = {
  resolve: (release: () => void) => void;
  reject: (error: RequestError) => void;
  timer: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abort: () => void;
};

/** Bounded FIFO: one active signer mutation; waiting/aborted clients hold no signer lock. */
export class MutationQueue {
  private active = false;
  private waiting: Waiter[] = [];
  constructor(
    private readonly options: {
      maxQueued?: number;
      waitTimeoutMs?: number;
    } = {},
  ) {}

  acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted)
      return Promise.reject(
        new RequestError("Request ended before execution", 408),
      );
    if (!this.active) {
      this.active = true;
      return Promise.resolve(this.releaseOnce());
    }
    if (this.waiting.length >= (this.options.maxQueued ?? 16)) {
      return Promise.reject(
        new RequestError("Publication queue is full; retry later", 503),
      );
    }
    return new Promise((resolve, reject) => {
      const remove = (error: RequestError) => {
        const index = this.waiting.indexOf(waiter);
        if (index === -1) return;
        this.waiting.splice(index, 1);
        this.cleanup(waiter);
        reject(error);
      };
      const waiter: Waiter = {
        resolve,
        reject,
        signal,
        abort: () =>
          remove(new RequestError("Request ended before execution", 408)),
        timer: setTimeout(
          () =>
            remove(
              new RequestError(
                "Publication queue wait timed out; retry later",
                503,
              ),
            ),
          this.options.waitTimeoutMs ?? 15_000,
        ),
      };
      this.waiting.push(waiter);
      signal?.addEventListener("abort", waiter.abort, { once: true });
      if (signal?.aborted) waiter.abort();
    });
  }

  private cleanup(waiter: Waiter) {
    clearTimeout(waiter.timer);
    waiter.signal?.removeEventListener("abort", waiter.abort);
  }

  private releaseOnce(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiting.shift();
      if (next) {
        this.cleanup(next);
        next.resolve(this.releaseOnce());
      } else this.active = false;
    };
  }
}
