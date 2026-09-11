// Independent correction probes for integrator42bd712 + foundation7e94920. No chain/RPC calls.
// Run: node --import tsx docs/research/repros/corrected-boundaries.ts
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { ExitController } from '../../../packages/client/controller';
import { generateRecipientKey, encryptOffer, keyBindingTypedData, offerRequestId, purchaseQuoteCodec, encodeJson } from '../../../packages/transport';
import { quoteTypedData } from '../../../packages/shared/quote';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, sha256, verifyTypedData, encodeFunctionData, decodeFunctionData, parseUnits } from 'viem';

const seller = privateKeyToAccount(`0x${'11'.repeat(32)}`);
const maker = privateKeyToAccount(`0x${'22'.repeat(32)}`);
const market = '0x0000000000000000000000000000000000000010';
const source = '0x0000000000000000000000000000000000000020';
const key = await generateRecipientKey();
const context = { chainId:31337, market, seller:seller.address, requestId:offerRequestId(31337,market,1n,0n) };
const now = Math.floor(Date.now()/1000);
const binding = { ...context, version:1, publicKey:key.publicKey, validFrom:now-5, validUntil:now+600 };
const cert = {binding, signature:await seller.signTypedData(keyBindingTypedData(binding))};
const q = {maker:maker.address,seller:seller.address,buyer:maker.address,claimId:1n,source,sourceVersion:1n,paymentToken:market,netPayment:9960123456n,feeAmount:0n,feeRecipient:'0x0000000000000000000000000000000000000000',ownershipEpoch:0n,depletion:0n,deadline:BigInt(now+300),nonce:`0x${'33'.repeat(32)}`,underwritingHash:`0x${'00'.repeat(32)}`};
const signed = {quote:q,signature:await maker.signTypedData(quoteTypedData(q,31337,market))};
const codec = purchaseQuoteCodec({claimId:1n,source,sourceVersion:1n});
const envelope = await encryptOffer(signed,cert,context,codec,(data,signature,address)=>verifyTypedData({...data,signature,address}),async()=>({keyHash:keccak256(key.publicKey),version:1,revoked:false}));
const bytes = encodeJson(envelope);
const record = {...context,reference:'a'.repeat(64),sha256:sha256(bytes),mode:'private',keyVersion:1};
const storage = new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)},configurable:true});
function controller(allowance = 100000000000n){
 const c = new ExitController(()=>{}) as any;
 c.config={environment:'local',chainId:31337,market,source,token:market,keyRegistry:source,blockNumber:'0',makers:[maker.address],storage:'explicit-local-test',index:'explicit-local-test'};
 c.address=seller.address;c.keys={load:async()=>key};
 Object.defineProperty(c,'storage',{get:()=>({environment:'explicit-local-test',retrieve:async()=>bytes})});
 Object.defineProperty(c,'client',{get:()=>({getChainId:async()=>31337,getBlock:async()=>({timestamp:BigInt(now),number:1n}),getContractEvents:async()=>[],verifyTypedData:(args:any)=>verifyTypedData(args),readContract:async({functionName}:any)=>({nextClaimId:2n,positions:[seller.address,1n,0n,0n,0n,0n,0n],requests:[market,10000000000n,4000000000n,6000000000n,BigInt(now),0n,0n,false],remaining:[10000000000n,0n,0n],balanceOf:100000000000n,allowance,unavailable:false,keys:[keccak256(key.publicKey),1n,BigInt(binding.validUntil)]})[functionName]})});
 return c;
}

