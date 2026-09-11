import { encodeAbiParameters, keccak256, parseAbi, type Address, type Hex, type PublicClient } from 'viem';
import { type BindingStatusReader } from './privacy';
/** New ownership epochs get independent negotiation requests; private/public quotes still bind all economic fields. */
export const offerRequestId = (chainId: number, market: Address, claimId: bigint, ownershipEpoch: bigint): Hex =>
  keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'address' }, { type: 'uint256' }, { type: 'uint256' }],
    [BigInt(chainId), market, claimId, ownershipEpoch]));
const registryReadAbi = parseAbi(['function keys(address seller, bytes32 requestId) view returns (bytes32 keyHash, uint256 version, uint256 validUntil)']);
/** Always reads latest chain state; a failed read rejects and never revives an old certificate. */
export function registryStatusReader(client: PublicClient, registry: Address): BindingStatusReader {
  return async context => {
    if (await client.getChainId() !== context.chainId) throw new Error('Recipient key registry is on the wrong chain');
    const [keyHash, version, validUntil] = await client.readContract({ address: registry, abi: registryReadAbi,
      functionName: 'keys', args: [context.seller, context.requestId], blockTag: 'latest' });
    if (version > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Recipient key version exceeds client range');
    return { keyHash, version: Number(version), revoked: /^0x0{64}$/.test(keyHash) || validUntil <= BigInt(Math.floor(Date.now() / 1000)) };
  };
}
