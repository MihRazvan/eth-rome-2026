// SPDX-License-Identifier: MIT
// Independent local probes; no RPC, running pilot, document upload or real wallet is touched.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { verifyMessage } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const pilot = new URL('./', import.meta.url);
const messageSource = await readFile(new URL('upload-message.ts', pilot), 'utf8');
const { uploadMessage } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(messageSource).replace(/import\s*\{\s*\}\s*from\s*['"]viem['"];?/g,'')));
// Deliberately public dummy test signer; no external account or key material.
const worker = privateKeyToAccount('0x' + '11'.repeat(32));
const outsider = privateKeyToAccount('0x' + '22'.repeat(32));
const params = [31338, '0x' + '33'.repeat(20), '42', '0x' + '44'.repeat(32), 2_000_000_000];
const signature = await worker.signMessage({message:uploadMessage(...params)});
assert.equal(await verifyMessage({address:worker.address,message:uploadMessage(...params),signature}),true);
let mutations = 0;
for (let i=0;i<params.length;i++) {
  const changed = [...params];
  changed[i] = [31339,'0x'+'55'.repeat(20),'43','0x'+'66'.repeat(32),2_000_000_001][i];
  assert.equal(await verifyMessage({address:worker.address,message:uploadMessage(...changed),signature}),false);
  mutations++;
}
assert.equal(await verifyMessage({address:outsider.address,message:uploadMessage(...params),signature}),false);
console.log(JSON.stringify({scope:'actual upload-message function and EOA verifier, offline',validAuthorization:true,rejectedBoundFieldMutations:mutations,rejectedOtherWorker:true}));

// Minimal executable reconstruction of the original async connection ordering.
// This intentionally demonstrates the reported failure, not a claim about the patched browser.
async function connectionModel(guarded) {
  let generation=0, account, device, current='wallet-A';
  let continueRead;
  const blocked = new Promise(resolve=>{continueRead=resolve;});
  async function connect() {
    const start=generation;
    const addresses=[current];
    await blocked; // original eth_chainId / switch-chain await
    if(guarded && start!==generation) return;
    account=addresses[0];
    device=`key:${account}`;
    generation++;
  }
  const operation=connect();
  current='wallet-B';generation++;account=undefined;device=undefined;
  continueRead();await operation;
  return {current,account,device};
}
assert.equal((await connectionModel(false)).account,'wallet-A');
assert.equal((await connectionModel(true)).account,undefined);
console.log(JSON.stringify({scope:'isolated original connection interleaving',originalResurrectsPriorWallet:true,generationGuardRejectsStaleConnection:true}));
