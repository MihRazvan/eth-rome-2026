import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {allocateCredential,encryptIssuerState,decryptIssuerState} from './automatic-issuer';
test('encrypted issuer ledger rejects tampering, wrong keys and plaintext',()=>{
 const key=randomBytes(32),data={version:1,registry:{private:'unique-private-registry'},issued:{}};
 const bytes=encryptIssuerState(data,key);
 assert.equal(bytes.includes(Buffer.from('unique-private-registry')),false);
 assert.deepEqual(decryptIssuerState(bytes,key),data);
 assert.throws(()=>decryptIssuerState(bytes,randomBytes(32)));
 bytes[bytes.length-1]^=1;assert.throws(()=>decryptIssuerState(bytes,key));
});
function storage(){
 let state:any={version:1,registry:{nextIndex:12},issued:{}},etag=0,issues=0,commits=0;
 class Conflict extends Error{}
 const deps={
  read:async()=>({state:structuredClone(state),etag}),
  issue:async(registry:any)=>{issues++;await new Promise(r=>setTimeout(r,3));return {registry:{nextIndex:registry.nextIndex+1},credential:{index:registry.nextIndex}};},
  commit:async(next:any,version:number)=>{if(etag!==version)throw new Conflict();state=next;etag++;commits++;},
  conflict:(e:any)=>e instanceof Conflict,
 };
 return {deps,get:()=>({state,issues,commits})};
}
test('concurrent different enrollments receive unique durable indices',async()=>{
 const s=storage();const results=await Promise.all(['a','b','c'].map(t=>allocateCredential(t,t,s.deps)));
 assert.deepEqual(results.map(r=>r.index).sort(),[12,13,14]);assert.equal(s.get().state.registry.nextIndex,15);assert.equal(s.get().commits,3);
});
test('concurrent same ticket, lost response and retry reuse one committed credential',async()=>{
 const s=storage();const result=await Promise.all([allocateCredential('a','hash',s.deps),allocateCredential('a','hash',s.deps)]);
 assert.deepEqual(result,[{index:12},{index:12}]);assert.equal(s.get().commits,1);
 assert.deepEqual(await allocateCredential('a','hash',s.deps),{index:12});assert.equal(s.get().state.registry.nextIndex,13);
 await assert.rejects(allocateCredential('a','changed',s.deps),/Conflicting/);
});
test('storage failure never returns an uncommitted credential or resets state',async()=>{
 const s=storage();s.deps.commit=async()=>{throw Error('storage down');};
 await assert.rejects(allocateCredential('a','hash',s.deps),/storage down/);assert.equal(s.get().state.registry.nextIndex,12);
 s.deps.read=async()=>{throw Error('missing ledger');};await assert.rejects(allocateCredential('a','hash',s.deps),/missing ledger/);
});