const results:any={reviewedIntegratorCommit:'42bd712ce30056d15cd8377a3e18e477f574df4e',foundation:'7e94920',network:'No RPC/chain calls; actual HPKE and signatures, stubbed chain reads'};
{
 const c=controller();let release!:()=>void,reached!:()=>void;
 const firstApi=new Promise<void>(r=>reached=r),suspended=new Promise<void>(r=>release=r);let calls=0;
 c.api=async()=>{if(++calls===1){reached();await suspended;}return {context,certs:[cert],records:[record]};};
 const sellerRefresh=c.refresh();await firstApi;
 c.changeWallet(maker.address);await c.refresh();assert.equal(c.data.offers[0].status,'encrypted');
 release();await sellerRefresh;
 assert.equal(c.data.wallet,maker.address);assert.equal(c.data.claims[0].isOwner,false);assert.equal(c.data.offers[0].net,undefined);assert.equal(c.quotes.size,0);
 results.sessionRace={newWalletRetained:true,oldOwnerFlagNotCommitted:true,privatePriceNotCommitted:true,plaintextQuoteMapEmpty:true};
}
{
 const c=controller();c.api=async()=>{throw Error('Discovery unavailable')};
 await c.refresh();assert.equal(c.data.claims.length,1);assert.equal(c.data.claims[0].isOwner,true);assert.equal(c.data.claims[0].offersUnavailable,true);
 results.discoveryFailure={authoritativeClaimsRetained:1,ownershipRetained:true,offersUnavailableExplicit:true};
}
{
 const c=controller();let keyLoads=0;c.keys={load:async()=>{keyLoads++;return key}};
 c.api=async()=>({context:{...context,seller:maker.address},certs:[cert],records:[record]});
 await c.refresh();assert.equal(c.data.claims.length,1);assert.equal(c.data.claims[0].offersUnavailable,true);assert.equal(keyLoads,0);assert.equal(c.quotes.size,0);
 results.substitutedContext={rejectedBeforeKeyAccess:true,chainClaimPreserved:true};
}
{
 const c=controller();storage.set(`exit-cert:${context.requestId}`,JSON.stringify(cert));const posts:string[]=[];
 c.api=async(path:string,body:any)=>{if(body)posts.push(path);return {context,certs:[],records:[]};};
 await c.ensureKey('1');assert.deepEqual(posts,['binding']);
 results.bindingRetry={existingCertificateRepublished:true};
}
{
 const observations:any[]=[];
 for(const [net,allowance] of [['9960.123456',0n],['9987.654321',0n],['9940.987654',100000000000n]] as const){
  const c=controller(allowance);c.address=maker.address;c.ready=async()=>maker.address;c.refresh=async()=>{};
  c.wallet={account:maker,signTypedData:(args:any)=>maker.signTypedData(args)};
  const approvals:string[]=[],calldata:string[]=[];let uploaded:any;
  c.transaction=async(address:any,abi:any,method:any,args:any)=>{assert.equal(method,'approve');approvals.push(String(args[1]));const data=encodeFunctionData({abi,functionName:method,args});const decoded=decodeFunctionData({abi,data});assert.notEqual(decoded.args![1],parseUnits(net,6));calldata.push(data);return {status:'confirmed'}};
  c.api=async(path:string,body:any)=>{if(path==='publish-envelope'){uploaded=body;return {published:true}}return {context,certs:[cert],records:[]}};
  await c.makeOffer('1',net,'private');
  assert.deepEqual(approvals,allowance===0n?['100000000000']:[]);
  assert.equal(uploaded.envelope.format,'exit-private-offer');assert.equal('quote' in uploaded,false);assert.equal('signed' in uploaded,false);assert.equal(JSON.stringify(uploaded).includes(net),false);
  observations.push({privateNet:net,approvalBaseUnits:approvals,approvalCalldata:calldata,uploadedOnlyEnvelopeAndPublicCertificate:true});
 }
 results.privateApprovals=observations;
}
{
 const c=controller(0n);c.address=maker.address;c.ready=async()=>maker.address;let approvals=0,signatures=0;
 c.wallet={account:maker,signTypedData:async()=>{signatures++;throw Error('unexpected signing')}};
 c.transaction=async()=>{approvals++;throw Error('unexpected approval')};
 c.api=async()=>({context,certs:[],records:[]});
 await assert.rejects(c.makeOffer('1','9960.123456','private'),/not registered/);
 assert.equal(approvals,0);assert.equal(signatures,0);
 c.api=async()=>({context,certs:[cert],records:[]});
 await assert.rejects(c.makeOffer('1','100001','private'),/spending limit/);
 assert.equal(approvals,0);assert.equal(signatures,0);
 results.failureBeforePublicAction={missingKeyNoApprovalOrSignature:true,overBudgetNoApprovalOrSignature:true};
}
console.log(JSON.stringify(results,null,2));
