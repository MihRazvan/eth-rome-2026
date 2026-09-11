import { type Address, type Hex, type PublicClient, isAddress, verifyTypedData } from 'viem';

export const purchaseQuoteTypes = { PurchaseQuote: [
  { name: 'maker', type: 'address' }, { name: 'seller', type: 'address' }, { name: 'buyer', type: 'address' },
  { name: 'claimId', type: 'uint256' }, { name: 'source', type: 'address' }, { name: 'sourceVersion', type: 'uint256' },
  { name: 'paymentToken', type: 'address' }, { name: 'netPayment', type: 'uint256' }, { name: 'feeAmount', type: 'uint256' },
  { name: 'feeRecipient', type: 'address' }, { name: 'ownershipEpoch', type: 'uint256' }, { name: 'depletion', type: 'uint256' },
  { name: 'deadline', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }, { name: 'underwritingHash', type: 'bytes32' },
] } as const;
export interface PurchaseQuote {
  maker: Address; seller: Address; buyer: Address; claimId: bigint; source: Address; sourceVersion: bigint;
  paymentToken: Address; netPayment: bigint; feeAmount: bigint; feeRecipient: Address; ownershipEpoch: bigint;
  depletion: bigint; deadline: bigint; nonce: Hex; underwritingHash: Hex;
}
export interface SignedQuote { quote: PurchaseQuote; signature: Hex }
export const quoteDomain = (chainId: number, market: Address) => ({ name: 'EXIT', version: '1', chainId, verifyingContract: market }) as const;
export const quoteTypedData = (quote: PurchaseQuote, chainId: number, market: Address) => ({ domain: quoteDomain(chainId, market), types: purchaseQuoteTypes, primaryType: 'PurchaseQuote' as const, message: {...quote} });
export function serializeSignedQuote(value: SignedQuote): string {
  return JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v);
}
export function parseSignedQuote(raw: string): SignedQuote {
  const data = JSON.parse(raw);
  if (!data || !data.quote || typeof data.signature !== 'string' || !/^0x(?:[a-fA-F0-9]{2})+$/.test(data.signature)) throw new Error('Invalid signed quote');
  const quote: Record<string, unknown> = {};
  for (const field of purchaseQuoteTypes.PurchaseQuote) {
    const v = data.quote[field.name];
    if (field.type === 'uint256') {
      if (typeof v !== 'string' || !/^(0|[1-9][0-9]*)$/.test(v) || BigInt(v) >= 2n ** 256n) throw new Error(`Invalid ${field.name}`);
      quote[field.name] = BigInt(v);
    } else {
      if (typeof v !== 'string' || (field.type === 'address' ? !isAddress(v) : !/^0x[a-fA-F0-9]{64}$/.test(v))) throw new Error(`Invalid ${field.name}`);
      quote[field.name] = v;
    }
  }
  return {quote: quote as unknown as PurchaseQuote, signature: data.signature};
}
export async function verifySignedQuote(value: SignedQuote, chainId: number, market: Address, client?: PublicClient): Promise<boolean> {
  const args = {...quoteTypedData(value.quote, chainId, market), address: value.quote.maker, signature: value.signature};
  return client ? client.verifyTypedData({...args, blockTag: 'latest'}) : verifyTypedData(args);
}
