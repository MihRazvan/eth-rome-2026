// Offline issuer operator. Only encrypted application/approval records are published.
import {readFile,writeFile,mkdir,stat,rmdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {verifyMessage,sha256,bytesToHex} from 'viem';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {generateChannelKeys,openEnrollment,sealEnrollment,parseApplication,parseApproval,enrollmentAuthorization,parseSealedEnrollment} from './enrollment-channel.ts';
import {enrollmentInbox} from './enrollment-inbox.ts';
const dir='.runtime/cutout-enrollment-service';
const command=process.argv[2],ticket=process.argv[3];
const config=JSON.parse(await readFile('.runtime/review-pass-fuji/deployment.json','utf8'));
if(command==='init'){
 await mkdir(dir,{recursive:true,mode:0o700});
 const keys=await generateChannelKeys(),relayKey=generatePrivateKey();
 await writeFile(`${dir}/channel-private.json`,JSON.stringify(keys),{mode:0o600,flag:'wx'});
 await writeFile(`${dir}/relay.key`,relayKey,{mode:0o600,flag:'wx'});
 const issuer=JSON.parse(await readFile('.runtime/review-pass-fuji/issuer/issuer-public.json','utf8'));
 const pub={publicKey:keys.publicKey,relayAddress:privateKeyToAccount(relayKey).address,issuerX:issuer.issuerX,issuerY:issuer.issuerY};
 await writeFile('experiments/qualification/pilot/hosting/enrollment-public.json',JSON.stringify(pub,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'channel-created',relayAddress:pub.relayAddress,privateFilesLogged:false}));
}else if(command==='list'||command==='approve'){
 const pub=JSON.parse(await readFile('experiments/qualification/pilot/hosting/enrollment-public.json','utf8'));
 const key=(await readFile(`${dir}/relay.key`,'utf8')).trim();
 const inbox=enrollmentInbox({...pub,escrow:config.escrow},key);
 if(command==='list'){
  const rows=await inbox.query({stage:'pending'});
  console.log(JSON.stringify(rows.map(({key,record})=>({entity:key,ticket:record.ticket,applicant:record.applicant,createdAt:record.createdAt})),null,2));
 }else{
  if(!/^[0-9a-f]{64}$/.test(ticket??''))throw Error('Explicit application ticket required');
  const rows=await inbox.query({ticket});
  if(!rows.length)throw Error('Application not found');
  if(rows.some(r=>r.record.approval))throw Error('Application already approved; no duplicate issuance');
  if(rows.some(r=>r.record.digest!==rows[0].record.digest))throw Error('Conflicting application records require inspection');
  rows.sort((a,b)=>a.key.localeCompare(b.key));
  const {key:entityKey,record}=rows[0];
  const jobDir=resolve(dir,ticket);await mkdir(jobDir,{recursive:true,mode:0o700});
  const lock=resolve(jobDir,'approval.lock');
  try{await mkdir(lock);}catch{throw Error('Approval already running or interrupted; inspect private state before removing its lock');}
  try {
  if(record.approval)throw Error('Already approved; no new credential was issued');
  const envelope=parseSealedEnrollment(record.envelope),context=envelope.context;
  if(ticket!==record.ticket||ticket!==context.ticket)throw Error("Application ticket binding differs");
  const digest=sha256(bytesToHex(new TextEncoder().encode(JSON.stringify(envelope))));
  if(record.digest!==digest || !await verifyMessage({address:record.applicant,message:enrollmentAuthorization(context,digest,record.expires),signature:record.signature}))throw Error('Application wallet authorization failed');
  if(context.escrow!==config.escrow.toLowerCase()||context.issuer!==config.issuer.toLowerCase())throw Error('Application targets another issuer');
  const privateChannel=JSON.parse(await readFile(`${dir}/channel-private.json`,'utf8'));
  const application=parseApplication(await openEnrollment(envelope,privateChannel,context,'application'),context);
  if(application.applicant!==record.applicant.toLowerCase())throw Error('Application wallet differs from authorization');
  // Validate reply curve/key before reserving an irreversible issuer index.
  await sealEnrollment({preflight:true},application.replyKey,context,'approval');
  const requestFile=resolve(jobDir,'request.json'),credentialFile=resolve(jobDir,'credential.json');
  await writeFile(requestFile,JSON.stringify(application.request),{mode:0o600});
  let exists=true;try{await stat(credentialFile);}catch(e){if(e.code==='ENOENT')exists=false;else throw e;}
  if(!exists){
   // This preserves the existing durable issuer allocator and onchain authority checks.
   try{await promisify(execFile)('node',['--import','tsx','experiments/qualification/pilot/issue-enrollment.mjs','--request',requestFile,'--out',credentialFile],{maxBuffer:65536});}
   catch{throw Error('Issuance failed; inspect private output before retrying. No raw issuer logs exposed.');}
  }
  const credential=parseApproval(JSON.parse(await readFile(credentialFile,'utf8')));
  if(credential.holderCommitment!==application.request.holderCommitment||credential.issuerX!==pub.issuerX||credential.issuerY!==pub.issuerY||Number(credential.expiry)<=Math.floor(Date.now()/1000))throw Error('Existing credential does not match current application');
  const approval=await sealEnrollment(credential,application.replyKey,context,'approval');
  const result=await inbox.approve(entityKey,{...record,approval,approvedAt:Math.floor(Date.now()/1000)});
  console.log(JSON.stringify({status:'approved',ticket,entityKey,txHash:result.txHash,credentialPlaintextPublished:false}));
  } finally {await rmdir(lock);}
 }
}else throw Error('Use init, list, or approve <ticket>. Approval is explicit test participation, not accreditation.');
