/** Server-only open participation issuer. Credential release follows a durable CAS commit. */
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createPublicClient, http, sha256, bytesToHex } from 'viem';
import { parseSealedEnrollment, verifyEnrollmentAuthorization, openEnrollment, parseApplication, parseApproval, sealEnrollment } from '../enrollment-channel';
const PATH='deaddrop/issuer-state-v1.enc';
const AAD=Buffer.from('deaddrop-hosted-issuer-state-v1');
export function encryptIssuerState(value:unknown,key:Buffer){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(AAD);
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted]);
}
export function decryptIssuerState(bytes:Buffer,key:Buffer){
 if(bytes.length<29||bytes.length>32*1024*1024)throw Error('Invalid issuer state size');
 const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAAD(AAD);decipher.setAuthTag(bytes.subarray(12,28));
 return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
}
// Injectable storage/signing boundaries let tests force real race/retry conditions.
export async function allocateCredential(ticket:string,digest:string,deps:any){
 for(let attempt=0;attempt<6;attempt++){
  const {state,etag}=await deps.read();
  if(state.version!==1||!state.registry||!state.issued)throw Error('Invalid issuer ledger');
  const previous=state.issued[ticket];
  if(previous){if(previous.digest!==digest)throw Error('Conflicting enrollment ticket');return previous.credential;}
  const result=await deps.issue(state.registry);
  const next={version:1,registry:result.registry,issued:{...state.issued,[ticket]:{digest,credential:result.credential}}};
  try{await deps.commit(next,etag);return result.credential;}
  catch(e){if(!deps.conflict(e))throw e;}
 }
 throw Error('Issuer is busy; retry the same enrollment');
}
export function createAutomaticIssuer(config:any,deps:any={}){
 return async(record:any)=>{
  const encoded=deps.secrets??process.env.DEADDROP_ISSUER_SECRETS;
  if(!encoded)throw Error('Automatic reviewer setup unavailable');
  const secrets=JSON.parse(Buffer.from(encoded,'base64').toString('utf8'));
  const storageKey=Buffer.from(secrets.storageKey,'hex');if(storageKey.length!==32)throw Error('Invalid issuer storage key');
  const envelope=parseSealedEnrollment(record.envelope),context=envelope.context;
  const digest=sha256(bytesToHex(new TextEncoder().encode(JSON.stringify(envelope))));
  if(envelope.kind!=='application'||context.ticket!==record.ticket||context.escrow!==config.escrow.toLowerCase()||context.issuer!==config.issuer.toLowerCase()||digest!==record.digest||!await verifyEnrollmentAuthorization(record.applicant,context,digest,record.expires,record.signature))throw Error('Invalid authorized enrollment');
  const application=parseApplication(await openEnrollment(envelope,secrets.channel,context,'application'),context);
  if(application.applicant!==record.applicant.toLowerCase())throw Error('Applicant binding mismatch');
  // Validate reply key before allocating. The issuer never receives a holder secret.
  await sealEnrollment({check:true},application.replyKey,context,'approval');
  const chain=createPublicClient({transport:http(config.rpcUrl,{timeout:10000,retryCount:0})});
  const block=await chain.getBlock({blockTag:'finalized'});
  if(config.chainId!==43113||application.request.createdAt>Number(block.timestamp)+60||application.request.createdAt<Number(block.timestamp)-7*86400)throw Error('Enrollment is outside its validity window');
  const expiry=Number(block.timestamp)+86400;
  const credential=await allocateCredential(record.ticket,digest,{
   read:async()=>{
    const result=await get(PATH,{access:'private',useCache:false});
    if(!result||result.statusCode!==200)throw Error('Issuer ledger unavailable; automatic reset forbidden');
    return {state:decryptIssuerState(Buffer.from(await new Response(result.stream).arrayBuffer()),storageKey),etag:result.blob.etag};
   },
   issue:async(registry:any)=>{
    const dir=await mkdtemp(join(tmpdir(),'deaddrop-issuer-'));
    try{
     const files={'issuer-key.json':secrets.issuerKey,'issuer-public.json':secrets.issuerPublic,'registry-state.json':registry};
     for(const [name,value] of Object.entries(files))await writeFile(join(dir,name),JSON.stringify(value),{mode:0o600});
     await promisify(execFile)(process.env.DEADDROP_ISSUER_BINARY??join(process.cwd(),'issuer'),['registry','issue','--dir',dir,'--commitment',application.request.holderCommitment,'--class','7','--expiry',String(expiry),'--out',join(dir,'credential.json')],{timeout:15000,maxBuffer:8192});
     const credential=parseApproval(JSON.parse(await readFile(join(dir,'credential.json'),'utf8')));
     if(credential.issuerX!==config.enrollment.issuerX||credential.issuerY!==config.enrollment.issuerY||credential.holderCommitment!==application.request.holderCommitment)throw Error('Issued credential binding mismatch');
     return {credential,registry:JSON.parse(await readFile(join(dir,'registry-state.json'),'utf8'))};
    }finally{await rm(dir,{recursive:true,force:true});}
   },
   commit:(next:any,etag:string)=>put(PATH,encryptIssuerState(next,storageKey),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:etag,contentType:'application/octet-stream'}),
   conflict:(e:unknown)=>e instanceof BlobPreconditionFailedError,
  });
  return sealEnrollment(credential,application.replyKey,context,'approval');
 };
}
