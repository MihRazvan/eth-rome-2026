import { test } from "node:test";
import assert from "node:assert/strict";
import { createHolderInBrowser } from "./holder-enrollment";

const valid = { version: "qualification-v1-test", testOnly: true, holderSecret: "1", holderCommitment: "2" };
class FakeWorker extends EventTarget {
  static last: FakeWorker;
  static reply: unknown = valid;
  terminated = false;
  constructor(readonly url: string) { super(); FakeWorker.last = this; }
  postMessage(request: { id: string; action: string }) {
    assert.deepEqual(Object.keys(request).sort(), ["action", "id"]);
    assert.equal(request.action, "holder-new");
    if (FakeWorker.reply === undefined) return;
    queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: { id: request.id, result: FakeWorker.reply } })));
  }
  terminate() { this.terminated = true; }
}
test("holder generation accepts only bounded canonical backups and terminates workers", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw Error("Private enrollment must not fetch"); });
  const original = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: FakeWorker });
  try {
    const options = () => ({ signal: new AbortController().signal, onProgress() {} });
    assert.deepEqual(await createHolderInBrowser(options()), valid);
    assert.equal(FakeWorker.last.url, "/prover/worker.js");
    assert.equal(FakeWorker.last.terminated, true);
    for (const bad of [null, { error: "private input here" }, { ...valid, holderSecret: "0" },
      { ...valid, holderSecret: "01" }, { ...valid, holderSecret: (1n << 248n).toString() },
      { ...valid, holderCommitment: "9".repeat(78) }, { ...valid, holderCommitment: "21888242871839275222246405745257275088548364400416034343698204186575808495617" },
      { ...valid, version: "other" }, { ...valid, testOnly: false }, { ...valid, extra: true }]) {
      FakeWorker.reply = bad;
      await assert.rejects(createHolderInBrowser(options()), /invalid holder backup/);
      assert.equal(FakeWorker.last.terminated, true);
    }
    FakeWorker.reply = undefined;
    const controller = new AbortController();
    const pending = createHolderInBrowser({ signal: controller.signal, onProgress() {} });
    controller.abort();
    await assert.rejects(pending, /cancelled/);
    assert.equal(FakeWorker.last.terminated, true);
    await assert.rejects(createHolderInBrowser({ signal: controller.signal, onProgress() {} }), /cancelled/);
  } finally {
    if (original) Object.defineProperty(globalThis, "Worker", original);
    else Reflect.deleteProperty(globalThis, "Worker");
  }
});
