import { describe, expect, it } from 'vitest';
import { keccak256, verifyTypedData, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { quoteTypedData, type SignedQuote } from '../shared/quote';
import { allPages, offerAttributes } from './arkiv';
import { decryptOffer, encryptOffer, generateRecipientKey, keyBindingTypedData, validateBinding,
  type KeyBinding, type SignedKeyBinding, type VerifyBindingSignature } from './privacy';
import { purchaseQuoteCodec } from './quotes';
import { publishPrivateOffer, verifyStoredOffer } from './offers';
import { SwarmBytes } from './swarm';
const seller = privateKeyToAccount(`0x${'11'.repeat(32)}`);
const maker = privateKeyToAccount(`0x${'22'.repeat(32)}`);
const market = '0x0000000000000000000000000000000000000001' as const;
const source = '0x0000000000000000000000000000000000000002' as const;
const context = { chainId: 43113, market, seller: seller.address, requestId: `0x${'33'.repeat(32)}` as Hex };
const verify: VerifyBindingSignature = (data, signature, address) => verifyTypedData({ ...data, signature, address });
const codec = purchaseQuoteCodec({ claimId: 1n, source, sourceVersion: 1n });
async function setup() {
  const key = await generateRecipientKey();
  const now = Math.floor(Date.now() / 1000);
  const binding: KeyBinding = { ...context, publicKey: key.publicKey, version: 1, validFrom: now - 10, validUntil: now + 3600 };
  const cert: SignedKeyBinding = { binding, signature: await seller.signTypedData(keyBindingTypedData(binding)) };
  const q = { maker: maker.address, seller: seller.address, buyer: maker.address, claimId: 1n, source, sourceVersion: 1n,
    paymentToken: market, netPayment: 9960123456n, feeAmount: 0n, feeRecipient: market, ownershipEpoch: 1n, depletion: 0n,
    deadline: BigInt(now + 600), nonce: `0x${'44'.repeat(32)}` as Hex, underwritingHash: `0x${'00'.repeat(32)}` as Hex };
  const quote: SignedQuote = { quote: q, signature: await maker.signTypedData(quoteTypedData(q, context.chainId, market)) };
  const status = async () => ({ keyHash: keccak256(key.publicKey), version: 1, revoked: false });
  return { key, binding, cert, quote, status };
}
describe('Private Offers — real HPKE ciphertext, local test contexts', () => {
  it('seller decrypts signed canonical quote; competing maker and outsider cannot', async () => {
    const s = await setup();
    const encrypted = await encryptOffer(s.quote, s.cert, context, codec, verify, s.status);
    expect(await decryptOffer(encrypted, s.binding, s.key, context, codec)).toEqual(s.quote);
    const otherKey = await generateRecipientKey();
    await expect(decryptOffer(encrypted, s.binding, { ...otherKey, publicKey: s.key.publicKey }, context, codec)).rejects.toThrow('authenticated');
    expect(JSON.stringify(encrypted)).not.toContain('9960123456');
    expect(JSON.stringify(encrypted)).not.toContain(s.quote.signature);
    expect(s.key.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('jwk', s.key.privateKey)).rejects.toThrow();
  });
  it('rejects altered ciphertext, request, chain, protocol and key versions', async () => {
    const s = await setup();
    const e = await encryptOffer(s.quote, s.cert, context, codec, verify, s.status);
    for (const changed of [ { ...e, ciphertext: `${e.ciphertext.slice(0, -2)}${e.ciphertext.endsWith('00') ? '01' : '00'}` as Hex },
      { ...e, requestId: `0x${'55'.repeat(32)}` as Hex }, { ...e, chainId: 1 }, { ...e, version: 2 as 1 }, { ...e, keyVersion: 2 } ]) {
      await expect(decryptOffer(changed, s.binding, s.key, context, codec)).rejects.toThrow();
    }
  });
  it('rejects substituted keys, forged maker signature, expired and revoked key certificates', async () => {
    const s = await setup();
    const other = await generateRecipientKey();
    await expect(validateBinding({ ...s.cert, binding: { ...s.binding, publicKey: other.publicKey } }, context, verify, s.status)).rejects.toThrow('signature');
    await expect(encryptOffer({ ...s.quote, quote: { ...s.quote.quote, netPayment: 1n } }, s.cert, context, codec, verify, s.status)).rejects.toThrow('quote rejected');
    await expect(validateBinding(s.cert, context, verify, s.status, s.binding.validUntil)).rejects.toThrow('expired');
    await expect(validateBinding(s.cert, context, verify, async () => ({ ...await s.status(), revoked: true }))).rejects.toThrow('revoked');
    await expect(validateBinding(s.cert, context, verify, async () => ({ ...await s.status(), version: 2 }))).rejects.toThrow('rotated');
    await expect(validateBinding(s.cert, context, verify, async () => { throw new Error('offline'); })).rejects.toThrow('offline');
  });
  it('rotating/revoking prevents new encryption but does not erase old access', async () => {
    const s = await setup();
    const old = await encryptOffer(s.quote, s.cert, context, codec, verify, s.status);
    const rotated = async () => ({ ...await s.status(), version: 2, revoked: true });
    await expect(encryptOffer(s.quote, s.cert, context, codec, verify, rotated)).rejects.toThrow('rotated');
    expect(await decryptOffer(old, s.binding, s.key, context, codec)).toEqual(s.quote);
  });
  it('checks actual upload bytes and independent retrieval without plaintext fallback', async () => {
    const s = await setup();
    let uploaded: Uint8Array | undefined;
    let published: unknown;
    const reference = 'a'.repeat(64);
    const swarm = new SwarmBytes({ uploadUrl: 'https://test-upload.invalid', retrievalUrl: 'https://independent-reader.invalid', postageBatchId: 'b'.repeat(64),
      fetch: async (url, init) => {
        if (init?.method === 'POST') {
          expect((init.headers as Record<string,string>)['swarm-encrypt']).toBe('false');
          uploaded = init.body as Uint8Array;
          return Response.json({ reference });
        }
        expect(String(url)).toBe(`https://independent-reader.invalid/bytes/${reference}`);
        return new Response(uploaded as BodyInit);
      },
    });
    const result = await publishPrivateOffer(s.quote, s.cert, context, codec, verify, s.status, { storage: swarm,
      index: { environment: 'explicit-local-test', publish: async r => { published = r; return { entityKey: 'local', txHash: 'local', expiresAt: 1n }; }, discover: async () => [] } }, 60);
    const body = new TextDecoder().decode(uploaded);
    expect(body).not.toContain('9960123456');
    expect(body).not.toContain(s.quote.signature);
    expect(JSON.stringify(published)).not.toContain('netPayment');
    expect(offerAttributes(result.record)).not.toHaveProperty('price');
    expect(await verifyStoredOffer(result.record, context, codec, swarm, { cert: s.cert, key: s.key })).toEqual(s.quote);
    await expect(verifyStoredOffer(result.record, context, codec, swarm)).rejects.toThrow('unavailable');
    uploaded![uploaded!.length - 5] ^= 1;
    await expect(verifyStoredOffer(result.record, context, codec, swarm, { cert: s.cert, key: s.key })).rejects.toThrow('integrity');
  });
  it('never uploads if authentication fails', async () => {
    const s = await setup();
    let calls = 0;
    const storage = new SwarmBytes({ uploadUrl: 'https://invalid', retrievalUrl: 'https://invalid', postageBatchId: 'b'.repeat(64), fetch: async () => { calls++; throw new Error('unexpected upload'); } });
    await expect(publishPrivateOffer(s.quote, s.cert, context, codec, verify, async () => ({ ...await s.status(), revoked: true }),
      { storage, index: { environment: 'explicit-local-test', publish: async () => { throw new Error('unexpected publish'); }, discover: async () => [] } }, 60)).rejects.toThrow('revoked');
    expect(calls).toBe(0);
  });
  it('walks immutable pages completely before comparison', async () => {
    let calls = 0;
    const last = { entities: [9960], hasNextPage: () => false, next: async () => { throw new Error('end'); } };
    const first = { entities: [9900, 9940], hasNextPage: () => true, next: async () => { calls++; return last; } };
    expect(Math.max(...await allPages(first))).toBe(9960);
    expect(calls).toBe(1);
  });
});
