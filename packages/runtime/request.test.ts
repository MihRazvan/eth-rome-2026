import {
  createServer,
  request,
  type Server,
  type IncomingMessage,
} from "node:http";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { MutationQueue, readJsonBody, RequestError } from "./request";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};
type Reply = { status: number; body: string };
function send(
  port: number,
  body: string | Buffer,
  contentType = "application/json",
) {
  return new Promise<Reply>((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port,
        method: "POST",
        headers: { "Content-Type": contentType },
      },
      (res) => receive(res, resolve),
    );
    req.on("error", reject);
    req.end(body);
  });
}
function receive(res: IncomingMessage, resolve: (reply: Reply) => void) {
  let body = "";
  res.on("data", (chunk) => (body += chunk));
  res.on("end", () => resolve({ status: res.statusCode!, body }));
}
async function serve(
  run: (port: number) => Promise<void>,
  options: {
    onHeaders?: () => void;
    onParsed?: (body: any) => void;
    action?: (body: any) => Promise<void>;
    waitTimeoutMs?: number;
  } = {},
) {
  const queue = new MutationQueue({
    maxQueued: 1,
    waitTimeoutMs: options.waitTimeoutMs ?? 250,
  });
  const server = createServer(async (req, res) => {
    options.onHeaders?.();
    const disconnected = new AbortController();
    res.once("close", () => {
      if (!res.writableEnded) disconnected.abort();
    });
    let release: (() => void) | undefined;
    try {
      const body = await readJsonBody(req, { maxBytes: 64, timeoutMs: 100 });
      options.onParsed?.(body);
      release = await queue.acquire(disconnected.signal);
      await options.action?.(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    } catch (error) {
      if (res.destroyed) return;
      if (error instanceof RequestError && error.closeConnection)
        res.setHeader("Connection", "close");
      res.writeHead(error instanceof RequestError ? error.status : 400);
      res.end(error instanceof RequestError ? error.message : "Action failed");
    } finally {
      release?.();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run((server.address() as { port: number }).port);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("runtime request boundaries — actual isolated HTTP", () => {
  it("complete mutations pass an incomplete body, which receives its own 408", async () => {
    const headers = deferred();
    await serve(
      async (port) => {
        const slowResponse = new Promise<Reply>((resolve, reject) => {
          const slow = request(
            {
              host: "127.0.0.1",
              port,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": 30,
              },
            },
            (res) => receive(res, resolve),
          );
          slow.on("error", reject);
          slow.write("{");
        });
        await headers.promise;
        const complete = await send(port, '{"id":"complete"}');
        expect(complete).toEqual({ status: 200, body: '{"id":"complete"}' });
        const timedOut = await slowResponse;
        expect(timedOut.status).toBe(408);
        expect(timedOut.body).toBe("Request body timed out");
        expect((await send(port, '{"id":"after"}')).status).toBe(200);
      },
      { onHeaders: headers.resolve },
    );
  });

  it("rejects media type, malformed JSON, non-object JSON and malformed UTF-8 before mutation", async () => {
    let mutations = 0;
    await serve(
      async (port) => {
        expect((await send(port, "{}", "text/plain")).status).toBe(415);
        for (const body of [
          "{",
          "[]",
          "null",
          Buffer.from([0x7b, 0xff, 0x7d]),
        ]) {
          expect((await send(port, body)).status).toBe(400);
        }
        expect(mutations).toBe(0);
        expect(
          (await send(port, "{}", "application/json; charset=utf-8")).status,
        ).toBe(200);
        expect(mutations).toBe(1);
      },
      {
        action: async () => {
          mutations++;
        },
      },
    );
  });

  it("bounds actual bytes for chunked UTF-8 bodies and declared Content-Length", async () => {
    let mutations = 0;
    await serve(
      async (port) => {
        const chunked = await new Promise<Reply>((resolve, reject) => {
          const req = request(
            {
              host: "127.0.0.1",
              port,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Transfer-Encoding": "chunked",
              },
            },
            (res) => receive(res, resolve),
          );
          req.on("error", reject);
          req.write('{"value":"');
          req.end("é".repeat(40) + '"}');
        });
        expect(chunked.status).toBe(413);
        const declared = await new Promise<Reply>((resolve, reject) => {
          const req = request(
            {
              host: "127.0.0.1",
              port,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": 65,
              },
            },
            (res) => receive(res, resolve),
          );
          req.on("error", reject);
          req.flushHeaders();
        });
        expect(declared.status).toBe(413);
        expect(mutations).toBe(0);
      },
      {
        action: async () => {
          mutations++;
        },
      },
    );
  });

  it("preserves FIFO signer serialization and rejects excess queued work with 503", async () => {
    const active = deferred(),
      parsedSecond = deferred(),
      release = deferred();
    const executed: number[] = [];
    await serve(
      async (port) => {
        const first = send(port, '{"id":1}');
        await active.promise;
        const second = send(port, '{"id":2}');
        await parsedSecond.promise;
        expect((await send(port, '{"id":3}')).status).toBe(503);
        expect(executed).toEqual([1]);
        release.resolve();
        expect((await first).status).toBe(200);
        expect((await second).status).toBe(200);
        expect(executed).toEqual([1, 2]);
      },
      {
        onParsed: (body) => {
          if (body.id === 2) parsedSecond.resolve();
        },
        action: async (body) => {
          executed.push(body.id);
          if (body.id === 1) {
            active.resolve();
            await release.promise;
          }
        },
      },
    );
  });

  it("removes timed-out queued work without executing it or blocking subsequent work", async () => {
    const active = deferred(),
      release = deferred();
    const executed: number[] = [];
    await serve(
      async (port) => {
        const first = send(port, '{"id":1}');
        await active.promise;
        expect((await send(port, '{"id":2}')).status).toBe(503);
        expect(executed).toEqual([1]);
        release.resolve();
        await first;
        expect((await send(port, '{"id":3}')).status).toBe(200);
        expect(executed).toEqual([1, 3]);
      },
      {
        waitTimeoutMs: 40,
        action: async (body) => {
          executed.push(body.id);
          if (body.id === 1) {
            active.resolve();
            await release.promise;
          }
        },
      },
    );
  });

  it("a thrown mutation releases the lock and preserves each response", async () => {
    await serve(
      async (port) => {
        expect((await send(port, '{"fail":true}')).status).toBe(400);
        expect(await send(port, '{"id":"next"}')).toEqual({
          status: 200,
          body: '{"id":"next"}',
        });
      },
      {
        action: async (body) => {
          if (body.fail) throw new Error("Injected action failure");
        },
      },
    );
  });

  it("removes disconnected waiters and makes release idempotent", async () => {
    const queue = new MutationQueue({ maxQueued: 1 });
    const release = await queue.acquire();
    const disconnected = new AbortController();
    const waiting = queue.acquire(disconnected.signal);
    const rejected = expect(waiting).rejects.toThrow("ended before execution");
    disconnected.abort();
    await rejected;
    const next = queue.acquire();
    release();
    release();
    const releaseNext = await next;
    const last = queue.acquire();
    releaseNext();
    (await last)();
  });
});
