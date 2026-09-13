import {test} from 'node:test';
import assert from 'node:assert/strict';
import {privateKeyToAccount} from 'viem/accounts';
import {bytesToHex,sha256} from 'viem';
import {generateChannelKeys,sealEnrollment,enrollmentAuthorization} from '../enrollment-channel';
import {createEnrollmentAPI} from './enrollment-api';
const account=privateKeyToAccount(`0x${'15'.repeat(32)}`),clock=1789300000;
const ctx={chainId:43113,escrow:`0x${'11'.repeat(20)}`,issuer:`0x${'22'.repeat(20)}`,ticket:'a'.repeat(64)};
async function setup(){
 const keys=await generateChannelKeys();
 const envelope=await sealEnrollment({example:'encrypted'},keys.publicKey,ctx,'application');
 const expires=clock+240,digest=sha256(bytesToHex(new TextEncoder().encode(JSON.stringify(envelope))));
 const signature=await account.signMessage({message:enrollmentAuthorization(ctx,digest,expires)});
 const body={applicant:account.address,envelope,expires,signature};
 const rows:any[]=[];let writes=0;
 const config:any={...ctx,rpcUrl:'https://api.avax-test.network/ext/bc/C/rpc',enrollment:{publicKey:keys.publicKey,relayAddress:account.address,issuerX:'1',issuerY:'2'}};
 const deps:any={key:`0x${'16'.repeat(32)}`,now:()=>clock,balance:async()=>10n**17n,inbox:{query:async(f:any)=>rows.filter(r=>!f.ticket||r.record.ticket===f.ticket).filter(r=>!f.bucket||r.bucket===f.bucket),create:async(record:any,bucket:string)=>{writes++;rows.push({key:'test',record,bucket});}}};
 const api=createEnrollmentAPI(config,deps);
 async function request(method:string,data:any=body,options:any={}){
  const res:any={setHeader(){},end(v:string){this.body=JSON.parse(v);}};
  await api({url:options.url??'/api/enrollment',method,body:data,headers:{origin:options.origin??'https://cutout-ethrome-2026.vercel.app','content-type':'application/json'}},res);
  return {status:res.statusCode,body:res.body};
 }
 return {request,rows,body,deps,writes:()=>writes};
}
test('signed applications are submitted once and retrieved without exposing plaintext',async()=>{
 const s=await setup();assert.equal((await s.request('POST')).status,201);assert.equal(s.writes(),1);
 assert.equal((await s.request('POST')).status,200);assert.equal(s.writes(),1);
 const response=await s.request('GET',undefined,{url:`/api/enrollment?ticket=${ctx.ticket}`});
 assert.deepEqual(response.body,{status:'pending',approval:null});
 assert.ok(!JSON.stringify(s.rows).includes('encrypted"'));
});
test('wrong origin, expired signature, altered content and missing gas never publish',async()=>{
 const s=await setup();assert.equal((await s.request('POST',s.body,{origin:'https://evil.example'})).status,403);
 assert.equal((await s.request('POST',{...s.body,expires:clock-1})).status,503);
 assert.equal((await s.request('POST',{...s.body,applicant:`0x${'44'.repeat(20)}`})).status,503);
 assert.equal((await s.request('POST',{...s.body,envelope:{...s.body.envelope,context:{...ctx,holderSecret:'never'}}})).status,503);
 s.deps.balance=async()=>0n;assert.equal((await s.request('POST')).status,400);assert.equal(s.writes(),0);
});
test('bounded per-wallet inbox, malformed references and error responses stay safe',async()=>{
 const s=await setup();await s.request('POST');const bucket=s.rows[0].bucket;s.rows.splice(0,1,...[1,2,3].map(n=>({record:{ticket:String(n)},bucket})));
 assert.equal((await s.request('POST')).status,429);assert.equal(s.writes(),1);
 assert.equal((await s.request('GET',undefined,{url:'/api/enrollment?ticket=secret'})).status,400);
 assert.equal((await s.request('DELETE')).status,405);
 s.deps.inbox.query=async()=>{throw Error('private provider diagnostic');};
 assert.ok(!JSON.stringify(await s.request('GET',undefined,{url:`/api/enrollment?ticket=${ctx.ticket}`})).includes('private provider'));
});

test('one service instance serializes concurrent retries and prefers an approved duplicate record',async()=>{
 const s=await setup();const r=await Promise.all([s.request('POST'),s.request('POST')]);
 assert.deepEqual(r.map(v=>v.status),[201,200]);assert.equal(s.writes(),1);
 s.rows.push({...s.rows[0],record:{...s.rows[0].record,approval:{ciphertext:'sealed'}}});
 const response=await s.request('GET',undefined,{url:`/api/enrollment?ticket=${ctx.ticket}`});assert.equal(response.body.status,'approved');
});

test('Deaddrop authorization and already-signed Cutout applications both retain exact ciphertext binding', async () => {
 const s=await setup();
 const digest=sha256(bytesToHex(new TextEncoder().encode(JSON.stringify(s.body.envelope))));
 assert.match(enrollmentAuthorization(ctx,digest,s.body.expires), /^Deaddrop reviewer setup/);
 const signature=await account.signMessage({message:enrollmentAuthorization(ctx,digest,s.body.expires,true)});
 assert.equal((await s.request('POST',{...s.body,signature})).status,201);
 assert.equal(s.writes(),1);
 const altered={...s.body.envelope,context:{...ctx,ticket:'b'.repeat(64)}};
 assert.equal((await s.request('POST',{...s.body,signature,envelope:altered})).status,503);
 assert.equal(s.writes(),1);
});

test('automatic setup returns durable encrypted credential despite Arkiv patch retry',async()=>{
 const s=await setup();await s.request('POST');
 s.deps.issue=undefined;
 // Rebuild because the issuer is captured when creating the API.
 const config:any={...ctx,rpcUrl:'https://api.avax-test.network/ext/bc/C/rpc',enrollment:{publicKey:'public',relayAddress:account.address,issuerX:'1',issuerY:'2'}};
 let patched=0;const approval={ciphertext:'sealed-private-credential'};
 const api=createEnrollmentAPI(config,{...s.deps,issue:async()=>approval,inbox:{...s.deps.inbox,approve:async()=>{patched++;throw Error('nonce retry');}}});
 const res:any={setHeader(){},end(s:string){this.body=JSON.parse(s);}};
 await api({method:'GET',url:`/api/enrollment?ticket=${ctx.ticket}`,headers:{}},res);
 assert.equal(res.statusCode,200);assert.deepEqual(res.body,{status:'approved',approval});assert.equal(patched,1);
});
