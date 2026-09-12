// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mountSnapshotPublisher } from "./publish-snapshot";
import type { createSwarmStorage } from "../swarm-id";

// Minimal DOM seam keeps these authority/side-effect tests runnable in Node.
class Element {
  textContent = "";
  disabled = false;
  className = "";
  type = "";
  children: Element[] = [];
  onclick: null | (() => Promise<void>) = null;
  constructor(readonly ownerDocument: DocumentSeam) {}
  append(...elements: Element[]) {
    this.children.push(...elements);
  }
  setAttribute() {}
}
class DocumentSeam {
  location = { origin: "https://review-pass.invalid" };
  createElement() {
    return new Element(this);
  }
}
const bytes = (text: string) => new TextEncoder().encode(text);
const digest = (v: Uint8Array) =>
  `0x${createHash("sha256").update(v).digest("hex")}` as const;
function fixture() {
  const snapshot = bytes('{ "root": "7", "revokedIndices": [] }\n');
  const issuer = bytes('{"testOnly":true}');
  const metadata = {
    snapshotPath: "/issuer/snapshot.json",
    snapshotSha256: digest(snapshot),
    snapshotBytes: snapshot.length,
    root: "7",
    issuerPath: "/issuer/public.json",
    issuerSha256: digest(issuer),
  };
  const state = { canUpload: true };
  const writes: Uint8Array[] = [];
  let downloads = 0;
  const reference = "a".repeat(64);
  const store = {
    state,
    async upload(value: Uint8Array) {
      writes.push(value);
      return { reference, sha256: digest(value) };
    },
    async download() {
      downloads++;
      return snapshot;
    },
  };
  const requests: { input: string; options?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, options) => {
    requests.push({ input: String(input), options });
    return new Response(
      String(input).endsWith("snapshot.json") ? snapshot : issuer,
    );
  };
  const container = new Element(new DocumentSeam());
  const mount = () => {
    const helper = mountSnapshotPublisher(
      container as unknown as HTMLElement,
      store as unknown as ReturnType<typeof createSwarmStorage>,
      metadata,
    );
    const section = container.children[0];
    return { helper, button: section.children[3], result: section.children[4] };
  };
  return {
    snapshot,
    issuer,
    metadata,
    state,
    writes,
    store,
    requests,
    fetcher,
    mount,
    downloads: () => downloads,
  };
}
const originalFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
});
test("explicit click publishes exact original bytes and verifies independent retrieval", async () => {
  const f = fixture();
  globalThis.fetch = f.fetcher;
  const ui = f.mount();
  assert.equal(f.requests.length, 0);
  assert.equal(f.writes.length, 0);
  await ui.button.onclick!();
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.writes[0], f.snapshot);
  assert.equal(f.downloads(), 1);
  assert.match(ui.result.textContent, /independent retrieval verified/);
  assert.equal(ui.button.disabled, true);
  assert.ok(
    f.requests.every(
      (r) =>
        r.options?.credentials === "omit" && r.options.redirect === "error",
    ),
  );
});
test("capability absence prevents network requests; refresh enables after funding", async () => {
  const f = fixture();
  globalThis.fetch = f.fetcher;
  f.state.canUpload = false;
  const ui = f.mount();
  assert.equal(ui.button.disabled, true);
  await ui.button.onclick!();
  assert.equal(f.requests.length, 0);
  f.state.canUpload = true;
  ui.helper.refresh();
  assert.equal(ui.button.disabled, false);
});
test("snapshot tampering, issuer tampering and wrong reviewed root prevent uploads", async () => {
  for (const mode of ["snapshot", "issuer", "root"]) {
    const f = fixture();
    if (mode === "root") f.metadata.root = "8";
    globalThis.fetch = async (input, init) =>
      String(input).endsWith(
        mode === "snapshot" ? "snapshot.json" : "public.json",
      ) && mode !== "root"
        ? new Response(bytes('{"tampered":true}'))
        : f.fetcher(input, init);
    const ui = f.mount();
    await ui.button.onclick!();
    assert.equal(f.writes.length, 0, mode);
    assert.match(ui.result.textContent, /Publication did not complete/);
  }
});
test("failed retrieval preserves receipt and retry never uploads a second time", async () => {
  const f = fixture();
  globalThis.fetch = f.fetcher;
  let tries = 0;
  f.store.download = async () => {
    if (!tries++) throw Error("secret internal URL");
    return f.snapshot;
  };
  const ui = f.mount();
  await ui.button.onclick!();
  assert.equal(f.writes.length, 1);
  assert.match(ui.result.textContent, new RegExp("a".repeat(64)));
  assert.doesNotMatch(ui.result.textContent, /secret internal URL/);
  assert.equal(ui.button.textContent, "Retry independent retrieval");
  f.state.canUpload = false;
  ui.helper.refresh();
  assert.equal(ui.button.disabled, false);
  await ui.button.onclick!();
  assert.equal(f.writes.length, 1);
  assert.match(ui.result.textContent, /independent retrieval verified/);
});
test("busy guard prevents duplicate clicks and destroy aborts metadata fetches", async () => {
  const f = fixture();
  let aborted = false;
  globalThis.fetch = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => {
        aborted = true;
        reject(Error("aborted"));
      });
    });
  const ui = f.mount();
  const first = ui.button.onclick!();
  await ui.button.onclick!();
  assert.equal(f.writes.length, 0);
  assert.equal(ui.button.disabled, true);
  ui.helper.destroy();
  await first;
  assert.equal(aborted, true);
  assert.equal(ui.button.onclick, null);
  assert.equal(ui.button.disabled, true);
});
test("unreviewed cross-origin paths and oversized manifests stay disabled", () => {
  for (const patch of [
    { snapshotPath: "https://attacker.invalid/secret" },
    { issuerPath: "//attacker.invalid/secret" },
    { snapshotBytes: 2 * 1024 * 1024 },
  ]) {
    const f = fixture();
    Object.assign(f.metadata, patch);
    const ui = f.mount();
    assert.equal(ui.button.disabled, true);
    assert.match(ui.result.textContent, /manifest is unavailable/);
  }
});
