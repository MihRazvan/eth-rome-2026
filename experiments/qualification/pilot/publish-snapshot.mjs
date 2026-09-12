// SPDX-License-Identifier: MIT
// Finalize a previously deployed public manifest after a real Swarm upload.
// No signer, transaction, private input or upload endpoint is used here.
import { readFile, writeFile, open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createPublicClient, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { createSwarmStorage } from './swarm-id.ts';
const [reference] = process.argv.slice(2);
if (process.argv.length !== 3 || !/^[0-9a-f]{64}$/.test(reference ?? '')) throw Error('Pass the exact public Swarm snapshot reference (64 hex)');
const dir = resolve('.runtime/review-pass-fuji');
const lockPath = resolve(dir,'operation.lock');
const lock = await open(lockPath,'wx',0o600); await lock.writeFile(String(process.pid)); await lock.close();
try {
 const path = resolve(dir,'deployment.json');
 const manifest = JSON.parse(await readFile(path,'utf8'));
 if (manifest.chainId !== 43113 || manifest.environment !== 'fuji-testnet' || manifest.rpcUrl !== 'https://api.avax-test.network/ext/bc/C/rpc') throw Error('Canonical Fuji manifest required');
 if (manifest.snapshot.reference && manifest.snapshot.reference !== reference) throw Error('An existing snapshot reference may not be silently replaced');
 const validation = JSON.parse(execFileSync(resolve(dir,'qualification-prover'),['validate-public','--issuer-public',resolve(dir,'issuer/issuer-public.json'),'--snapshot',resolve(dir,'public/snapshot.json')],{encoding:'utf8'}));
 if (validation.status !== 'VALID_PUBLIC_METADATA' || `0x${validation.snapshotSha256}` !== manifest.snapshot.sha256) throw Error('Snapshot differs from deployment intent');
 const abi = JSON.parse(await readFile('experiments/qualification/contracts/out/QualificationEscrow.sol/QualificationEscrow.json','utf8')).abi;
 const chain = createPublicClient({chain:avalancheFuji,transport:http(manifest.rpcUrl)});
 if (await chain.getChainId() !== 43113) throw Error('Wrong chain');
 for (const [name,expected] of Object.entries({issuerX:validation.issuerX,issuerY:validation.issuerY,revocationRoot:validation.root})) {
  const actual=await chain.readContract({address:manifest.escrow,abi,functionName:name,blockTag:'finalized'});
  if(String(actual)!==String(expected)) throw Error(`Snapshot does not match finalized ${name}`);
 }
 const storage = createSwarmStorage();
 try { await storage.download({reference,sha256:manifest.snapshot.sha256}); } finally {storage.destroy();}
 manifest.snapshot.reference=reference;manifest.snapshotPublication='verified';manifest.snapshotVerifiedAt=new Date().toISOString();
 await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({status:'PUBLIC_SNAPSHOT_VERIFIED',escrow:manifest.escrow,reference,sha256:manifest.snapshot.sha256}));
} finally {await unlink(lockPath);}
