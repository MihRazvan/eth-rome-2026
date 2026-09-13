import { Aes256Gcm, CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } from '@hpke/core';
import { bytesToHex, hexToBytes, verifyMessage, type Hex } from 'viem';
import { parseEnrollmentRequest, type EnrollmentRequest } from './enrollment-request';
import { validateProofFile } from './proof-files';
const suite = new CipherSuite({ kem: new DhkemP256HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
const enc = new TextEncoder();
export type ChannelContext = { chainId: number; escrow: string; issuer: string; ticket: string };
export type SealedEnrollment = { version: 1; context: ChannelContext; kind: 'application' | 'approval'; enc: Hex; ciphertext: Hex };
export type ChannelKeys = { publicKey: Hex; privateKey: JsonWebKey };
export const MAX_ENROLLMENT_BYTES = 16000;
const bytes = (v: unknown, size?: number) => {
  if (typeof v !== 'string' || !/^0x(?:[0-9a-f]{2})+$/i.test(v) || v.length > MAX_ENROLLMENT_BYTES * 2 || (size && v.length !== 2+size*2)) throw Error('Invalid encrypted application');
  return hexToBytes(v as Hex);
};
export function channelContext(c: ChannelContext): ChannelContext {
  if (!c || Object.keys(c).sort().join(',') !== 'chainId,escrow,issuer,ticket' || c.chainId !== 43113 || !/^[0-9a-f]{64}$/.test(c.ticket) || !/^0x[0-9a-f]{40}$/i.test(c.escrow) || !/^0x[0-9a-f]{40}$/i.test(c.issuer)) throw Error('Invalid application destination');
  return { chainId: c.chainId, escrow: c.escrow.toLowerCase(), issuer: c.issuer.toLowerCase(), ticket: c.ticket };
}
const aad = (context: ChannelContext, kind: string) => enc.encode(JSON.stringify({ protocol: 'cutout-private-enrollment-v1', context: channelContext(context), kind }));
export function parseSealedEnrollment(value: any): SealedEnrollment {
  if (!value || Object.keys(value).sort().join(',') !== 'ciphertext,context,enc,kind,version' || value.version !== 1 || !['application','approval'].includes(value.kind)) throw Error('Invalid encrypted application');
  const context = channelContext(value.context);
  bytes(value.enc,65); const ciphertext = bytes(value.ciphertext);
  if (ciphertext.length < 16 || enc.encode(JSON.stringify(value)).length > MAX_ENROLLMENT_BYTES) throw Error('Invalid encrypted application size');
  return {version:1,context,kind:value.kind,enc:value.enc,ciphertext:value.ciphertext};
}
export async function generateChannelKeys(): Promise<ChannelKeys> {
  const pair = await crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, true, ['deriveBits']);
  return {publicKey:bytesToHex(new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey))), privateKey:await crypto.subtle.exportKey('jwk',pair.privateKey)};
}
export async function sealEnrollment(value: unknown, key: Hex, context: ChannelContext, kind: SealedEnrollment['kind']): Promise<SealedEnrollment> {
  const plaintext = enc.encode(JSON.stringify(value));
  if (plaintext.length > 6000) throw Error('Application is too large');
  const publicKey = await suite.kem.deserializePublicKey(bytes(key,65).buffer);
  const sender = await suite.createSenderContext({recipientPublicKey:publicKey,info:aad(context,kind)});
  return parseSealedEnrollment({version:1,context:channelContext(context),kind,enc:bytesToHex(new Uint8Array(sender.enc)),ciphertext:bytesToHex(new Uint8Array(await sender.seal(plaintext,aad(context,kind))))});
}
export async function openEnrollment(value: unknown, keys: ChannelKeys, context: ChannelContext, kind: SealedEnrollment['kind']): Promise<any> {
  const sealed = parseSealedEnrollment(value);
  if (JSON.stringify(sealed.context) !== JSON.stringify(channelContext(context)) || sealed.kind !== kind) throw Error('Application belongs to another request');
  try {
    const privateKey = await crypto.subtle.importKey('jwk', keys.privateKey, {name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
    const publicKey = await suite.kem.deserializePublicKey(bytes(keys.publicKey,65).buffer);
    const recipient = await suite.createRecipientContext({recipientKey:{privateKey,publicKey},enc:bytes(sealed.enc,65).buffer,info:aad(context,kind)});
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await recipient.open(bytes(sealed.ciphertext).buffer,aad(context,kind))));
  } catch { throw Error('This browser cannot open this application response'); }
}
export function parseApplication(v: any, context: ChannelContext): {request:EnrollmentRequest; replyKey:Hex; applicant:string} {
  if (!v || Object.keys(v).sort().join(',') !== 'applicant,replyKey,request' || !/^0x[0-9a-f]{40}$/i.test(v.applicant)) throw Error('Invalid application');
  const request = parseEnrollmentRequest(v.request);
  const c = channelContext(context);
  if(request.chainId!==c.chainId || request.escrow!==c.escrow || request.issuer!==c.issuer)throw Error('Application destination differs');
  bytes(v.replyKey,65);
  return {request,replyKey:v.replyKey,applicant:v.applicant.toLowerCase()};
}
export function parseApproval(v:any) { return validateProofFile('credential',v); }
export function enrollmentAuthorization(c:ChannelContext, hash:string, expires:number, legacy = false) {
  c=channelContext(c);
  if(!/^0x[0-9a-f]{64}$/.test(hash) || !Number.isSafeInteger(expires)) throw Error('Invalid application authorization');
  return `${legacy ? "Cutout" : "Deaddrop"} test qualification application\nChain: ${c.chainId}\nEscrow: ${c.escrow}\nIssuer: ${c.issuer}\nRequest: ${c.ticket}\nEncrypted application SHA-256: ${hash}\nExpires: ${expires}\nThis requests manual issuer approval. No payment or token approval.`;
}

// Previously signed applications remain collectable through the visual rebrand.
// Both labels authorize the exact same context, ciphertext digest and expiry.
export async function verifyEnrollmentAuthorization(applicant: Hex, context: ChannelContext, digest: string, expires: number, signature: Hex) {
  for (const legacy of [false, true]) {
    if (await verifyMessage({ address: applicant, message: enrollmentAuthorization(context, digest, expires, legacy), signature })) return true;
  }
  return false;
}
