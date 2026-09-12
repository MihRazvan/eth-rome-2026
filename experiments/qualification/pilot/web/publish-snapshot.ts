// SPDX-License-Identifier: MIT
import type { createSwarmStorage, StorageRef } from "../swarm-id";

export type SnapshotPublication = {
  snapshotPath: string;
  snapshotSha256: string;
  snapshotBytes: number;
  root: string;
  issuerPath: string;
  issuerSha256: string;
};
const hash = async (bytes: Uint8Array) =>
  `0x${Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))), (b) => b.toString(16).padStart(2, "0")).join("")}`;
const normalizeHash = (value: string) =>
  `0x${value.replace(/^0x/, "").toLowerCase()}`;

/** Publishes only build-reviewed, already-public metadata. The caller retains
 * ownership of the shared Swarm ID client and calls refresh on state changes. */
export function mountSnapshotPublisher(
  container: HTMLElement,
  storage: ReturnType<typeof createSwarmStorage>,
  publication: SnapshotPublication,
) {
  const metadata = { ...publication };
  const doc = container.ownerDocument;
  const section = doc.createElement("section");
  const heading = doc.createElement("h3");
  heading.textContent = "Publish the demo issuer snapshot";
  const description = doc.createElement("p");
  description.textContent =
    "Use your connected Swarm ID storage credit to publish the exact public revocation snapshot prepared by the demo operator. This test issuer is not an independent professional accreditation. Publication does not issue credentials, deploy contracts or authorize payments.";
  const details = doc.createElement("p");
  details.className = "fine";
  details.textContent =
    "Only public issuer metadata is read. No credential, holder file, recovery phrase or wallet signature is requested. The whole snapshot is uploaded publicly; it contains revocation indices.";
  const button = doc.createElement("button");
  button.type = "button";
  button.textContent = "Publish demo issuer snapshot";
  const result = doc.createElement("pre");
  result.setAttribute("role", "status");
  section.append(heading, description, details, button, result);
  container.append(section);

  let busy = false,
    done = false,
    destroyed = false;
  let ref: StorageRef | undefined;
  let controller: AbortController | undefined;
  let valid = true;
  const path = (input: string) => {
    const origin = doc.location.origin;
    const url = new URL(input, origin);
    if (
      !input.startsWith("/") ||
      input.startsWith("//") ||
      url.origin !== origin ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      throw Error("Invalid public metadata path");
    return url.href;
  };
  try {
    path(metadata.snapshotPath);
    path(metadata.issuerPath);
    if (
      !Number.isSafeInteger(metadata.snapshotBytes) ||
      metadata.snapshotBytes < 1 ||
      metadata.snapshotBytes > 1024 * 1024 ||
      !/^(0|[1-9][0-9]{0,76})$/.test(metadata.root) ||
      ![metadata.snapshotSha256, metadata.issuerSha256].every((value) =>
        /^(0x)?[a-f0-9]{64}$/i.test(value),
      )
    )
      throw Error("Invalid public metadata manifest");
    metadata.snapshotSha256 = normalizeHash(metadata.snapshotSha256);
    metadata.issuerSha256 = normalizeHash(metadata.issuerSha256);
    result.textContent = `Public snapshot: ${metadata.snapshotBytes} bytes\nRoot: ${metadata.root}\nSHA-256: ${metadata.snapshotSha256}`;
  } catch {
    valid = false;
    result.textContent =
      "The reviewed public publication manifest is unavailable. Ask the demo operator to rebuild it.";
  }
  const refresh = () => {
    button.disabled =
      destroyed || !valid || busy || done || (!ref && !storage.state.canUpload);
    button.textContent = done
      ? "Snapshot publication verified"
      : ref
        ? "Retry independent retrieval"
        : "Publish demo issuer snapshot";
  };
  const alive = () => {
    if (destroyed) throw Error("Publisher closed");
  };
  async function fetchPublic(
    input: string,
    limit: number,
    expected: string,
    exact?: number,
  ) {
    const response = await fetch(path(input), {
      signal: controller!.signal,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok || !response.body)
      throw Error("Public metadata unavailable");
    const declared = response.headers.get("content-length");
    if (
      declared !== null &&
      (!/^[0-9]+$/.test(declared) || Number(declared) > limit)
    ) {
      await response.body.cancel();
      throw Error("Public metadata too large");
    }
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const part = await reader.read();
        alive();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > limit) throw Error("Public metadata too large");
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    if (!length || (exact !== undefined && length !== exact))
      throw Error("Public metadata size mismatch");
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if ((await hash(bytes)) !== expected)
      throw Error("Public metadata digest mismatch");
    alive();
    return bytes;
  }
  button.onclick = async () => {
    if (destroyed || !valid || busy || done) return;
    if (!ref && !storage.state.canUpload) {
      result.textContent =
        "Connect Swarm ID with active storage credit before publishing.";
      refresh();
      return;
    }
    busy = true;
    refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!ref) {
        result.textContent =
          "Checking the exact public issuer metadata and whole snapshot…";
        controller = new AbortController();
        timer = setTimeout(() => controller?.abort(), 15_000);
        const [snapshot, issuer] = await Promise.all([
          fetchPublic(
            metadata.snapshotPath,
            metadata.snapshotBytes,
            metadata.snapshotSha256,
            metadata.snapshotBytes,
          ),
          fetchPublic(metadata.issuerPath, 4096, metadata.issuerSha256),
        ]);
        clearTimeout(timer);
        timer = undefined;
        const decode = (bytes: Uint8Array) =>
          JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        if (
          decode(snapshot).root !== metadata.root ||
          decode(issuer).testOnly !== true
        )
          throw Error("Public metadata authority mismatch");
        alive();
        if (!storage.state.canUpload) throw Error("Upload capability changed");
        result.textContent =
          "Publishing the reviewed public snapshot using your storage credit…";
        const uploaded = await storage.upload(snapshot);
        alive();
        if (
          !/^[a-f0-9]{64}$/i.test(uploaded.reference) ||
          uploaded.sha256.toLowerCase() !== metadata.snapshotSha256
        )
          throw Error("Storage receipt mismatch");
        ref = { ...uploaded };
      }
      result.textContent = `Uploaded. Checking independent retrieval…\nReference: ${ref.reference}\nSHA-256: ${ref.sha256}`;
      const retrieved = await storage.download(ref);
      alive();
      if (
        retrieved.length !== metadata.snapshotBytes ||
        (await hash(retrieved)) !== metadata.snapshotSha256
      )
        throw Error("Independent retrieval mismatch");
      alive();
      done = true;
      result.textContent = `Public snapshot upload and independent retrieval verified.\nReference: ${ref.reference}\nSHA-256: ${ref.sha256}\nRoot: ${metadata.root}\nShare this public reference with the demo operator. Contracts and credential enrollment are separate steps.`;
    } catch {
      if (!destroyed)
        result.textContent = ref
          ? `The snapshot was uploaded, but independent retrieval is not yet verified. Retrying checks this reference without uploading again.\nReference: ${ref.reference}\nSHA-256: ${ref.sha256}`
          : "Publication did not complete. Check your Swarm ID storage credit and retry. An upload interrupted after it started may already exist; no deployment is implied.";
    } finally {
      if (timer) clearTimeout(timer);
      controller?.abort();
      controller = undefined;
      busy = false;
      refresh();
    }
  };
  refresh();
  return {
    refresh,
    destroy() {
      destroyed = true;
      controller?.abort();
      button.onclick = null;
      refresh();
    },
  };
}
