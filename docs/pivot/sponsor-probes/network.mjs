/** Public read-only sponsor capability probe. Run from repository root: node docs/pivot/sponsor-probes/network.mjs */
import { createRequire } from 'node:module';
const require = createRequire(`${process.cwd()}/package.json`);
const {createPublicClient,http,keccak256,toHex}=require('viem');
const sha='97a57293f3b4279d94b571e678edb53ce62638f4';
const contracts=['RootRegistry','ETHRegistry','ETHRegistrar','MockUSDC','UserRegistryImpl','PermissionedResolverImpl','VerifiableFactory','ManagedUniversalResolverProxy','UniversalResolverV2'];
const output={observedAt:new Date().toISOString(),scope:'read-only; no accounts, signatures, writes, login or publications',ensSourceCommit:sha};
const artifacts=Object.fromEntries(await Promise.all(contracts.map(async n=>{const r=await fetch(`https://raw.githubusercontent.com/ensdomains/contracts-v2/${sha}/contracts/deployments/sepolia/${n}.json`,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('artifact unavailable');return [n,await r.json()]})));
const client=createPublicClient({transport:http('https://ethereum-sepolia-rpc.publicnode.com',{timeout:15000,retryCount:0})});
try{
 const chainId=await client.getChainId(); if(chainId!==11155111)throw Error('wrong-chain');
 const block=await client.getBlock();const blockNumber=block.number;
 const code=await Promise.all(contracts.map(async n=>{const address=artifacts[n].address; const bytecode=await client.getCode({address,blockNumber});return {name:n,address,codeBytes:bytecode?(bytecode.length-2)/2:0,codeHash:bytecode?keccak256(bytecode):null}}));
 const read=(n,functionName,args=[])=>client.readContract({address:artifacts[n].address,abi:artifacts[n].abi,functionName,args,blockNumber});
 const reads={};
 for(const [label,n,fn,args] of [
  ['rootEthSubregistry','RootRegistry','getSubregistry',['eth']],
  ['integrationTestsState','ETHRegistry','getState',[BigInt(keccak256(toHex('integration-tests')))]],
  ['registrarRegistry','ETHRegistrar','ETH_REGISTRY',[]],
  ['minCommitmentAge','ETHRegistrar','MIN_COMMITMENT_AGE',[]],
  ['minRegisterDuration','ETHRegistrar','MIN_REGISTER_DURATION',[]],
  ['paymentDecimals','MockUSDC','decimals',[]],
  ['managedResolverImplementation','ManagedUniversalResolverProxy','implementation',[]],
  ['resolverRoot','UniversalResolverV2','ROOT_REGISTRY',[]],
 ]){try{reads[label]=await read(n,fn,args)}catch{reads[label]={status:'read-failed'}}}
 output.ens={status:'read-verified',chainId,blockNumber,blockHash:block.hash,blockTimestamp:block.timestamp,code,reads};
}catch{output.ens={status:'unavailable',reason:'public read failed; raw provider errors omitted'}}
const arkiv='https://rpc.tiramisu.db-chain.testnet.arkiv.network';
try{const r=await fetch(arkiv,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]}),signal:AbortSignal.timeout(15000)});const j=await r.json();output.arkivHttp={status:r.status,chainId:j.result?Number(BigInt(j.result)):null,rpcErrorCode:j.error?.code}}catch{output.arkivHttp={status:'unavailable'}}
output.arkivWebsocket=await new Promise(resolve=>{
 const result={endpoint:'wss://rpc.tiramisu.db-chain.testnet.arkiv.network',opened:false,chainId:null,subscriptionAccepted:false,notifications:0,entityLogNotifications:0};
 const ws=new WebSocket(result.endpoint);let finished=false;
 const end=()=>{if(finished)return;finished=true;clearTimeout(timer);ws.close();resolve(result)};
 const timer=setTimeout(end,15000);
 ws.addEventListener('open',()=>{result.opened=true;ws.send(JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]}));ws.send(JSON.stringify({jsonrpc:'2.0',id:2,method:'eth_subscribe',params:['logs',{address:'0x4400000000000000000000000000000000000044'}]}))});
 ws.addEventListener('message',e=>{try{const j=JSON.parse(e.data);if(j.id===1&&j.result)result.chainId=Number(BigInt(j.result));if(j.id===2){result.subscriptionAccepted=typeof j.result==='string';result.rpcErrorCode=j.error?.code}if(j.method==='eth_subscription'){result.notifications++;if(j.params?.result?.address?.toLowerCase()==='0x4400000000000000000000000000000000000044')result.entityLogNotifications++}}catch{result.invalidMessage=true}});
 ws.addEventListener('error',()=>{result.transportError=true;end()});
});
try{const c=createPublicClient({transport:http('https://api.avax-test.network/ext/bc/C/rpc',{timeout:15000,retryCount:0})});output.fuji={chainId:await c.getChainId(),blockNumber:await c.getBlockNumber()}}catch{output.fuji={status:'unavailable'}}
console.log(JSON.stringify(output,(_,v)=>typeof v==='bigint'?v.toString():v,2));
