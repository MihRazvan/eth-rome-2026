import { bytesToHex, sha256, type Hex } from 'viem';
export interface StoredBytes { reference: string; sha256: Hex }
export interface ByteTransport {
  readonly environment: 'swarm' | 'explicit-local-test';
  upload(bytes: Uint8Array): Promise<StoredBytes>;
  retrieve(record: StoredBytes): Promise<Uint8Array>;
}
const referencePattern = /^[0-9a-f]{64}$/i;
/** Ordinary Bee bytes only. A 128-char native-encryption reference is rejected because it embeds a key. */
export class SwarmBytes implements ByteTransport {
  readonly environment = 'swarm' as const;
  constructor(private config: { uploadUrl: string; retrievalUrl: string; postageBatchId?: string; fetch?: typeof fetch }) {}
  private get fetcher() { return this.config.fetch ?? fetch; }
  async upload(bytes: Uint8Array): Promise<StoredBytes> {
    const batch = this.config.postageBatchId;
    if (!batch || !referencePattern.test(batch)) throw new Error('Swarm upload requires a funded postage batch');
    const response = await this.fetcher(`${this.config.uploadUrl.replace(/\/$/, '')}/bytes`, {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'swarm-postage-batch-id': batch,
        'swarm-encrypt': 'false', 'swarm-deferred-upload': 'false' }, body: bytes as BodyInit,
    });
    if (!response.ok) throw new Error(`Swarm upload failed (${response.status})`);
    const value = await response.json() as { reference?: unknown };
    if (typeof value.reference !== 'string' || !referencePattern.test(value.reference)) throw new Error('Swarm returned an invalid ordinary-byte reference');
    return { reference: value.reference, sha256: sha256(bytesToHex(bytes)) };
  }
  async retrieve(record: StoredBytes): Promise<Uint8Array> {
    if (!referencePattern.test(record.reference)) throw new Error('Invalid Swarm byte reference');
    const response = await this.fetcher(`${this.config.retrievalUrl.replace(/\/$/, '')}/bytes/${record.reference}`);
    if (!response.ok) throw new Error(`Swarm retrieval failed (${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (sha256(bytesToHex(bytes)) !== record.sha256) throw new Error('Swarm retrieved bytes failed integrity verification');
    return bytes;
  }
}
