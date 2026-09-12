import { bytesToHex, sha256, type Hex } from "viem";
export type ContentRef = { reference: string; sha256: Hex };
export type ByteProvider = {
  environment: "public-swarm" | "local-bee";
  upload(bytes: Uint8Array): Promise<ContentRef>;
  download(ref: ContentRef): Promise<Uint8Array>;
};
const refPattern = /^[a-f0-9]{64}$/i;
/** Ordinary content references only: native encrypted references embed a key and are rejected. */
export function beeBytes(config: {
  environment: ByteProvider["environment"];
  uploadUrl: string;
  downloadUrl: string;
  postageBatchId: string;
  fetch?: typeof fetch;
  maxBytes?: number;
}): ByteProvider {
  const send = config.fetch ?? fetch,
    max = config.maxBytes ?? 8 * 1024 * 1024;
  const url = (base: string, path: string) =>
    `${base.replace(/\/$/, "")}${path}`;
  if (!refPattern.test(config.postageBatchId))
    throw Error("Usable postage batch required");
  if (
    config.environment === "local-bee" &&
    [config.uploadUrl, config.downloadUrl].some(
      (v) => !["localhost", "127.0.0.1", "[::1]"].includes(new URL(v).hostname),
    )
  )
    throw Error("Local Bee must use loopback endpoints");
  return {
    environment: config.environment,
    async upload(bytes) {
      if (bytes.length > max) throw Error("Content size limit exceeded");
      try {
        const r = await send(url(config.uploadUrl, "/bytes"), {
          method: "POST",
          signal: AbortSignal.timeout(20000),
          headers: {
            "content-type": "application/octet-stream",
            "swarm-postage-batch-id": config.postageBatchId,
            "swarm-encrypt": "false",
            "swarm-deferred-upload": "false",
          },
          body: bytes as BodyInit,
        });
        if (!r.ok) throw Error();
        const body = (await r.json()) as { reference?: unknown };
        if (
          typeof body.reference !== "string" ||
          !refPattern.test(body.reference)
        )
          throw Error();
        return { reference: body.reference, sha256: sha256(bytesToHex(bytes)) };
      } catch {
        throw Error("Bee upload failed; no plaintext or local fallback");
      }
    },
    async download(ref) {
      if (
        !refPattern.test(ref.reference) ||
        !/^0x[a-f0-9]{64}$/i.test(ref.sha256)
      )
        throw Error("Invalid content reference");
      try {
        const r = await send(
          url(config.downloadUrl, `/bytes/${ref.reference}`),
          { signal: AbortSignal.timeout(20000) },
        );
        if (!r.ok || Number(r.headers.get("content-length")) > max)
          throw Error();
        const reader = r.body?.getReader();
        if (!reader) throw Error();
        let total = 0;
        const chunks: Uint8Array[] = [];
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          total += part.value.length;
          if (total > max) {
            await reader.cancel();
            throw Error();
          }
          chunks.push(part.value);
        }
        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        if (
          sha256(bytesToHex(bytes)).toLowerCase() !== ref.sha256.toLowerCase()
        )
          throw Error();
        return bytes;
      } catch {
        throw Error("Bee download or content integrity check failed");
      }
    },
  };
}
export type IssuerState = {
  issuerId: string;
  epoch: number;
  root: string;
  authority: Hex;
  chainId: number;
};
export type SnapshotRef = IssuerState & ContentRef;
/** The root comes from Fuji. Whole issuer snapshot is fetched; there is no credential-index request. */
export async function downloadIssuerSnapshot(
  provider: ByteProvider,
  ref: SnapshotRef,
  trusted: IssuerState,
  validate: (
    wholeSnapshot: Uint8Array,
    trusted: IssuerState,
  ) => Promise<boolean>,
): Promise<Uint8Array> {
  if (
    ref.issuerId !== trusted.issuerId ||
    ref.epoch !== trusted.epoch ||
    ref.root !== trusted.root ||
    ref.chainId !== trusted.chainId ||
    ref.authority.toLowerCase() !== trusted.authority.toLowerCase()
  )
    throw Error("Snapshot does not match authoritative issuer state");
  const bytes = await provider.download(ref);
  if (!(await validate(bytes, trusted)))
    throw Error("Snapshot commitment verification failed");
  return bytes;
}
