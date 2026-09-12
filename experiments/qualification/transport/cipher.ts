/** Browser-side AES-256-GCM; keys never appear in the uploaded envelope or public reference. */
export type JobContext = {
  chainId: number;
  contract: string;
  jobId: string;
  version: 1;
};
function aad(c: JobContext): Uint8Array<ArrayBuffer> {
  if (
    !Number.isSafeInteger(c.chainId) ||
    c.chainId <= 0 ||
    !/^0x[0-9a-f]{40}$/i.test(c.contract) ||
    !/^(0|[1-9][0-9]*)$/.test(c.jobId) ||
    c.version !== 1
  )
    throw Error("Invalid job encryption context");
  return new TextEncoder().encode(
    JSON.stringify([
      "qualification-job-document",
      1,
      c.chainId,
      c.contract.toLowerCase(),
      c.jobId,
    ]),
  );
}
const hex = (v: Uint8Array) =>
  Array.from(v, (b) => b.toString(16).padStart(2, "0")).join("");
function unhex(v: unknown): Uint8Array<ArrayBuffer> {
  if (typeof v !== "string" || !/^(?:[a-f0-9]{2})+$/.test(v))
    throw Error("Invalid ciphertext encoding");
  return Uint8Array.from(v.match(/../g)!, (x) => parseInt(x, 16));
}
export async function encryptJobDocument(
  plaintext: Uint8Array,
  context: JobContext,
): Promise<{ envelope: Uint8Array; key: CryptoKey }> {
  const additionalData = aad(context),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData, tagLength: 128 },
    key,
    new Uint8Array(plaintext),
  );
  const envelope = new TextEncoder().encode(
    JSON.stringify({
      algorithm: "A256GCM",
      version: 1,
      iv: hex(iv),
      ciphertext: hex(new Uint8Array(ciphertext)),
    }),
  );
  return { envelope, key };
}
export async function decryptJobDocument(
  envelope: Uint8Array,
  key: CryptoKey,
  context: JobContext,
): Promise<Uint8Array> {
  try {
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(envelope),
    );
    if (value.algorithm !== "A256GCM" || value.version !== 1) throw Error();
    const iv = unhex(value.iv),
      ciphertext = unhex(value.ciphertext);
    if (iv.length !== 12 || ciphertext.length < 16) throw Error();
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: aad(context), tagLength: 128 },
        key,
        ciphertext,
      ),
    );
  } catch {
    throw Error("Job document authentication failed");
  }
}
