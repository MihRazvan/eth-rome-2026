// Research-only characterization probes for base b36fbf15. No chain/RPC calls.
// Run: node --import tsx docs/research/repros/boundaries.ts
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { ExitController } from '../../../packages/client/controller';
import { generateRecipientKey, encryptOffer, keyBindingTypedData, offerRequestId, purchaseQuoteCodec, encodeJson } from '../../../packages/transport';
import { quoteTypedData } from '../../../packages/shared/quote';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, sha256, verifyTypedData } from 'viem';

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
function controller(){
 const c = new ExitController(()=>{}) as any;
 c.config={environment:'local',chainId:31337,market,source,token:market,keyRegistry:source,blockNumber:'0',makers:[maker.address],storage:'explicit-local-test',index:'explicit-local-test'};
 c.address=seller.address;c.keys={load:async()=>key};
 Object.defineProperty(c,'storage',{get:()=>({environment:'explicit-local-test',retrieve:async()=>bytes})});
 Object.defineProperty(c,'client',{get:()=>({getChainId:async()=>31337,getBlock:async()=>({timestamp:BigInt(now)}),getContractEvents:async()=>[],verifyTypedData:(args:any)=>verifyTypedData(args),readContract:async({functionName}:any)=>({nextClaimId:2n,positions:[seller.address,1n,0n,0n,0n,0n,0n],requests:[market,10000000000n,4000000000n,6000000000n,BigInt(now),0n,0n,false],remaining:[10000000000n,0n,0n],balanceOf:100000000000n,allowance:100000000000n,unavailable:false,keys:[keccak256(key.publicKey),1n,BigInt(binding.validUntil)]})[functionName]})});
 return c;
}
const results:any={base:'b36fbf15e3f367caf225a1f8badc96c1449ea35b'};
{
 const c=controller();c.address=maker.address;c.ready=async()=>maker.address;
 c.wallet={account:maker,signTypedData:(args:any)=>maker.signTypedData(args)};
 const approvals:any[]=[];c.transaction=async(address:any,abi:any,method:any,args:any)=>{approvals.push({method,amount:String(args[1])});return {status:'confirmed'};};
 c.api=async()=>({context,certs:[],records:[]});
 await assert.rejects(c.makeOffer('1','9960.123456','private'),/not registered/);
 assert.deepEqual(approvals,[{method:'approve',amount:'9960123456'}]);
 results.privateApproval={privateNet:'9960.123456',publicApprovalBaseUnits:approvals[0].amount,approvalOccurredBeforeRecipientKeyValidation:true};
}

{
 const c=controller(); let release!:()=>void, reached!:()=>void;
 const firstApi=new Promise<void>(r=>reached=r);const suspended=new Promise<void>(r=>release=r);let calls=0;
 c.api=async()=>{if(++calls===1){reached();await suspended;}return {context,certs:[cert],records:[record]};};
 const sellerRefresh=c.refresh();await firstApi;
 c.address=maker.address; // Same transition connect()/selectLocalWallet makes while refresh is in flight.
 await c.refresh(); assert.equal(c.data.offers[0].status,'encrypted');
 release();await sellerRefresh;
 assert.equal(c.data.wallet,maker.address);assert.equal(c.data.claims[0].isOwner,true);assert.equal(c.data.offers[0].net,'9960.123456');
 results.sessionRace={displayWallet:c.data.wallet,claimOwner:c.data.claims[0].owner,isOwner:c.data.claims[0].isOwner,privateNetDisplayed:c.data.offers[0].net};
}
{
 const c=controller();c.api=async()=>{throw Error('Discovery unavailable')};
 await assert.rejects(c.refresh(),/Discovery unavailable/);assert.equal(c.data.claims.length,0);
 results.discoveryFailure={chainClaimRead:true,displayedClaims:c.data.claims.length,error:c.data.error};
}
{
 const c=controller();storage.set(`exit-cert:${context.requestId}`,JSON.stringify(cert));const posts:string[]=[];
 c.api=async(path:string,body:any)=>{if(body)posts.push(path);return {context,certs:[],records:[]};};
 await c.ensureKey('1');assert.deepEqual(posts,[]);
 results.bindingRetry={validLocalKey:true,serverCertificateMissing:true,publicationAttempts:posts.length};
}
{
 // Minimal extraction of server.ts's existing queue-before-body ordering; ephemeral loopback port only.
 let tail=Promise.resolve();let bodyEntered!:()=>void;
 const entered=new Promise<void>(r=>bodyEntered=r);
 const server=createServer(async(req,res)=>{let release!:()=>void;const previous=tail;tail=new Promise<void>(r=>release=r);await previous;try{bodyEntered();let body='';for await(const chunk of req)body+=chunk;res.end(body);}finally{release();}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const {port}=server.address() as any;
 const slow=request({host:'127.0.0.1',port,method:'POST',headers:{'Content-Length':2}});slow.on('response',r=>r.resume());slow.write('{');await entered;
 let completed=false;const complete=new Promise<void>((resolve,reject)=>{const r=request({host:'127.0.0.1',port,method:'POST'},s=>{s.resume();s.on('end',()=>{completed=true;resolve()})});r.on('error',reject);r.end('{}');});
 await new Promise(r=>setTimeout(r,75));assert.equal(completed,false);slow.end('}');await complete;
 server.close();await once(server,'close');results.bodyQueue={secondCompleteRequestBlockedByIncompleteFirst:true,releasedAfterFirstBodyCompleted:true};
}
console.log(JSON.stringify(results,null,2));
