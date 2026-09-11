import { type Address, type PublicClient } from 'viem';
import { parseSignedQuote, serializeSignedQuote, verifySignedQuote, type SignedQuote } from '../shared/quote';
import { type QuoteCodec } from './privacy';
/** Request terms are supplied from the inspected claim; callers still simulate settlement immediately before acceptance. */
export function purchaseQuoteCodec(expected: { claimId: bigint; source: Address; sourceVersion: bigint }, client?: PublicClient): QuoteCodec<SignedQuote> {
  return {
    encode: value => new TextEncoder().encode(serializeSignedQuote(value)),
    decode: bytes => parseSignedQuote(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    verify: async (value, context) => value.quote.seller.toLowerCase() === context.seller.toLowerCase() &&
      value.quote.claimId === expected.claimId && value.quote.source.toLowerCase() === expected.source.toLowerCase() &&
      value.quote.sourceVersion === expected.sourceVersion && await verifySignedQuote(value, context.chainId, context.market, client),
  };
}
