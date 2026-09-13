// Public encrypted application queue. Only the relay writes Arkiv; issuer signing stays offline.
import { createPublicClient, createWalletClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { eq } from '@arkiv-network/sdk/query';
import { ExpirationTime } from '@arkiv-network/sdk/utils';
import { http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
export const INBOX_NAMESPACE = 'cutout-enrollment-v1';
export type InboxConfig = { relayAddress:Hex; escrow:Hex };
export function enrollmentInbox(config:InboxConfig, key?:Hex) {
 const read=createPublicClient({chain:tiramisu,transport:http(tiramisu.rpcUrls.default.http[0],{timeout:12000,retryCount:0})});
 const account=key?privateKeyToAccount(key):undefined;
 if(account && account.address.toLowerCase()!==config.relayAddress.toLowerCase())throw Error('Enrollment relay configuration mismatch');
 const wallet=account?createWalletClient({chain:tiramisu,account,transport:http(tiramisu.rpcUrls.default.http[0],{timeout:12000,retryCount:0})}):undefined;
 return {
  async query(filters:Record<string,string>={}) {
   const result=await read.select({key:true,owner:true,payload:true,attributes:true,expiresAt:true}).ownedBy(config.relayAddress).where(eq('app',INBOX_NAMESPACE),eq('escrow',config.escrow.toLowerCase()),...Object.entries(filters).map(([k,v])=>eq(k,v))).limit(100).fetch();
   return result.entities.map(e=>({key:e.key,record:JSON.parse(new TextDecoder().decode(e.payload))}));
  },
  async create(record:any, bucket:string) {
   if(!wallet)throw Error('Enrollment relay is unavailable');
   return wallet.createEntity({payload:new TextEncoder().encode(JSON.stringify(record)),contentType:'application/json',attributes:{app:INBOX_NAMESPACE,escrow:config.escrow.toLowerCase(),ticket:record.ticket,bucket,stage:'pending'},expires:ExpirationTime.fromSeconds(172800),flags:{readonly:false,permissionlessExtension:false}});
  },
  async approve(entityKey:Hex,record:any) {
   if(!wallet)throw Error('Enrollment relay is unavailable');
   return wallet.patchEntity({entityKey,payload:new TextEncoder().encode(JSON.stringify(record)),set:{stage:'approved'}});
  }
 };
}
