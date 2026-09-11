import { type IndexTransport, type OfferRecord } from './arkiv';
import { decodeJson, decryptOffer, encodeJson, encryptOffer, type BindingStatusReader, type PrivateEnvelope,
  type QuoteCodec, type RecipientKey, type RequestContext, type SignedKeyBinding, type VerifyBindingSignature } from './privacy';
import { type ByteTransport } from './swarm';
export interface OfferServices { storage: ByteTransport; index: IndexTransport }
/** Deliberate public path. A caller must explicitly choose this path; failed private writes never call it. */
export async function publishPublicOffer<T>(quote: T, context: RequestContext, codec: QuoteCodec<T>, services: OfferServices, lifetimeSeconds: number) {
  if (!await codec.verify(quote, context)) throw new Error('Purchase quote rejected');
  const stored = await services.storage.upload(codec.encode(quote));
  const record: OfferRecord = { ...context, ...stored, mode: 'public', keyVersion: 0 };
  return { record, entity: await services.index.publish(record, lifetimeSeconds) };
}
export async function publishPrivateOffer<T>(quote: T, cert: SignedKeyBinding, context: RequestContext, codec: QuoteCodec<T>,
  verify: VerifyBindingSignature, status: BindingStatusReader, services: OfferServices, lifetimeSeconds: number) {
  const encrypted = await encryptOffer(quote, cert, context, codec, verify, status);
  const stored = await services.storage.upload(encodeJson(encrypted));
  const record: OfferRecord = { ...context, ...stored, mode: 'private', keyVersion: cert.binding.version };
  return { record, entity: await services.index.publish(record, lifetimeSeconds) };
}
/** Independent read client: retrieves storage bytes itself and reauthenticates the maker. */
export async function verifyStoredOffer<T>(record: OfferRecord, context: RequestContext, codec: QuoteCodec<T>, storage: ByteTransport,
  privateAccess?: { cert: SignedKeyBinding; key: RecipientKey }): Promise<T> {
  if (record.chainId !== context.chainId || record.market.toLowerCase() !== context.market.toLowerCase() ||
    record.seller.toLowerCase() !== context.seller.toLowerCase() || record.requestId !== context.requestId) throw new Error('Offer record context mismatch');
  const bytes = await storage.retrieve(record);
  if (record.mode === 'private') {
    if (!privateAccess) throw new Error('Seller encryption key unavailable on this device');
    return decryptOffer(decodeJson(bytes) as PrivateEnvelope, privateAccess.cert.binding, privateAccess.key, context, codec);
  }
  if (record.mode !== 'public') throw new Error('Unknown offer mode');
  const quote = codec.decode(bytes);
  if (!await codec.verify(quote, context)) throw new Error('Stored purchase quote rejected');
  return quote;
}
